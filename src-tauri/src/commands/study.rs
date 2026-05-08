/// study.rs — Orchestrates semantic vault search + local LLM inference in one
/// Tauri command, and provides AI-powered math-answer grading, step-by-step
/// math solving, and practice problem generation.
///
/// Commands exposed:
///   • `study_ask`          — semantic search → context → Ollama answer + sources
///   • `grade_math_answer`  — AI grades a student's engineering/math answer
///   • `solve_math`         — step-by-step LaTeX solution for a math problem
///   • `generate_problems`  — practice problem generation by topic and difficulty
use std::path::PathBuf;

use serde_json::json;
use tauri::{AppHandle, Manager, State};

use crate::commands::ai_commands::AiState;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn study_engine_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("failed to resolve resource_dir: {e}"))?;
    let script = resource_dir
        .join("sidecars")
        .join("study_engine")
        .join("main.py");
    if script.exists() {
        Ok(script)
    } else {
        Err(format!(
            "study engine not found at {}",
            script.display()
        ))
    }
}

fn study_python_cmd(app: &AppHandle) -> (std::ffi::OsString, Vec<std::ffi::OsString>) {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let shim = resource_dir.join("sidecars").join("study_engine_launcher");
        if shim.exists() {
            return (shim.into_os_string(), vec![]);
        }
    }
    if let Ok(script) = study_engine_path(app) {
        return (
            std::ffi::OsString::from("python3"),
            vec![script.into_os_string()],
        );
    }
    (std::ffi::OsString::from("python3"), vec![])
}

async fn run_study_engine(app: &AppHandle, request: serde_json::Value) -> Result<serde_json::Value, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::process::Command;

    let (cmd, extra_args) = study_python_cmd(app);
    let mut child = Command::new(&cmd)
        .args(&extra_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn study engine: {e}"))?;

    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "failed to open study engine stdin".to_string())?;
        let req_str = request.to_string() + "\n";
        stdin
            .write_all(req_str.as_bytes())
            .await
            .map_err(|e| format!("failed to write to study engine: {e}"))?;
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to open study engine stdout".to_string())?;
    let mut lines = BufReader::new(stdout).lines();
    let mut last_obj: Option<serde_json::Value> = None;
    let mut error_message: Option<String> = None;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }

        let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };

        match obj.get("event").and_then(|v| v.as_str()) {
            Some("error") => {
                error_message = Some(
                    obj.get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("study engine returned error event")
                        .to_string(),
                );
            }
            Some("final") => {
                if let Some(payload) = obj.get("payload") {
                    last_obj = Some(payload.clone());
                }
            }
            _ => {
                last_obj = Some(obj);
            }
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("failed waiting for study engine: {e}"))?;
    if let Some(message) = error_message {
        return Err(message);
    }
    if !status.success() {
        return Err(format!("study engine exited with status {status}"));
    }
    last_obj.ok_or_else(|| "no response from study engine".to_string())
}

fn study_model_endpoint_from_state(
    state: &AiState,
    model_override: Option<String>,
) -> (String, String) {
    let (endpoint, model) = {
        let config = state.config.lock().unwrap();
        let endpoint = config.ollama.endpoint.clone();
        let model = model_override.unwrap_or_else(|| config.model_routing.chat.clone());
        (endpoint, model)
    };
    (endpoint, model)
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
        "question": &question,
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

    // ── 2. Call study sidecar (local Ollama) ─────────────────────────────────
    let (endpoint, model) = study_model_endpoint_from_state(&state, model_override);
    let sidecar_req = json!({
        "action": "study_ask",
        "question": &question,
        "sources": &sources,
        "endpoint": endpoint,
        "model": model,
    });
    let sidecar_resp = run_study_engine(&app, sidecar_req).await?;
    let answer = sidecar_resp
        .get("answer")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "study engine response missing 'answer'".to_string())?
        .to_string();

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
    app: AppHandle,
    problem: String,
    user_answer: String,
    correct_answer: String,
    model_override: Option<String>,
    state: State<'_, AiState>,
) -> Result<serde_json::Value, String> {
    let (endpoint, model) = study_model_endpoint_from_state(&state, model_override);
    let req = json!({
        "action": "grade_math_answer",
        "problem": problem,
        "user_answer": user_answer,
        "correct_answer": correct_answer,
        "endpoint": endpoint,
        "model": model,
    });
    run_study_engine(&app, req).await
}

/// Generates a step-by-step LaTeX solution for a math or engineering problem.
///
/// Returns `{ solution: String }` where the solution is typeset in LaTeX/KaTeX.
#[tauri::command]
pub async fn solve_math(
    app: AppHandle,
    problem: String,
    model_override: Option<String>,
    state: State<'_, AiState>,
) -> Result<serde_json::Value, String> {
    let (endpoint, model) = study_model_endpoint_from_state(&state, model_override);
    let req = json!({
        "action": "solve_math",
        "problem": problem,
        "endpoint": endpoint,
        "model": model,
    });
    run_study_engine(&app, req).await
}

/// Generates practice problems for a given STEM topic and difficulty level.
///
/// Returns `{ problems: [{ statement: String, answer: String }] }`.
///
/// `difficulty` defaults to `"medium"` if not provided.
/// `count` defaults to `5` if not provided (max 20).
#[tauri::command]
pub async fn generate_problems(
    app: AppHandle,
    topic: String,
    difficulty: Option<String>,
    count: Option<u32>,
    model_override: Option<String>,
    state: State<'_, AiState>,
) -> Result<serde_json::Value, String> {
    let (endpoint, model) = study_model_endpoint_from_state(&state, model_override);
    let req = json!({
        "action": "generate_problems",
        "topic": topic,
        "difficulty": difficulty.unwrap_or_else(|| "medium".to_string()),
        "count": count.unwrap_or(5),
        "endpoint": endpoint,
        "model": model,
    });
    run_study_engine(&app, req).await
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
