use std::sync::Mutex;

use tauri::State;

use crate::ai::config::AiConfig;
use crate::ai::mcp_server;
use crate::ai::ollama::{ChatStreamChunkPayload, ChatStreamOutcome};
use crate::ai::provider::{ChatMessage, ScribeAiProvider};
use crate::ActiveStreams;
use crate::DbState;

// Maximum number of tool-calling iterations per chat message to prevent loops.
const MAX_TOOL_ITERATIONS: usize = 3;

// ---------------------------------------------------------------------------
// Managed state
// ---------------------------------------------------------------------------

pub struct AiState {
    pub config: Mutex<AiConfig>,
    pub client: reqwest::Client,
}

impl AiState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(AiConfig::default()),
            client: reqwest::Client::new(),
        }
    }

    /// Build the appropriate provider from the current config.
    pub fn provider(&self) -> ScribeAiProvider {
        let config = self.config.lock().unwrap();
        ScribeAiProvider::from_config(&config, self.client.clone())
    }
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_CHAT: &str = "You are ScribeAI, an intelligent study assistant \
embedded in the Glyphic note-taking app. You help students understand their \
notes, explain concepts, and answer questions. Be concise, clear, and helpful. \
When given note context, reference it specifically. Format your responses with \
markdown when helpful.";

const SYSTEM_SUMMARIZE: &str = "You are ScribeAI. Summarize the following \
student notes into a concise, well-structured summary. Use bullet points for \
key concepts. Keep it under 200 words. Highlight the most important takeaways.";

const SYSTEM_FLASHCARDS: &str = "You are ScribeAI. Generate study flashcards \
from the following notes. Return a JSON array of objects with \"question\" and \
\"answer\" fields. Generate 5-10 flashcards covering the key concepts. Make \
questions specific and answers concise. Return only the JSON array, no other \
text.";

const SYSTEM_EXPLAIN: &str = "You are ScribeAI. Explain the following text in \
simple, clear terms. If it's a formula or equation, break it down step by step. \
If it's a concept, give a brief definition and an example. Keep it accessible \
for a college student.";

const SYSTEM_VISION: &str = "You are ScribeAI, a visual study assistant. \
Describe and explain the content of this lecture screenshot in detail. \
Identify any diagrams, equations, charts, or key concepts shown. \
Break down complex visuals step by step and explain what the student \
should take away from this slide or image.";

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ai_chat(
    message: String,
    note_context: Option<String>,
    model_override: Option<String>,
    state: State<'_, AiState>,
    db_state: State<'_, DbState>,
) -> Result<String, String> {
    let provider = state.provider();
    let model = {
        let config = state.config.lock().unwrap();
        model_override.unwrap_or_else(|| config.model_routing.chat.clone())
    };

    // Build the tool-aware system prompt.
    let tools = mcp_server::available_tools();
    let tool_prompt = mcp_server::format_tools_for_prompt(&tools);

    let system_prompt = {
        let mut system = SYSTEM_CHAT.to_string();
        system.push_str("\n\n");
        system.push_str(&tool_prompt);

        // Legacy RAG: also inject FTS5 context as a fallback hint.
        if let Ok(conn) = db_state.0.lock() {
            let search_query = note_context.as_deref().unwrap_or(&message);
            if let Some(ctx) = mcp_server::gather_context(&conn, search_query) {
                system.push_str("\n\n");
                system.push_str(&ctx);
            }
        }

        // Append explicit note context provided by the caller.
        if let Some(ctx) = &note_context {
            if !ctx.is_empty() {
                system.push_str("\n\nCurrent note context:\n");
                system.push_str(ctx);
            }
        }

        system
    };

    // --- MCP tool-calling loop ---
    // Build an initial message list and iterate up to MAX_TOOL_ITERATIONS.
    // If the LLM returns a tool call JSON, execute the tool and feed the result
    // back so the LLM can produce a final answer for the user.
    let mut messages = vec![ChatMessage {
        role: "user".into(),
        content: message,
    }];

    for _ in 0..MAX_TOOL_ITERATIONS {
        let response = provider
            .chat(messages.clone(), Some(system_prompt.clone()), Some(model.clone()))
            .await?;

        // Check if the LLM wants to call a vault tool.
        if let Some(tool_call) = mcp_server::parse_tool_call(&response) {
            // Execute the tool against the vault database.
            let tool_result = if let Ok(conn) = db_state.0.lock() {
                mcp_server::execute_tool(&conn, &tool_call)
            } else {
                crate::ai::mcp_protocol::McpToolResult {
                    tool_name: tool_call.name.clone(),
                    success: false,
                    content: "Database unavailable".into(),
                }
            };

            // Append the tool call + result to the conversation so the LLM
            // can formulate a final answer grounded in real vault data.
            messages.push(ChatMessage {
                role: "assistant".into(),
                content: response,
            });
            messages.push(ChatMessage {
                role: "user".into(),
                content: format!(
                    "Tool result for `{}`:\n{}",
                    tool_result.tool_name, tool_result.content
                ),
            });
            // Continue the loop so the LLM can respond with the final answer.
        } else {
            // No tool call detected — return the response directly.
            return Ok(response);
        }
    }

    // If we exhausted the iteration limit, do a final call without tool hints.
    provider
        .chat(messages, Some(SYSTEM_CHAT.to_string()), Some(model))
        .await
}

