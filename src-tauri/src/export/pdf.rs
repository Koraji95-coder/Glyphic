use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Export a note to PDF using the print-preview webview flow.
///
/// This opens a dedicated print-preview window that renders the requested note
/// and triggers the native print dialog, allowing the user to save as PDF.
///
/// `output_path` is currently kept for API compatibility but not used because
/// native print-to-PDF is user-driven across platforms.
pub fn export_pdf(
	app: tauri::AppHandle,
	vault_path: &str,
	note_path: &str,
	_output_path: &str,
) -> Result<(), String> {
	if vault_path.trim().is_empty() {
		return Err("vault_path is required".to_string());
	}
	if note_path.trim().is_empty() {
		return Err("note_path is required".to_string());
	}

	// Avoid duplicate label failures if a previous window still exists.
	if let Some(existing) = app.get_webview_window("print-preview") {
		let _ = existing.close();
	}

	let url = format!(
		"/print-preview?vault={}&note={}",
		urlencoding(vault_path),
		urlencoding(note_path),
	);

	WebviewWindowBuilder::new(&app, "print-preview", WebviewUrl::App(url.into()))
		.title("Glyphic - Print Preview")
		.inner_size(900.0, 1100.0)
		.visible(true)
		.resizable(true)
		.build()
		.map_err(|e| format!("Failed to open print preview: {e}"))?;

	Ok(())
}

/// Minimal URL encoder for query-string values.
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
