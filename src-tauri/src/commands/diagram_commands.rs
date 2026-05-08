use std::path::PathBuf;

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

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

/// Returns the launcher shim path if it exists, otherwise falls back to
/// `python3 <script>`. The shim activates the venv from `sidecars/install_deps.sh`.
fn diagram_python_cmd(app: &AppHandle) -> (std::ffi::OsString, Vec<std::ffi::OsString>) {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let shim = resource_dir
            .join("sidecars")
            .join("diagram_engine_launcher");
        if shim.exists() {
            return (shim.into_os_string(), vec![]);
        }
    }
    // Fallback: plain python3 with the script path as arg
    if let Ok(script) = diagram_engine_path(app) {
        return (
            std::ffi::OsString::from("python3"),
            vec![script.into_os_string()],
        );
    }
    (std::ffi::OsString::from("python3"), vec![])
}

// ── Sidecar runner ────────────────────────────────────────────────────────────

/// Spawn the diagram engine, send one request on stdin and return the response.
async fn run_diagram_engine(
    app: &AppHandle,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::process::Command;

    let (cmd, extra_args) = diagram_python_cmd(app);

    let mut child = Command::new(&cmd)
        .args(&extra_args)
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

    // Drain stderr in the background so the pipe buffer never fills.
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(_)) = lines.next_line().await {}
        });
    }

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

    let status = child
        .wait()
        .await
        .map_err(|e| format!("failed waiting for diagram engine: {e}"))?;
    if !status.success() {
        return Err(format!("diagram engine exited with status {status}"));
    }
    last_obj.ok_or_else(|| "no response from diagram engine".to_string())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GeneratedDiagramCode {
    pub code: String,
    pub language: String,
    pub diagram_type: String,
    pub warnings: Vec<String>,
}

fn parse_final_generated_code(final_event: &serde_json::Value) -> Result<GeneratedDiagramCode, String> {
    let code = final_event
        .get("code")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "final event missing string field 'code'".to_string())?
        .to_string();
    let language = final_event
        .get("language")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "final event missing string field 'language'".to_string())?
        .to_string();
    let diagram_type = final_event
        .get("diagram_type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "final event missing string field 'diagram_type'".to_string())?
        .to_string();
    let warnings = final_event
        .get("warnings")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|w| w.as_str().map(ToString::to_string))
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    Ok(GeneratedDiagramCode {
        code,
        language,
        diagram_type,
        warnings,
    })
}

async fn generate_code_with_cmd(
    cmd: std::ffi::OsString,
    extra_args: Vec<std::ffi::OsString>,
    request: serde_json::Value,
    mut on_progress: impl FnMut(serde_json::Value) -> Result<(), String>,
) -> Result<GeneratedDiagramCode, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::process::Command;

    let mut child = Command::new(&cmd)
        .args(&extra_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn diagram engine: {e}"))?;

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
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to open diagram engine stdout".to_string())?;

    // Drain stderr in the background so the pipe buffer never fills.
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(_)) = lines.next_line().await {}
        });
    }

    let mut lines = BufReader::new(stdout).lines();
    let mut final_event: Option<serde_json::Value> = None;
    let mut error_message: Option<String> = None;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim_end().to_string();
        if line.is_empty() {
            continue;
        }
        let Ok(obj) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };

        match obj.get("event").and_then(|v| v.as_str()) {
            Some("progress") => {
                on_progress(obj)?;
            }
            Some("final") => {
                final_event = Some(obj);
            }
            Some("error") => {
                let msg = obj
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("diagram engine returned error event")
                    .to_string();
                error_message = Some(msg);
            }
            _ => {}
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("failed waiting for diagram engine: {e}"))?;

    if let Some(msg) = error_message {
        return Err(msg);
    }
    if !status.success() {
        return Err(format!("diagram engine exited with status {status}"));
    }
    let final_event = final_event.ok_or_else(|| "diagram engine produced no final event".to_string())?;
    parse_final_generated_code(&final_event)
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

#[tauri::command]
pub async fn generate_code(
    description: String,
    diagram_type: Option<String>,
    app: AppHandle,
) -> Result<GeneratedDiagramCode, String> {
    let (cmd, extra_args) = diagram_python_cmd(&app);
    let req = json!({
        "action": "generate_code",
        "description": description,
        "diagram_type": diagram_type.unwrap_or_else(|| "auto".to_string()),
    });

    generate_code_with_cmd(cmd, extra_args, req, |progress_event| {
        app.emit("diagram://generate-code/progress", progress_event)
            .map_err(|e| format!("failed to emit diagram progress event: {e}"))
    })
    .await
}

