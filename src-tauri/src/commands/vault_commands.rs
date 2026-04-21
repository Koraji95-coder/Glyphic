use std::path::Path;

use tauri::Manager;

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

    // Load persisted AI config, if any.
    if let Some(loaded) = crate::ai::config::load(Path::new(path)) {
        if let Some(ai_state) = app.try_state::<crate::commands::ai_commands::AiState>() {
            if let Ok(mut cfg) = ai_state.config.lock() {
                *cfg = loaded;
            }
        }
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
        // Newly-created notes only contain frontmatter at this point, so we
        // index an empty body/tags. The first save will upsert the real
        // content via `save_note`.
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
    // Keep FTS index up to date so search reflects the latest body. The
    // upsert in `index_note` is keyed on `path`, so re-saving the same note
    // updates the existing row instead of creating duplicates.
    if let Ok(conn) = db_state.0.lock() {
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();
        let title = index::extract_title(&content, Path::new(&note_path));
        let tags = index::extract_tags(&content);
        let _ = index::index_note(&conn, &id, &note_path, &title, &content, &tags, &now, &now);
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
    db_state: tauri::State<'_, DbState>,
    vault_path: String,
    old_path: String,
    new_name: String,
) -> Result<NoteFile, String> {
    let new_note = manager::rename_note(&vault_path, &old_path, &new_name)?;
    let new_path = new_note.path.clone();

    let conn = db_state.0.lock().map_err(|e| format!("DB lock error: {e}"))?;
    index::rename_note_path(&conn, &old_path, &new_path)?;

    // Look up preserved id + created_at.
    let (id, created_at): (String, String) = conn
        .query_row(
            "SELECT id, created_at FROM notes WHERE path = ?1 LIMIT 1",
            rusqlite::params![&new_path],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to look up renamed note: {e}"))?;

    // Refresh outgoing links from the renamed note (re-read disk content).
    if let Ok(content) =
        std::fs::read_to_string(std::path::Path::new(&vault_path).join(&new_path))
    {
        let _ = crate::db::backlinks::reindex_note_links(&conn, &id, &content);
    }

    Ok(NoteFile {
        id,
        path: new_path,
        title: new_note.title,
        created_at,
        modified_at: new_note.modified_at,
    })
}

#[tauri::command]
pub fn create_folder(vault_path: String, relative_path: String) -> Result<(), String> {
    manager::create_folder(&vault_path, &relative_path)
}
