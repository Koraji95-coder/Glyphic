#[tauri::command]
pub fn export_pdf(
    vault_path: String,
    note_path: String,
    output_path: String,
) -> Result<(), String> {
    let _ = (&vault_path, &note_path, &output_path);
    Err("PDF export not yet implemented".to_string())
}

#[tauri::command]
pub fn export_markdown(
    vault_path: String,
    note_path: String,
    output_path: String,
) -> Result<(), String> {
    let _ = (&vault_path, &note_path, &output_path);
    Err("Markdown export not yet implemented".to_string())
}
