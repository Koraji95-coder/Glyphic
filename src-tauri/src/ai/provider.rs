// Provider pattern inspired by ZeroClaw's provider trait abstraction.
// Routes AI requests to either Ollama (local/offline) or OpenAI (cloud).

use crate::ai::config::{AiConfig, AiProvider};
use crate::ai::ollama::OllamaProvider;
use crate::ai::openai::OpenAiProvider;

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Enum-based provider dispatcher — selects Ollama or OpenAI based on `AiConfig`.
pub enum ScribeAiProvider {
    Ollama(OllamaProvider),
    OpenAi(OpenAiProvider),
}

impl ScribeAiProvider {
    pub fn from_config(config: &AiConfig, client: reqwest::Client) -> Self {
        match config.provider {
            AiProvider::Ollama => {
                Self::Ollama(OllamaProvider::new(config.ollama.clone(), client))
            }
            AiProvider::OpenAi => {
                Self::OpenAi(OpenAiProvider::new(config.openai.clone(), client))
            }
        }
    }

    pub async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        model_override: Option<String>,
    ) -> Result<String, String> {
        match self {
            Self::Ollama(p) => p.chat(messages, system_prompt, model_override).await,
            Self::OpenAi(p) => p.chat(messages, system_prompt, model_override).await,
        }
    }

    pub async fn check_connection(&self) -> Result<bool, String> {
        match self {
            Self::Ollama(p) => p.check_connection().await,
            Self::OpenAi(p) => p.check_connection().await,
        }
    }

    pub fn name(&self) -> &str {
        match self {
            Self::Ollama(p) => p.name(),
            Self::OpenAi(p) => p.name(),
        }
    }
}
