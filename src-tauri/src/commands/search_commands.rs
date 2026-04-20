use crate::db::{backlinks, index, search};
use crate::DbState;

#[tauri::command]
pub fn search_notes(
    state: tauri::State<'_, DbState>,
    query: String,
    limit: usize,
) -> Result<Vec<search::SearchResult>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    search::search_notes(&conn, &query, limit)
}

#[tauri::command]
pub fn search_all(
    state: tauri::State<'_, DbState>,
    query: String,
    limit: usize,
) -> Result<Vec<search::SearchResult>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    search::search_all(&conn, &query, limit)
}

#[tauri::command]
pub fn reindex_vault(
    state: tauri::State<'_, DbState>,
    vault_path: String,
) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    index::reindex_vault(&conn, &vault_path)
}

#[tauri::command]
pub fn get_backlinks(
    state: tauri::State<'_, DbState>,
    note_path: String,
) -> Result<Vec<backlinks::Backlink>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    backlinks::get_backlinks(&conn, &note_path)
}
