use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// User-level state file (recent vaults, etc.). Lives outside any vault so it
/// survives vault deletion and acts as the source-of-truth for "first launch".
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppState {
    /// Most-recently-used vault paths, newest first. Capped to 8 entries.
    #[serde(default)]
    pub recent_vaults: Vec<String>,
}

const MAX_RECENT: usize = 8;

fn state_file_path() -> Result<PathBuf, String> {
    let dirs = directories::ProjectDirs::from("dev", "Glyphic", "Glyphic")
        .ok_or_else(|| "Could not determine config directory".to_string())?;
    let dir = dirs.config_dir().to_path_buf();
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(dir.join("state.json"))
}

fn load_state() -> AppState {
    let path = match state_file_path() {
        Ok(p) => p,
        Err(_) => return AppState::default(),
    };
    let Ok(contents) = std::fs::read_to_string(&path) else {
        return AppState::default();
    };
    serde_json::from_str(&contents).unwrap_or_default()
}

fn save_state(state: &AppState) -> Result<(), String> {
    let path = state_file_path()?;
    let json =
        serde_json::to_string_pretty(state).map_err(|e| format!("Failed to serialize state: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write state file: {e}"))
}

#[tauri::command]
pub fn get_recent_vaults() -> Result<Vec<String>, String> {
    Ok(load_state().recent_vaults)
}

#[tauri::command]
pub fn add_recent_vault(vault_path: String) -> Result<Vec<String>, String> {
    let mut state = load_state();
    // Move the path to the front of the list.
    state.recent_vaults.retain(|p| p != &vault_path);
    state.recent_vaults.insert(0, vault_path);
    state.recent_vaults.truncate(MAX_RECENT);
    save_state(&state)?;
    Ok(state.recent_vaults)
}
