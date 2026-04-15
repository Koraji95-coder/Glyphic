use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AiProvider {
    Ollama,
    OpenAi,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaConfig {
    pub endpoint: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiConfig {
    pub api_key: String,
    pub model: String,
    pub endpoint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: AiProvider,
    pub ollama: OllamaConfig,
    pub openai: OpenAiConfig,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: AiProvider::Ollama,
            ollama: OllamaConfig {
                endpoint: "http://localhost:11434".into(),
                model: "llama3.2:3b".into(),
            },
            openai: OpenAiConfig {
                api_key: String::new(),
                model: "gpt-4o-mini".into(),
                endpoint: "https://api.openai.com/v1".into(),
            },
        }
    }
}
