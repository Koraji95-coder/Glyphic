/// study.rs — Orchestrates semantic vault search + local LLM inference in one
/// Tauri command, and provides AI-powered math-answer grading.
///
/// Commands exposed:
///   • `study_ask`         — semantic search → context → Ollama answer + sources
///   • `grade_math_answer` — AI grades a student's engineering/math answer
use serde_json::json;
use tauri::{AppHandle, State};

use crate::ai::config::OllamaConfig;
use crate::ai::ollama::OllamaProvider;
use crate::ai::provider::ChatMessage;
use crate::commands::ai_commands::AiState;

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_STUDY_QA: &str = "You are ScribeAI, a study assistant for STEM \
students preparing for professional engineering exams (FE/PE). \
Answer the question using the provided study material context whenever it is \
relevant. If the context is insufficient, say so and answer from first principles. \
- Always typeset math in LaTeX inside `$...$` (inline) or `$$...$$` (block). \
- Include units in all answers and intermediate steps. \
- For derivations, show step-by-step work; do not skip algebra. \
Format your response in markdown.";

const SYSTEM_GRADER: &str = "You are a strict but fair STEM exam grader. \
Given a problem, the student's submitted answer, and the reference correct answer, \
evaluate the student's work step by step. \
Respond ONLY with a JSON object — no markdown fences, no extra commentary — \
using this exact schema:\n\
{\"verdict\": \"correct\"|\"partial\"|\"incorrect\", \"score\": <integer 0-100>, \
\"feedback\": \"<detailed explanation; use LaTeX $...$ for inline math>\"}";

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Build an `OllamaProvider` from `AiState`, honouring an optional model override.
fn ollama_from_state(state: &AiState, model_override: Option<String>) -> (OllamaProvider, String) {
    let (endpoint, model) = {
        let config = state.config.lock().unwrap();
        let endpoint = config.ollama.endpoint.clone();
        let model = model_override.unwrap_or_else(|| config.model_routing.chat.clone());
        (endpoint, model)
    };
    let provider = OllamaProvider::new(
        OllamaConfig {
            endpoint,
            model: model.clone(),
        },
        state.client.clone(),
    );
    (provider, model)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Orchestrates semantic vault search + local Ollama inference in one call.
///
/// 1. Queries the vault engine for the top `n_results` semantically relevant
///    chunks (filtered by `topic_filter` when provided).
/// 2. Prepends those chunks as grounded context to the LLM system prompt.
/// 3. Sends the `question` to the local Ollama model.
/// 4. Returns `{ answer: String, sources: [{text, source_label, …}] }`.
#[tauri::command]
pub async fn study_ask(
    app: AppHandle,
    question: String,
    topic_filter: Option<Vec<String>>,
    n_results: Option<u32>,
    model_override: Option<String>,
    state: State<'_, AiState>,
) -> Result<serde_json::Value, String> {
    // ── 1. Semantic search via vault engine ───────────────────────────────────
    let search_req = json!({
        "action": "query",
        "question": question,
        "topic_filter": topic_filter.unwrap_or_default(),
        "n_results": n_results.unwrap_or(5),
    });

    let sources: Vec<serde_json::Value> =
        match super::vault_study::run_vault_engine(&app, search_req, None).await {
            Ok(v) => v
                .get("results")
                .and_then(|r| r.as_array())
                .cloned()
                .unwrap_or_default(),
            Err(_) => vec![], // vault engine not running — proceed without context
        };

    // ── 2. Build grounded context string ─────────────────────────────────────
    let context: String = sources
        .iter()
        .filter_map(|s| {
            let text = s.get("text")?.as_str()?;
            let label = s
                .get("source_label")
                .and_then(|l| l.as_str())
                .unwrap_or("source");
            Some(format!("[{label}]: {text}"))
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    // ── 3. Build system prompt ────────────────────────────────────────────────
    let mut system = SYSTEM_STUDY_QA.to_string();
    if !context.is_empty() {
        system.push_str("\n\n## Relevant Study Material\n\n");
        system.push_str(&context);
    }

    // ── 4. Call local Ollama ──────────────────────────────────────────────────
    let (provider, model) = ollama_from_state(&state, model_override);
    let messages = vec![ChatMessage {
        role: "user".into(),
        content: question,
    }];
    let answer = provider.chat(messages, Some(system), Some(model)).await?;

    Ok(json!({ "answer": answer, "sources": sources }))
}

/// Grades a student's math / engineering answer using a local Ollama model.
///
/// The model is instructed to return a JSON object:
/// `{ verdict: "correct"|"partial"|"incorrect", score: 0–100, feedback: "…" }`
///
/// If the model returns non-JSON prose, the raw text is wrapped in the
/// `feedback` field with `verdict="unknown"` and `score=0` so the frontend
/// always receives a well-shaped object.
#[tauri::command]
pub async fn grade_math_answer(
    problem: String,
    user_answer: String,
    correct_answer: String,
    model_override: Option<String>,
    state: State<'_, AiState>,
) -> Result<serde_json::Value, String> {
    let (provider, model) = ollama_from_state(&state, model_override);

    let user_content = format!(
        "Problem:\n{problem}\n\nStudent's Answer:\n{user_answer}\n\nCorrect Answer:\n{correct_answer}"
    );
    let messages = vec![ChatMessage {
        role: "user".into(),
        content: user_content,
    }];
    let raw = provider
        .chat(messages, Some(SYSTEM_GRADER.to_string()), Some(model))
        .await?;

    // Strip markdown fences if the model wrapped the JSON anyway
    let stripped = strip_json_object(&raw);

    let parsed: serde_json::Value = serde_json::from_str(stripped).unwrap_or_else(|_| {
        json!({
            "verdict": "unknown",
            "score": 0,
            "feedback": stripped,
        })
    });

    Ok(parsed)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Remove markdown code fences and return a slice pointing at the JSON object
/// content.  Falls back to the full trimmed string if no braces are found.
fn strip_json_object(text: &str) -> &str {
    let trimmed = text.trim();
    // Strip ``` … ``` fences
    let content = if let Some(s) = trimmed.find("```json") {
        let after = &trimmed[s + 7..];
        after.find("```").map_or(after, |e| &after[..e])
    } else if let Some(s) = trimmed.find("```") {
        let after = &trimmed[s + 3..];
        after.find("```").map_or(after, |e| &after[..e])
    } else {
        trimmed
    };
    let content = content.trim();
    // Extract outermost { … }
    if let Some(start) = content.find('{') {
        if let Some(end) = content.rfind('}') {
            return &content[start..=end];
        }
    }
    content
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_plain_json() {
        let s = r#"{"verdict":"correct","score":90,"feedback":"good"}"#;
        assert_eq!(strip_json_object(s), s);
    }

    #[test]
    fn strip_fenced_json() {
        let s = "```json\n{\"verdict\":\"partial\",\"score\":50,\"feedback\":\"ok\"}\n```";
        let stripped = strip_json_object(s);
        let v: serde_json::Value = serde_json::from_str(stripped).expect("valid json");
        assert_eq!(v["verdict"], "partial");
    }

    #[test]
    fn strip_fenced_no_lang() {
        let s = "```\n{\"verdict\":\"incorrect\",\"score\":10,\"feedback\":\"wrong\"}\n```";
        let stripped = strip_json_object(s);
        let v: serde_json::Value = serde_json::from_str(stripped).expect("valid json");
        assert_eq!(v["score"], 10);
    }

    #[test]
    fn strip_prose_with_braces() {
        let s =
            "Here is the result: {\"verdict\":\"correct\",\"score\":100,\"feedback\":\"perfect\"}";
        let stripped = strip_json_object(s);
        let v: serde_json::Value = serde_json::from_str(stripped).expect("valid json");
        assert_eq!(v["verdict"], "correct");
    }

    #[test]
    fn strip_falls_back_on_no_braces() {
        let s = "  plain text  ";
        assert_eq!(strip_json_object(s), "plain text");
    }
}
