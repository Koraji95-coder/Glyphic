use std::path::PathBuf;

use serde_json::json;
use tauri::{AppHandle, Manager};

// ── Path resolution ───────────────────────────────────────────────────────────

/// Resolve the path to the diagram engine Python script.
/// In Tauri 2.0 use app.path() not app.path_resolver().
fn diagram_engine_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("failed to resolve resource_dir: {e}"))?;
    let script = resource_dir
        .join("sidecars")
        .join("diagram_engine")
        .join("main.py");
    if script.exists() {
        Ok(script)
    } else {
        Err(format!(
            "diagram engine not found at {}",
            script.display()
        ))
    }
}

// ── Sidecar runner ────────────────────────────────────────────────────────────

/// Spawn the diagram engine, send one request on stdin and return the response.
async fn run_diagram_engine(
    app: &AppHandle,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::process::{Command, Stdio};

    let script = diagram_engine_path(app)?;

    let mut child = Command::new("python3")
        .arg(&script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn diagram engine: {e}"))?;

    // Write request then close stdin
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "failed to open diagram engine stdin".to_string())?;
        let req_str = request.to_string() + "\n";
        stdin
            .write_all(req_str.as_bytes())
            .await
            .map_err(|e| format!("failed to write to diagram engine: {e}"))?;
        // stdin dropped here, pipe closed
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to open diagram engine stdout".to_string())?;
    let mut lines = BufReader::new(stdout).lines();
    let mut last_obj: Option<serde_json::Value> = None;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim_end().to_string();
        if line.is_empty() {
            continue;
        }
        if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&line) {
            last_obj = Some(obj);
        }
    }

    let _ = child.wait().await;
    last_obj.ok_or_else(|| "no response from diagram engine".to_string())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Request a diagram from the Python sidecar.
///
/// diagram_type: "schemdraw" | "circuit" | "matplotlib" | "phasor" | "polar" | "mermaid"
/// code: Python code string or Mermaid syntax string
///
/// Returns:
///   {"svg_base64": "..."}  for schemdraw/matplotlib types
///   {"mermaid": "..."}     for mermaid type
///   {"error": "..."}       on failure
#[tauri::command]
pub async fn render_diagram(
    app: AppHandle,
    diagram_type: String,
    code: String,
) -> Result<serde_json::Value, String> {
    let req = json!({
        "action": "render",
        "diagram_type": diagram_type,
        "code": code,
    });
    run_diagram_engine(&app, req).await
}
