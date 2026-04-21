use crate::db::tags;
use crate::DbState;

#[tauri::command]
pub fn list_all_tags(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<tags::TagInfo>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    tags::list_all_tags(&conn)
}

#[tauri::command]
pub fn tags_for_note(
    state: tauri::State<'_, DbState>,
    note_path: String,
) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    tags::tags_for_note(&conn, &note_path)
}

#[tauri::command]
pub fn notes_with_tag(
    state: tauri::State<'_, DbState>,
    tag: String,
) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    tags::notes_with_tag(&conn, &tag)
}
