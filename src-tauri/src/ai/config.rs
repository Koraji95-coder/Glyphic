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

/// Per-task model routing — each AI task type can use a different model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRouting {
    pub chat: String,
    pub summarize: String,
    pub flashcards: String,
    pub explain: String,
    pub vision: String,
}

impl Default for ModelRouting {
    fn default() -> Self {
        Self {
            chat: "llama3.1".into(),
            summarize: "llama3.1".into(),
            flashcards: "llama3.1".into(),
            explain: "deepseek-r1:32b".into(),
            vision: "llava:13b".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: AiProvider,
    pub ollama: OllamaConfig,
    pub openai: OpenAiConfig,
    pub model_routing: ModelRouting,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: AiProvider::Ollama,
            ollama: OllamaConfig {
                endpoint: "http://localhost:11434".into(),
                model: "llama3.1".into(),
            },
            openai: OpenAiConfig {
                api_key: String::new(),
                model: "gpt-4o-mini".into(),
                endpoint: "https://api.openai.com/v1".into(),
            },
            model_routing: ModelRouting::default(),
        }
    }
}