#[tauri::command]
pub async fn ai_summarize(
    note_content: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let provider = state.provider();
    let model = {
        let config = state.config.lock().unwrap();
        config.model_routing.summarize.clone()
    };

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: note_content,
    }];

    provider.chat(messages, Some(SYSTEM_SUMMARIZE.to_string()), Some(model)).await
}

#[tauri::command]
pub async fn ai_flashcards(
    note_content: String,
    state: State<'_, AiState>,
) -> Result<Vec<serde_json::Value>, String> {
    let provider = state.provider();
    let model = {
        let config = state.config.lock().unwrap();
        config.model_routing.flashcards.clone()
    };

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: note_content,
    }];

    let response = provider
        .chat(messages, Some(SYSTEM_FLASHCARDS.to_string()), Some(model))
        .await?;

    let json_str = extract_json_array(&response);
    serde_json::from_str::<Vec<serde_json::Value>>(&json_str).map_err(|e| {
        format!("ScribeAI: Failed to parse flashcards: {e}. Response: {response}")
    })
}

#[tauri::command]
pub async fn ai_explain(
    text: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let provider = state.provider();
    let model = {
        let config = state.config.lock().unwrap();
        if is_vision_content(&text) {
            config.model_routing.vision.clone()
        } else {
            config.model_routing.explain.clone()
        }
    };

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: text,
    }];

    provider.chat(messages, Some(SYSTEM_EXPLAIN.to_string()), Some(model)).await
}

#[tauri::command]
pub async fn ai_explain_screenshot(
    text: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let provider = state.provider();
    let model = {
        let config = state.config.lock().unwrap();
        config.model_routing.vision.clone()
    };

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: text,
    }];

    provider.chat(messages, Some(SYSTEM_VISION.to_string()), Some(model)).await
}

#[tauri::command]
pub async fn ai_check_connection(
    state: State<'_, AiState>,
) -> Result<bool, String> {
    state.provider().check_connection().await
}

#[tauri::command]
pub async fn ai_get_config(
    state: State<'_, AiState>,
) -> Result<AiConfig, String> {
    let config = state
        .config
        .lock()
        .map_err(|e| format!("Failed to lock AI config: {e}"))?;
    Ok(config.clone())
}

#[tauri::command]
pub async fn ai_update_config(
    vault_path: String,
    config: AiConfig,
    state: State<'_, AiState>,
) -> Result<(), String> {
    {
        let mut current = state
            .config
            .lock()
            .map_err(|e| format!("Failed to lock AI config: {e}"))?;
        *current = config.clone();
    }
    crate::ai::config::save(std::path::Path::new(&vault_path), &config)
}

#[tauri::command]
pub async fn ai_list_models(state: State<'_, AiState>) -> Result<Vec<String>, String> {
    let endpoint = {
        let cfg = state.config.lock().map_err(|e| format!("AI config lock: {e}"))?;
        cfg.ollama.endpoint.clone()
    };
    crate::ai::ollama::list_models(&endpoint, &state.client).await
}

// ---------------------------------------------------------------------------
// Streaming chat commands
// ---------------------------------------------------------------------------

