use std::sync::Mutex;

use tauri::State;

use crate::ai::config::AiConfig;
use crate::ai::mcp_server;
use crate::ai::provider::{ChatMessage, ScribeAiProvider};
use crate::DbState;

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

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ai_chat(
    message: String,
    note_context: Option<String>,
    state: State<'_, AiState>,
    db_state: State<'_, DbState>,
) -> Result<String, String> {
    let provider = state.provider();

    // Build system prompt, optionally enriched with vault context (RAG).
    let system_prompt = {
        let mut system = SYSTEM_CHAT.to_string();

        // Search vault via FTS5 — must complete before any `.await`.
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

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: message,
    }];

    provider.chat(messages, Some(system_prompt)).await
}

#[tauri::command]
pub async fn ai_summarize(
    note_content: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let provider = state.provider();

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: note_content,
    }];

    provider.chat(messages, Some(SYSTEM_SUMMARIZE.to_string())).await
}

#[tauri::command]
pub async fn ai_flashcards(
    note_content: String,
    state: State<'_, AiState>,
) -> Result<Vec<serde_json::Value>, String> {
    let provider = state.provider();

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: note_content,
    }];

    let response = provider
        .chat(messages, Some(SYSTEM_FLASHCARDS.to_string()))
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

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: text,
    }];

    provider.chat(messages, Some(SYSTEM_EXPLAIN.to_string())).await
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
    config: AiConfig,
    state: State<'_, AiState>,
) -> Result<(), String> {
    let mut current = state
        .config
        .lock()
        .map_err(|e| format!("Failed to lock AI config: {e}"))?;
    *current = config;
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
