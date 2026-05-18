use std::sync::Mutex;

use tauri::{State};
use serde::{Serialize, Deserialize};

use crate::ai::config::AiConfig;
use crate::ai::provider::{ChatMessage, ScribeAiProvider};

// Maximum number of tool-calling iterations per chat message to prevent loops.
// ---------------------------------------------------------------------------
// Phase 3: Enhanced Response Types with Metadata
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceTrace {
    pub note_id: String,
    pub note_title: String,
    pub context: String,
    pub relevance_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecution {
    pub tool_name: String,
    pub success: bool,
    pub result: String,
}

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

    /// Safely access the config, converting mutex poison errors to strings.
    pub fn get_config(&self) -> Result<AiConfig, String> {
        self.config
            .lock()
            .map(|guard| guard.clone())
            .map_err(|e| format!("Failed to acquire config lock: {}", e))
    }

    /// Build the appropriate provider from the current config.
    pub fn provider(&self) -> Result<ScribeAiProvider, String> {
        let config = self.get_config()?;
        Ok(ScribeAiProvider::from_config(&config, self.client.clone()))
    }
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_SUMMARIZE: &str = "You are ScribeAI. Summarize the following \
student notes into a concise, well-structured summary suitable for exam \
review. Use bullet points. Keep it under 200 words. Highlight key formulas \
(kept as LaTeX), definitions, and takeaways.";

const SYSTEM_FLASHCARDS: &str = "You are ScribeAI. Generate study flashcards \
from the following notes. Return a JSON array of objects with \"question\" and \
\"answer\" fields. Generate 5-10 flashcards covering the key concepts, \
formulas, and definitions. Make questions specific; keep answers concise but \
include units and LaTeX (`$...$`) where appropriate. Return only the JSON \
array, no other text.";

const SYSTEM_EXPLAIN: &str = "You are ScribeAI explaining a STEM concept or \
expression to a college student. \
- If the input is a formula or equation, identify each symbol, state units, \
  and walk through the derivation or intuition step by step. \
- If it's a concept, give a one-sentence definition, then a worked example. \
- Keep math in LaTeX (`$...$` inline, `$$...$$` block). \
- Be precise: don't hand-wave through steps that involve algebra or unit \
  conversions.";

const SYSTEM_VISION: &str = "You are ScribeAI, a visual study assistant for \
STEM coursework. Describe and explain the content of this lecture screenshot \
in detail. Identify any diagrams (circuits, free-body diagrams, plots), \
equations, or key concepts. Transcribe equations as LaTeX. Break down complex \
visuals step by step and state what the student should take away.";

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ai_summarize(
    note_content: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let provider = state.provider()?;
    let model = {
        let config = state.get_config()?;
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
    let provider = state.provider()?;
    let model = {
        let config = state.get_config()?;
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
    let provider = state.provider()?;
    let model = {
        let config = state.get_config()?;
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
    let provider = state.provider()?;
    let model = {
        let config = state.get_config()?;
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
    state.provider()?.check_connection().await
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

#[tauri::command]
pub async fn pull_model(
    app: tauri::AppHandle,
    model: String,
    state: State<'_, AiState>,
) -> Result<(), String> {
    let endpoint = {
        let cfg = state.config.lock().map_err(|e| format!("AI config lock: {e}"))?;
        cfg.ollama.endpoint.clone()
    };
    crate::ai::ollama::pull_model_stream(&app, &model, &endpoint, &state.client).await
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

// ---------------------------------------------------------------------------
// Local-only study chat (enforces Ollama regardless of global provider setting)
// ---------------------------------------------------------------------------

const SYSTEM_STUDY: &str = "You are ScribeAI, a study assistant for STEM students \
preparing for professional engineering exams (FE/PE). Your goal is to generate \
high-quality, exam-relevant practice questions and provide clear, step-by-step \
answers. \
- Always typeset math in LaTeX inside `$...$` (inline) or `$$...$$` (block). \
- Include units in all answers and intermediate steps. \
- For derivations, show step-by-step work; don't skip algebra. \
Format your responses with markdown.";

/// Like `ai_chat` but always routes to the local Ollama provider, ignoring
/// any cloud-provider configuration.  Used by FE Prep and Study mode so that
/// practice sessions never send exam content to external services.
#[tauri::command]
pub async fn ai_study_chat(
    message: String,
    note_context: Option<String>,
    model_override: Option<String>,
    state: State<'_, AiState>,
) -> Result<String, String> {
    let config = state.get_config()?;
    let endpoint = config.ollama.endpoint.clone();
    let model = model_override.unwrap_or_else(|| config.model_routing.chat.clone());

    let ollama_cfg = crate::ai::config::OllamaConfig { endpoint, model: model.clone() };
    let provider = crate::ai::ollama::OllamaProvider::new(ollama_cfg, state.client.clone());

    let mut system = SYSTEM_STUDY.to_string();
    if let Some(ctx) = &note_context {
        if !ctx.is_empty() {
            system.push_str("\n\nRelevant study material:\n");
            system.push_str(ctx);
        }
    }

    let messages = vec![ChatMessage {
        role: "user".into(),
        content: message,
    }];

    provider.chat(messages, Some(system), Some(model)).await
}