/// Payload for the `chat-stream-done` / `chat-stream-cancelled` Tauri events.
#[derive(Clone, serde::Serialize)]
struct ChatStreamEndPayload {
    stream_id: String,
}

/// Cancel an in-flight streaming chat by its `stream_id`.
///
/// Safe to call even after the stream has already finished — in that case the
/// id is no longer in the map and the call is a no-op.
#[tauri::command]
pub async fn cancel_chat(app: tauri::AppHandle, stream_id: String) -> Result<(), String> {
    let mut map = app.state::<ActiveStreams>().0.lock().await;
    if let Some(tx) = map.remove(&stream_id) {
        let _ = tx.send(());
    }
    Ok(())
}

/// Start a streaming chat request.
///
/// The command registers a cancellation token keyed by `stream_id`, then runs
/// the same MCP tool-calling loop as [`ai_chat`].  For Ollama, each iteration
/// uses the streaming `/api/chat` endpoint and emits `chat-stream-chunk` Tauri
/// events as tokens arrive.  Responses that start with `{` are buffered
/// silently (tool-call detection); everything else is forwarded to the
/// frontend immediately.
///
/// Terminal events:
/// - `chat-stream-done`      — full response delivered, partial text preserved.
/// - `chat-stream-cancelled` — user cancelled; partial text preserved.
///
/// For OpenAI the command falls back to a single non-streaming call and emits
/// the entire reply as one `chat-stream-chunk` followed by `chat-stream-done`.
#[tauri::command]
pub async fn ai_chat_stream(
    app: tauri::AppHandle,
    stream_id: String,
    message: String,
    note_context: Option<String>,
    model_override: Option<String>,
    state: State<'_, AiState>,
    db_state: State<'_, DbState>,
    active_streams: State<'_, ActiveStreams>,
) -> Result<(), String> {
    // Register cancellation channel.
    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut map = active_streams.0.lock().await;
        map.insert(stream_id.clone(), cancel_tx);
    }

    let provider = state.provider();
    let model = {
        let config = state.config.lock().unwrap();
        model_override.unwrap_or_else(|| config.model_routing.chat.clone())
    };

    // Build the tool-aware system prompt (same logic as ai_chat).
    let tools = mcp_server::available_tools();
    let tool_prompt = mcp_server::format_tools_for_prompt(&tools);

    let system_prompt = {
        let mut system = SYSTEM_CHAT.to_string();
        system.push_str("\n\n");
        system.push_str(&tool_prompt);

        if let Ok(conn) = db_state.0.lock() {
            let search_query = note_context.as_deref().unwrap_or(&message);
            if let Some(ctx) = mcp_server::gather_context(&conn, search_query) {
                system.push_str("\n\n");
                system.push_str(&ctx);
            }
        }

        if let Some(ctx) = &note_context {
            if !ctx.is_empty() {
                system.push_str("\n\nCurrent note context:\n");
                system.push_str(ctx);
            }
        }

        system
    };

    let mut messages = vec![ChatMessage {
        role: "user".into(),
        content: message,
    }];

    // MCP tool loop — mirrors ai_chat but uses streaming for the final response.
    let outcome = 'tool_loop: {
        for _ in 0..MAX_TOOL_ITERATIONS {
            let stream_outcome = match &provider {
                ScribeAiProvider::Ollama(p) => {
                    p.chat_stream(
                        &app,
                        &stream_id,
                        messages.clone(),
                        Some(system_prompt.clone()),
                        Some(model.clone()),
                        &mut cancel_rx,
                    )
                    .await?
                }

                // For non-Ollama providers fall back to a non-streaming call and
                // emit the whole reply as a single chunk.
                ScribeAiProvider::OpenAi(_) => {
                    let reply = provider
                        .chat(messages.clone(), Some(system_prompt.clone()), Some(model.clone()))
                        .await?;
                    let _ = app.emit(
                        "chat-stream-chunk",
                        ChatStreamChunkPayload {
                            stream_id: stream_id.clone(),
                            content: reply.clone(),
                        },
                    );
                    ChatStreamOutcome::Complete { accumulated: reply }
                }
            };

            match stream_outcome {
                ChatStreamOutcome::Cancelled { .. } => {
                    let _ = app.emit(
                        "chat-stream-cancelled",
                        ChatStreamEndPayload { stream_id: stream_id.clone() },
                    );
                    break 'tool_loop Ok(());
                }

                ChatStreamOutcome::Complete { accumulated } => {
                    if let Some(tool_call) = mcp_server::parse_tool_call(&accumulated) {
                        // The response was a tool call — handle it and loop.
                        let tool_result = if let Ok(conn) = db_state.0.lock() {
                            mcp_server::execute_tool(&conn, &tool_call)
                        } else {
                            crate::ai::mcp_protocol::McpToolResult {
                                tool_name: tool_call.name.clone(),
                                success: false,
                                content: "Database unavailable".into(),
                            }
                        };

                        messages.push(ChatMessage {
                            role: "assistant".into(),
                            content: accumulated,
                        });
                        messages.push(ChatMessage {
                            role: "user".into(),
                            content: format!(
                                "Tool result for `{}`:\n{}",
                                tool_result.tool_name, tool_result.content
                            ),
                        });
                        // Continue the tool loop.
                    } else {
                        // Not a tool call — this is the final user-visible
                        // response.  If the content was buffered (starts with
                        // `{` but is not a tool call), emit it now as a single
                        // chunk so the frontend always receives something.
                        if accumulated.trim().starts_with('{') {
                            let _ = app.emit(
                                "chat-stream-chunk",
                                ChatStreamChunkPayload {
                                    stream_id: stream_id.clone(),
                                    content: accumulated,
                                },
                            );
                        }
                        let _ = app.emit(
                            "chat-stream-done",
                            ChatStreamEndPayload { stream_id: stream_id.clone() },
                        );
                        break 'tool_loop Ok(());
                    }
                }
            }
        }

        // Exhausted tool iterations — do a final streaming call without tool hints.
        let stream_outcome = match &provider {
            ScribeAiProvider::Ollama(p) => {
                p.chat_stream(
                    &app,
                    &stream_id,
                    messages.clone(),
                    Some(SYSTEM_CHAT.to_string()),
                    Some(model.clone()),
                    &mut cancel_rx,
                )
                .await?
            }
            ScribeAiProvider::OpenAi(_) => {
                let reply = provider
                    .chat(messages, Some(SYSTEM_CHAT.to_string()), Some(model))
                    .await?;
                let _ = app.emit(
                    "chat-stream-chunk",
                    ChatStreamChunkPayload {
                        stream_id: stream_id.clone(),
                        content: reply.clone(),
                    },
                );
                ChatStreamOutcome::Complete { accumulated: reply }
            }
        };

        match stream_outcome {
            ChatStreamOutcome::Cancelled { .. } => {
                let _ = app.emit(
                    "chat-stream-cancelled",
                    ChatStreamEndPayload { stream_id: stream_id.clone() },
                );
            }
            ChatStreamOutcome::Complete { accumulated } => {
                if accumulated.trim().starts_with('{') {
                    let _ = app.emit(
                        "chat-stream-chunk",
                        ChatStreamChunkPayload {
                            stream_id: stream_id.clone(),
                            content: accumulated,
                        },
                    );
                }
                let _ = app.emit(
                    "chat-stream-done",
                    ChatStreamEndPayload { stream_id: stream_id.clone() },
                );
            }
        }
        Ok(())
    };

    // Always clean up the cancel registration.
    active_streams.0.lock().await.remove(&stream_id);

    outcome
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Returns true if the text appears to reference visual/image content, which
/// should be routed to the vision model rather than the standard explain model.
fn is_vision_content(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("screenshot")
        || lower.contains("image")
        || lower.contains(".png")
        || lower.contains(".jpg")
}

/// Extracts a JSON array from an LLM response that may be wrapped in a
/// markdown code block.
fn extract_json_array(text: &str) -> String {
    let trimmed = text.trim();

    // Strip markdown code fences if present.
    let content = if let Some(start) = trimmed.find("```json") {
        let after = &trimmed[start + 7..];
        after.find("```").map_or(after, |end| &after[..end])
    } else if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        after.find("```").map_or(after, |end| &after[..end])
    } else {
        trimmed
    };

    let content = content.trim();

    // Find the outermost JSON array bounds.
    if let Some(start) = content.find('[') {
        if let Some(end) = content.rfind(']') {
            return content[start..=end].to_string();
        }
    }

    content.to_string()
}
