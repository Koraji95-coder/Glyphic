use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::ai::config::OpenAiConfig;
use crate::ai::provider::ChatMessage;

#[derive(Debug, Clone)]
pub struct OpenAiProvider {
    config: OpenAiConfig,
    client: Client,
}

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
}

#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessageContent,
}

#[derive(Deserialize)]
struct OpenAiMessageContent {
    content: String,
}

impl OpenAiProvider {
    pub fn new(config: OpenAiConfig, client: Client) -> Self {
        Self { config, client }
    }

    pub async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        model_override: Option<String>,
    ) -> Result<String, String> {
        if self.config.api_key.is_empty() {
            return Err("ScribeAI: No OpenAI API key configured. Please add your API key in Settings.".to_string());
        }

        let mut openai_messages: Vec<OpenAiMessage> = Vec::new();

        if let Some(sys) = system_prompt {
            openai_messages.push(OpenAiMessage {
                role: "system".into(),
                content: sys,
            });
        }

        for msg in messages {
            openai_messages.push(OpenAiMessage {
                role: msg.role,
                content: msg.content,
            });
        }

        let model = model_override
            .as_deref()
            .unwrap_or(&self.config.model)
            .to_string();

        let request = OpenAiRequest {
            model,
            messages: openai_messages,
        };

        let url = format!("{}/chat/completions", self.config.endpoint);

        let response = self
            .client
            .post(&url)
            .header(
                "Authorization",
                format!("Bearer {}", self.config.api_key),
            )
            .json(&request)
            .timeout(Duration::from_secs(60))
            .send()
            .await
            .map_err(|e| format!("ScribeAI: Failed to connect to OpenAI: {e}"))?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return match status.as_u16() {
                401 => Err("ScribeAI: Invalid OpenAI API key. Please check your key in Settings.".to_string()),
                429 => Err("ScribeAI: OpenAI rate limit reached. Please try again later.".to_string()),
                _ => Err(format!("ScribeAI: OpenAI returned error {status}: {body}")),
            };
        }

        let resp: OpenAiResponse = response
            .json()
            .await
            .map_err(|e| format!("ScribeAI: Failed to parse OpenAI response: {e}"))?;

        resp.choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .ok_or_else(|| "ScribeAI: OpenAI returned an empty response.".to_string())
    }

    /// Checks whether the OpenAI API is reachable with the configured key.
    pub async fn check_connection(&self) -> Result<bool, String> {
        if self.config.api_key.is_empty() {
            return Ok(false);
        }

        let url = format!("{}/models", self.config.endpoint);

        match self
            .client
            .get(&url)
            .header(
                "Authorization",
                format!("Bearer {}", self.config.api_key),
            )
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }

    pub fn name(&self) -> &str {
        "openai"
    }
}
