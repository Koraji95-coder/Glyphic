#[tauri::command]
pub fn export_pdf(
    app: tauri::AppHandle,
    vault_path: String,
    note_path: String,
    output_path: String,
) -> Result<(), String> {
    crate::export::pdf::export_pdf(app, &vault_path, &note_path, &output_path)
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

