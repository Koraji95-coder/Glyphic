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
        // Defaults are tuned for studying STEM material with locally-runnable
        // ~7B Ollama models. `qwen2.5` punches above its weight on math/
        // reasoning, which is why it backs `flashcards` and `explain`.
        Self {
            chat: "llama3.1:8b".into(),
            summarize: "llama3.1:8b".into(),
            flashcards: "qwen2.5:7b".into(),
            explain: "qwen2.5:7b".into(),
            vision: "llava:7b".into(),
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
                model: "llama3.1:8b".into(),
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

use std::path::Path;

/// Load AI config from `<vault>/.glyphic/ai.toml`. Returns `None` if the file
/// is missing or unparseable — the caller should fall back to `AiConfig::default()`.
pub fn load(vault_path: &Path) -> Option<AiConfig> {
    let p = vault_path.join(".glyphic").join("ai.toml");
    let s = std::fs::read_to_string(p).ok()?;
    toml::from_str(&s).ok()
}

/// Save AI config to `<vault>/.glyphic/ai.toml`. Creates the `.glyphic`
/// directory if it does not already exist.
pub fn save(vault_path: &Path, config: &AiConfig) -> Result<(), String> {
    let dir = vault_path.join(".glyphic");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = dir.join("ai.toml");
    let s = toml::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(p, s).map_err(|e| e.to_string())
}
