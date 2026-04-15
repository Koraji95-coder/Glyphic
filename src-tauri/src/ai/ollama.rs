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

        let request = OllamaChatRequest {
            model: self.config.model.clone(),
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
