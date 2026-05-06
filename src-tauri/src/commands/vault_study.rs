use std::path::PathBuf;

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

// ── Path resolution ───────────────────────────────────────────────────────────

/// Resolve the path to the vault engine Python script.
/// In Tauri 2.0 use app.path() not app.path_resolver().
fn vault_engine_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("failed to resolve resource_dir: {e}"))?;
    let script = resource_dir
        .join("sidecars")
        .join("vault_engine")
        .join("main.py");
    if script.exists() {
        Ok(script)
    } else {
        Err(format!(
            "vault engine not found at {}",
            script.display()
        ))
    }
}

// ── Sidecar runner ────────────────────────────────────────────────────────────

/// Spawn the vault engine sidecar, send one JSON request on stdin and collect
/// all JSON responses from stdout.
///
/// Lines whose `status` field is `"progress"` are forwarded to the frontend
/// via `emit_event` (if provided) and consumed. The last non-progress object
/// is returned as the final result.
///
/// In Tauri 2.0, `app.emit()` replaces `app.emit_all()`.
async fn run_vault_engine(
    app: &AppHandle,
    request: serde_json::Value,
    emit_event: Option<&str>,
) -> Result<serde_json::Value, String> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::process::{Command, Stdio};

    let script = vault_engine_path(app)?;

    let mut child = Command::new("python3")
        .arg(&script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn vault engine: {e}"))?;

    // Write request then close stdin so the sidecar knows input is done
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "failed to open sidecar stdin".to_string())?;
        let req_str = request.to_string() + "\n";
        stdin
            .write_all(req_str.as_bytes())
            .await
            .map_err(|e| format!("failed to write to sidecar: {e}"))?;
        // stdin is dropped here, closing the pipe
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to open sidecar stdout".to_string())?;
    let mut lines = BufReader::new(stdout).lines();
    let mut last_obj: Option<serde_json::Value> = None;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim_end().to_string();
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(obj) => {
                // Forward progress events to the frontend
                if let Some(event) = emit_event {
                    if obj
                        .get("status")
                        .and_then(|s| s.as_str())
                        .map(|s| s == "progress")
                        .unwrap_or(false)
                    {
                        // In Tauri 2.0: app.emit() not app.emit_all()
                        let _ = app.emit(event, obj.clone());
                        continue;
                    }
                }
                last_obj = Some(obj);
            }
            Err(_) => continue, // ignore non-JSON lines (e.g. startup noise)
        }
    }

    let _ = child.wait().await;
    last_obj.ok_or_else(|| "no response from vault engine".to_string())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ingest_document(
    app: AppHandle,
    path: String,
    topic_tags: Vec<String>,
    label: Option<String>,
) -> Result<serde_json::Value, String> {
    let req = json!({
        "action": "ingest",
        "path": path,
        "topic_tags": topic_tags,
        "source_label": label.unwrap_or_else(|| "document".into()),
    });
    run_vault_engine(&app, req, Some("vault-ingest-progress")).await
}

#[tauri::command]
pub async fn ingest_url(
    app: AppHandle,
    url: String,
    topic_tags: Vec<String>,
    label: Option<String>,
) -> Result<serde_json::Value, String> {
    let label_str = label.unwrap_or_else(|| url.clone());
    let req = json!({
        "action": "ingest_url",
        "url": url,
        "topic_tags": topic_tags,
        "source_label": label_str,
    });
    run_vault_engine(&app, req, Some("vault-ingest-progress")).await
}

#[tauri::command]
pub async fn query_vault(
    app: AppHandle,
    question: String,
    topic_filter: Option<Vec<String>>,
    n_results: Option<u32>,
) -> Result<serde_json::Value, String> {
    let req = json!({
        "action": "query",
        "question": question,
        "topic_filter": topic_filter.unwrap_or_default(),
        "n_results": n_results.unwrap_or(5),
    });
    run_vault_engine(&app, req, None).await
}

#[tauri::command]
pub async fn search_vault(
    app: AppHandle,
    keywords: String,
    topic_filter: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let req = json!({
        "action": "search",
        "keywords": keywords,
        "topic_filter": topic_filter.unwrap_or_default(),
    });
    run_vault_engine(&app, req, None).await
}

#[tauri::command]
pub async fn list_vault_sources(app: AppHandle) -> Result<serde_json::Value, String> {
    let req = json!({ "action": "list_sources" });
    run_vault_engine(&app, req, None).await
}

#[tauri::command]
pub async fn delete_vault_source(
    app: AppHandle,
    source_id: String,
) -> Result<serde_json::Value, String> {
    let req = json!({ "action": "delete_source", "source_id": source_id });
    run_vault_engine(&app, req, None).await
}

#[tauri::command]
pub async fn generate_flashcards(
    app: AppHandle,
    source_id: String,
    n: Option<u32>,
) -> Result<serde_json::Value, String> {
    let req = json!({
        "action": "generate_flashcards",
        "source_id": source_id,
        "n": n.unwrap_or(5),
    });
    run_vault_engine(&app, req, None).await
}