/// Export diagram code to PNG.
///
/// diagram_type: "schemdraw" | "circuit" | "matplotlib" | "phasor" | "polar"
///   (Mermaid is not supported — returns {"error": "..."})
/// code: Python code string to execute
///
/// Returns:
///   {"png_base64": "..."}  on success
///   {"error": "..."}       on failure or unsupported diagram type
#[tauri::command]
pub async fn export_png(
    app: AppHandle,
    diagram_type: String,
    code: String,
) -> Result<serde_json::Value, String> {
    let req = json!({
        "action": "export_png",
        "diagram_type": diagram_type,
        "code": code,
    });
    run_diagram_engine(&app, req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn python_cmd(script: &str) -> (std::ffi::OsString, Vec<std::ffi::OsString>) {
        (
            std::ffi::OsString::from("python3"),
            vec![std::ffi::OsString::from("-c"), std::ffi::OsString::from(script)],
        )
    }

    #[test]
    fn generate_code_happy_path_mermaid_final_event() {
        let rt = tokio::runtime::Runtime::new().expect("runtime");
        rt.block_on(async {
            let script = r#"import json,sys; _=json.loads(sys.stdin.readline()); print(json.dumps({"event":"progress","stage":"generating"})); print(json.dumps({"event":"final","code":"flowchart TD\nA-->B","language":"mermaid","diagram_type":"mermaid","warnings":[]})); sys.stdout.flush()"#;
            let (cmd, args) = python_cmd(script);
            let req = json!({
                "action": "generate_code",
                "description": "simple login flow",
                "diagram_type": "auto"
            });

            let result = generate_code_with_cmd(cmd, args, req, |_| Ok(())).await;
            let result = result.expect("expected successful final event");
            assert_eq!(result.language, "mermaid");
            assert_eq!(result.diagram_type, "mermaid");
            assert!(result.code.contains("flowchart TD"));
        });
    }

    #[test]
    fn generate_code_non_zero_exit_returns_error() {
        let rt = tokio::runtime::Runtime::new().expect("runtime");
        rt.block_on(async {
            let script = r#"import json,sys; _=json.loads(sys.stdin.readline()); sys.exit(1)"#;
            let (cmd, args) = python_cmd(script);
            let req = json!({
                "action": "generate_code",
                "description": "will fail",
                "diagram_type": "auto"
            });

            let err = generate_code_with_cmd(cmd, args, req, |_| Ok(()))
                .await
                .expect_err("expected error for non-zero exit");
            assert!(err.contains("exited with status"));
        });
    }

    /// Helper: run `run_diagram_engine` with a mocked Python command.
    async fn run_engine_with_script(script: &str, req: serde_json::Value) -> Result<serde_json::Value, String> {
        use std::process::Stdio;
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::process::Command;

        let mut child = Command::new("python3")
            .args(["-c", script])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to spawn: {e}"))?;

        {
            let mut stdin = child.stdin.take().ok_or_else(|| "no stdin".to_string())?;
            let req_str = req.to_string() + "\n";
            stdin.write_all(req_str.as_bytes()).await.map_err(|e| format!("write failed: {e}"))?;
        }

        let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
        let mut lines = BufReader::new(stdout).lines();
        let mut last_obj: Option<serde_json::Value> = None;

        while let Ok(Some(line)) = lines.next_line().await {
            let line = line.trim_end().to_string();
            if line.is_empty() { continue; }
            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&line) {
                last_obj = Some(obj);
            }
        }

        let status = child.wait().await.map_err(|e| format!("wait failed: {e}"))?;
        if !status.success() {
            return Err(format!("exited with status {status}"));
        }
        last_obj.ok_or_else(|| "no response".to_string())
    }

    #[test]
    fn export_png_happy_path_returns_png_base64() {
        let rt = tokio::runtime::Runtime::new().expect("runtime");
        rt.block_on(async {
            let script = r#"import json,sys; _=json.loads(sys.stdin.readline()); print(json.dumps({"png_base64":"abc123"})); sys.stdout.flush()"#;
            let req = json!({
                "action": "export_png",
                "diagram_type": "schemdraw",
                "code": "d = schemdraw.Drawing()"
            });
            let result = run_engine_with_script(script, req).await.expect("expected success");
            assert_eq!(result.get("png_base64").and_then(|v| v.as_str()), Some("abc123"));
        });
    }

    #[test]
    fn export_png_non_zero_exit_returns_error() {
        let rt = tokio::runtime::Runtime::new().expect("runtime");
        rt.block_on(async {
            let script = r#"import json,sys; _=json.loads(sys.stdin.readline()); sys.exit(1)"#;
            let req = json!({
                "action": "export_png",
                "diagram_type": "schemdraw",
                "code": "bad code"
            });
            let err = run_engine_with_script(script, req).await.expect_err("expected error");
            assert!(err.contains("exited with status"));
        });
    }
}
