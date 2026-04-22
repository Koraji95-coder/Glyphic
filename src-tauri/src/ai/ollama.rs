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

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/// Progress payload emitted as `ollama-pull-progress` during `pull_model_stream`.
#[derive(serde::Serialize, Clone)]
pub struct PullProgress {
    pub model: String,
    pub status: String,
    pub completed: Option<u64>,
    pub total: Option<u64>,
}

/// Streams `POST /api/pull` for `model`, emitting `ollama-pull-progress` events
/// via `app.emit` for each NDJSON line.  Returns `Ok(())` on `{"status":"success"}`.
pub async fn pull_model_stream(
    app: &tauri::AppHandle,
    model: &str,
    endpoint: &str,
    client: &reqwest::Client,
) -> Result<(), String> {
    use tauri::Emitter;

    let url = format!("{}/api/pull", endpoint.trim_end_matches('/'));
    let body = serde_json::json!({ "name": model, "stream": true });

    let mut response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Ollama: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama /api/pull returned {status}: {body_text}"));
    }

    let mut buffer = String::new();

    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Stream read error: {e}"))? {
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process every complete NDJSON line in the buffer.
        while let Some(nl) = buffer.find('\n') {
            let line = buffer[..nl].trim().to_string();
            buffer = buffer[nl + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) {
                let status = value.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let completed = value.get("completed").and_then(|v| v.as_u64());
                let total = value.get("total").and_then(|v| v.as_u64());

                let _ = app.emit(
                    "ollama-pull-progress",
                    PullProgress { model: model.to_string(), status: status.clone(), completed, total },
                );

                if status == "success" {
                    return Ok(());
                }
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

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
