use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::ai::config::OllamaConfig;
use crate::ai::provider::ChatMessage;

#[derive(Debug, Clone)]
pub struct OllamaProvider {
    config: OllamaConfig,
    client: Client,
}

#[derive(Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
}

#[derive(Serialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessageContent,
}

#[derive(Deserialize)]
struct OllamaMessageContent {
    content: String,
}

// ---------------------------------------------------------------------------
// Streaming types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct OllamaStreamChunk {
    message: OllamaStreamMessage,
    done: bool,
}

#[derive(Deserialize)]
struct OllamaStreamMessage {
    content: String,
}

/// Result of a streaming chat request.
pub enum ChatStreamOutcome {
    /// Stream completed normally; `accumulated` holds the full response text.
    Complete { accumulated: String },
    /// Stream was cancelled by the user; `partial` holds the text received so far.
    Cancelled { partial: String },
}

/// Payload emitted for each streamed chunk.
#[derive(Clone, Serialize)]
pub struct ChatStreamChunkPayload {
    pub stream_id: String,
    pub content: String,
}

impl OllamaProvider {
    pub fn new(config: OllamaConfig, client: Client) -> Self {
        Self { config, client }
    }

    pub async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        model_override: Option<String>,
    ) -> Result<String, String> {
        let mut ollama_messages: Vec<OllamaMessage> = Vec::new();

        if let Some(sys) = system_prompt {
            ollama_messages.push(OllamaMessage {
                role: "system".into(),
                content: sys,
            });
        }

        for msg in messages {
            ollama_messages.push(OllamaMessage {
                role: msg.role,
                content: msg.content,
            });
        }

        let model = model_override
            .as_deref()
            .unwrap_or(&self.config.model)
            .to_string();

        let request = OllamaChatRequest {
            model,
            messages: ollama_messages,
            stream: false,
        };

        let url = format!("{}/api/chat", self.config.endpoint);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .timeout(Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    "ScribeAI: Ollama is not running. Please start Ollama or configure an OpenAI API key in Settings.".to_string()
                } else if e.is_timeout() {
                    "ScribeAI: Request to Ollama timed out. The model may be loading, please try again.".to_string()
                } else {
                    format!("ScribeAI: Failed to connect to Ollama: {e}")
                }
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!(
                "ScribeAI: Ollama returned error {status}: {body}"
            ));
        }

        let resp: OllamaChatResponse = response
            .json()
            .await
            .map_err(|e| format!("ScribeAI: Failed to parse Ollama response: {e}"))?;

        Ok(resp.message.content)
    }

    /// Streams a chat response, emitting `chat-stream-chunk` Tauri events as
    /// each token arrives.  Returns [`ChatStreamOutcome`] so the caller can
    /// detect tool-call JSON (starts with `{`) and decide whether to continue
    /// the MCP tool loop or declare the response final.
    ///
    /// Chunk emission is deferred until the first non-whitespace character is
    /// seen.  If that character is `{` the response is buffered silently and
    /// only returned to the caller; it will not be shown to the user until the
    /// caller confirms it is not a tool-call.  This prevents brief flashes of
    /// JSON in the chat UI.
    pub async fn chat_stream(
        &self,
        app: &tauri::AppHandle,
        stream_id: &str,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        model_override: Option<String>,
        cancel_rx: &mut tokio::sync::oneshot::Receiver<()>,
    ) -> Result<ChatStreamOutcome, String> {
        use futures_util::StreamExt;

        let mut ollama_messages: Vec<OllamaMessage> = Vec::new();

        if let Some(sys) = system_prompt {
            ollama_messages.push(OllamaMessage {
                role: "system".into(),
                content: sys,
            });
        }

        for msg in messages {
            ollama_messages.push(OllamaMessage {
                role: msg.role,
                content: msg.content,
            });
        }

        let model = model_override
            .as_deref()
            .unwrap_or(&self.config.model)
            .to_string();

        let request = OllamaChatRequest {
            model,
            messages: ollama_messages,
            stream: true,
        };

        let url = format!("{}/api/chat", self.config.endpoint);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .timeout(Duration::from_secs(300))
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    "ScribeAI: Ollama is not running. Please start Ollama or configure an OpenAI API key in Settings.".to_string()
                } else if e.is_timeout() {
                    "ScribeAI: Request to Ollama timed out. The model may be loading, please try again.".to_string()
                } else {
                    format!("ScribeAI: Failed to connect to Ollama: {e}")
                }
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!(
                "ScribeAI: Ollama returned error {status}: {body}"
            ));
        }

        let mut byte_stream = response.bytes_stream();
        let mut accumulated = String::new();
        // Line-level buffer for incomplete NDJSON lines across byte chunks.
        let mut line_buf = String::new();
        // Whether we have determined the response is NOT a tool-call and have
        // started emitting chunks to the frontend.
        let mut emitting = false;
        // Whether we have seen at least one non-whitespace character yet.
        let mut detected_start = false;

        loop {
            tokio::select! {
                biased;

                // Cancellation takes priority over incoming data.
                _ = &mut *cancel_rx => {
                    return Ok(ChatStreamOutcome::Cancelled { partial: accumulated });
                }

                chunk = byte_stream.next() => {
                    match chunk {
                        Some(Ok(bytes)) => {
                            line_buf.push_str(&String::from_utf8_lossy(&bytes));

                            // Process every complete newline-delimited JSON line.
                            while let Some(nl) = line_buf.find('\n') {
                                let line: String = line_buf[..nl].trim().to_string();
                                line_buf = line_buf[nl + 1..].to_string();

                                if line.is_empty() {
                                    continue;
                                }

                                let parsed = match serde_json::from_str::<OllamaStreamChunk>(&line) {
                                    Ok(p) => p,
                                    Err(_) => continue,
                                };

                                let delta = parsed.message.content.clone();
                                accumulated.push_str(&delta);

                                // On the first non-empty content decide whether to emit.
                                if !detected_start && !accumulated.trim().is_empty() {
                                    detected_start = true;
                                    // Responses that start with '{' are potential tool-calls
                                    // and are buffered silently.
                                    emitting = !accumulated.trim().starts_with('{');
                                    if emitting {
                                        // Emit everything accumulated up to this point.
                                        let _ = app.emit(
                                            "chat-stream-chunk",
                                            ChatStreamChunkPayload {
                                                stream_id: stream_id.to_string(),
                                                content: accumulated.clone(),
                                            },
                                        );
                                    }
                                } else if emitting && !delta.is_empty() {
                                    let _ = app.emit(
                                        "chat-stream-chunk",
                                        ChatStreamChunkPayload {
                                            stream_id: stream_id.to_string(),
                                            content: delta,
                                        },
                                    );
                                }

                                if parsed.done {
                                    return Ok(ChatStreamOutcome::Complete { accumulated });
                                }
                            }
                        }
                        Some(Err(e)) => {
                            return Err(format!("ScribeAI: Stream error: {e}"));
                        }
                        None => {
                            // Stream ended without a done:true frame.
                            return Ok(ChatStreamOutcome::Complete { accumulated });
                        }
                    }
                }
            }
        }
    }

    /// Checks whether Ollama is reachable by calling the `/api/tags` endpoint.
    pub async fn check_connection(&self) -> Result<bool, String> {
        let url = format!("{}/api/tags", self.config.endpoint);

        match self
            .client
            .get(&url)
            .timeout(Duration::from_secs(1))
            .send()
            .await
        {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(e) if e.is_connect() || e.is_timeout() => Ok(false),
            Err(e) => Err(format!("ScribeAI: Connection check failed: {e}")),
        }
    }

    pub fn name(&self) -> &str {
        "ollama"
    }
}

/// Lists all models installed in the Ollama server by querying `/api/tags`.
pub async fn list_models(endpoint: &str, client: &reqwest::Client) -> Result<Vec<String>, String> {
    #[derive(serde::Deserialize)]
    struct TagsResp {
        models: Vec<Model>,
    }
    #[derive(serde::Deserialize)]
    struct Model {
        name: String,
    }

    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Ollama at {url}: {e}"))?;
    let body: TagsResp = resp
        .json()
        .await
        .map_err(|e| format!("Invalid response from Ollama /api/tags: {e}"))?;
    Ok(body.models.into_iter().map(|m| m.name).collect())
}
