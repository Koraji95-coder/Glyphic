use std::path::Path;

use crate::db::{index, schema};
use crate::vault::config::VaultConfig;
use crate::vault::manager::{self, NoteFile, VaultEntry};
use crate::vault::watcher::VaultWatcher;
use crate::{DbState, WatcherState};

/// Replace the placeholder in-memory DB with a connection to the real
/// `.glyphic/index.db` for the freshly-opened vault, then rebuild the FTS
/// index so search works immediately. Also starts the filesystem watcher so
/// the UI can react to external changes.
fn activate_vault(
    app: &tauri::AppHandle,
    db_state: &tauri::State<'_, DbState>,
    watcher_state: &tauri::State<'_, WatcherState>,
    path: &str,
) -> Result<(), String> {
    let conn = schema::init_database(Path::new(path))?;
    let _ = index::reindex_vault(&conn, path);
    {
        let mut guard = db_state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
        *guard = conn;
    }

    // (Re)start the vault watcher; dropping the old one stops the previous
    // notify watch.
    let new_watcher = VaultWatcher::start(path.to_string(), app.clone()).ok();
    if let Ok(mut guard) = watcher_state.0.lock() {
        *guard = new_watcher;
    }
    Ok(())
}

#[tauri::command]
pub fn create_vault(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, DbState>,
    watcher_state: tauri::State<'_, WatcherState>,
    path: String,
    name: String,
) -> Result<VaultConfig, String> {
    let cfg = manager::create_vault(&path, &name)?;
    activate_vault(&app, &db_state, &watcher_state, &path)?;
    Ok(cfg)
}

#[tauri::command]
pub fn open_vault(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, DbState>,
    watcher_state: tauri::State<'_, WatcherState>,
    path: String,
) -> Result<VaultConfig, String> {
    let cfg = manager::open_vault(&path)?;
    activate_vault(&app, &db_state, &watcher_state, &path)?;
    Ok(cfg)
}

#[tauri::command]
pub fn list_vault_contents(vault_path: String) -> Result<Vec<VaultEntry>, String> {
    manager::list_vault_contents(&vault_path)
}

#[tauri::command]
pub fn create_note(
    db_state: tauri::State<'_, DbState>,
    vault_path: String,
    folder: String,
    title: String,
) -> Result<NoteFile, String> {
    let note = manager::create_note(&vault_path, &folder, &title)?;
    if let Ok(conn) = db_state.0.lock() {
        let _ = index::index_note(
            &conn,
            &note.id,
            &note.path,
            &note.title,
            "",
            "",
            &note.created_at,
            &note.modified_at,
        );
    }
    Ok(note)
}

#[tauri::command]
pub fn read_note(vault_path: String, note_path: String) -> Result<String, String> {
    manager::read_note(&vault_path, &note_path)
}

#[tauri::command]
pub fn save_note(
    db_state: tauri::State<'_, DbState>,
    vault_path: String,
    note_path: String,
    content: String,
) -> Result<(), String> {
    manager::save_note(&vault_path, &note_path, &content)?;
    // Keep FTS index up to date so search reflects the latest body.
    if let Ok(conn) = db_state.0.lock() {
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();
        let title = note_path
            .rsplit('/')
            .next()
            .map(|s| s.trim_end_matches(".md").to_string())
            .unwrap_or_else(|| "Untitled".to_string());
        let _ = index::index_note(&conn, &id, &note_path, &title, &content, "", &now, &now);
    }
    Ok(())
}

#[tauri::command]
pub fn delete_note(
    db_state: tauri::State<'_, DbState>,
    vault_path: String,
    note_path: String,
) -> Result<(), String> {
    manager::delete_note(&vault_path, &note_path)?;
    if let Ok(conn) = db_state.0.lock() {
        let _ = index::remove_from_index(&conn, &note_path);
    }
    Ok(())
}

#[tauri::command]
pub fn rename_note(
    vault_path: String,
    old_path: String,
    new_name: String,
) -> Result<NoteFile, String> {
    manager::rename_note(&vault_path, &old_path, &new_name)
}

#[tauri::command]
pub fn create_folder(vault_path: String, relative_path: String) -> Result<(), String> {
    manager::create_folder(&vault_path, &relative_path)
}
