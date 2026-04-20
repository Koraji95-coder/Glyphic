use std::path::Path;

#[tauri::command]
pub fn export_pdf(
    vault_path: String,
    note_path: String,
    output_path: String,
) -> Result<(), String> {
    let _ = (&vault_path, &note_path, &output_path);
    // PDF export is intentionally not implemented in the Rust backend yet —
    // it requires either a headless renderer or a PDF library. Use the
    // browser's print-to-PDF in the meantime.
    Err("PDF export not yet implemented. Use your browser/system 'Print to PDF' from the editor for now.".to_string())
}

#[tauri::command]
pub fn export_markdown(
    vault_path: String,
    note_path: String,
    output_path: String,
) -> Result<(), String> {
    let src = Path::new(&vault_path).join(&note_path);
    if !src.exists() {
        return Err(format!("Note not found: {note_path}"));
    }

    let dest = Path::new(&output_path);
    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create export directory: {e}"))?;
        }
    }

    std::fs::copy(&src, dest).map_err(|e| format!("Failed to export markdown: {e}"))?;
    Ok(())
}
