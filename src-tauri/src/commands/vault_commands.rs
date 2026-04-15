use crate::vault::config::VaultConfig;
use crate::vault::manager::{self, NoteFile, VaultEntry};

#[tauri::command]
pub fn create_vault(path: String, name: String) -> Result<VaultConfig, String> {
    manager::create_vault(&path, &name)
}

#[tauri::command]
pub fn open_vault(path: String) -> Result<VaultConfig, String> {
    manager::open_vault(&path)
}

#[tauri::command]
pub fn list_vault_contents(vault_path: String) -> Result<Vec<VaultEntry>, String> {
    manager::list_vault_contents(&vault_path)
}

#[tauri::command]
pub fn create_note(vault_path: String, folder: String, title: String) -> Result<NoteFile, String> {
    manager::create_note(&vault_path, &folder, &title)
}

#[tauri::command]
pub fn read_note(vault_path: String, note_path: String) -> Result<String, String> {
    manager::read_note(&vault_path, &note_path)
}

#[tauri::command]
pub fn save_note(vault_path: String, note_path: String, content: String) -> Result<(), String> {
    manager::save_note(&vault_path, &note_path, &content)
}

#[tauri::command]
pub fn delete_note(vault_path: String, note_path: String) -> Result<(), String> {
    manager::delete_note(&vault_path, &note_path)
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
