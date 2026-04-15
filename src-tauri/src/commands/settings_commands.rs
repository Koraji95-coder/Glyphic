use std::path::Path;

use crate::vault::config::{self, VaultConfig};

#[tauri::command]
pub fn get_settings(vault_path: String) -> Result<VaultConfig, String> {
    config::load_config(Path::new(&vault_path))
}

#[tauri::command]
pub fn update_settings(vault_path: String, settings: VaultConfig) -> Result<(), String> {
    config::save_config(Path::new(&vault_path), &settings)
}
