use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn export_pdf(
    app: tauri::AppHandle,
    vault_path: String,
    note_path: String,
    _output_path: String,
) -> Result<(), String> {
    // Render the note to PDF by opening a hidden webview window pointed at
    // the React `/print-preview` route. That route fetches and renders the
    // note, waits for layout/images, then triggers `window.print()`. The OS
    // print dialog lets the user choose "Save as PDF" and pick the output
    // path. The window closes itself after the print dialog returns.
    //
    // `_output_path` is intentionally unused: the OS print-to-PDF flow is
    // user-driven and we don't have a portable way to bypass the dialog.
    // The argument is preserved for backward compatibility with existing
    // callers (and potential future direct-render backends).
    if vault_path.trim().is_empty() {
        return Err("vault_path is required".to_string());
    }
    if note_path.trim().is_empty() {
        return Err("note_path is required".to_string());
    }

    // If a previous print preview is still around, close it first so we
    // don't get the "label already exists" error.
    if let Some(existing) = app.get_webview_window("print-preview") {
        let _ = existing.close();
    }

    let url = format!(
        "/print-preview?vault={}&note={}",
        urlencoding(&vault_path),
        urlencoding(&note_path),
    );

    WebviewWindowBuilder::new(&app, "print-preview", WebviewUrl::App(url.into()))
        .title("Glyphic — Print Preview")
        .inner_size(900.0, 1100.0)
        .visible(true)
        .resizable(true)
        .build()
        .map_err(|e| format!("Failed to open print preview: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn export_markdown(
    vault_path: String,
    note_path: String,
    output_path: String,
) -> Result<(), String> {
    if vault_path.trim().is_empty() {
        return Err("vault_path is required".to_string());
    }
    if note_path.trim().is_empty() {
        return Err("note_path is required".to_string());
    }
    if output_path.trim().is_empty() {
        return Err("output_path is required".to_string());
    }
    crate::export::markdown::export_markdown(&vault_path, &note_path, &output_path)
}

/// Minimal URL encoder for the few characters that appear in vault/note
/// paths and would break a query string (space, &, ?, #, +, %). Avoids
/// pulling in a separate crate just for query-string assembly.
fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' | '/' | ':' | '\\' => {
                out.push(c);
            }
            _ => {
                let mut buf = [0u8; 4];
                for byte in c.encode_utf8(&mut buf).as_bytes() {
                    out.push_str(&format!("%{:02X}", byte));
                }
            }
        }
    }
    out
}
