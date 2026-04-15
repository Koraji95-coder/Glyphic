use serde::{Deserialize, Serialize};
use std::path::Path;

// ---------------------------------------------------------------------------
// Top-level vault configuration
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub vault: VaultSection,
    pub capture: CaptureSection,
    pub editor: EditorSection,
    pub appearance: AppearanceSection,
    pub lecture_mode: LectureModeSection,
}

impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            vault: VaultSection::default(),
            capture: CaptureSection::default(),
            editor: EditorSection::default(),
            appearance: AppearanceSection::default(),
            lecture_mode: LectureModeSection::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSection {
    pub name: String,
    pub created_at: String,
}

impl Default for VaultSection {
    fn default() -> Self {
        Self {
            name: String::from("My Vault"),
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSection {
    pub default_mode: String,
    pub hotkey: String,
    pub fullscreen_hotkey: String,
    pub repeat_hotkey: String,
    pub save_to_clipboard: bool,
    pub auto_trim_whitespace: bool,
    pub image_format: String,
    pub jpg_quality: u8,
}

impl Default for CaptureSection {
    fn default() -> Self {
        Self {
            default_mode: String::from("region"),
            hotkey: String::from("CmdOrCtrl+Shift+4"),
            fullscreen_hotkey: String::from("CmdOrCtrl+Shift+3"),
            repeat_hotkey: String::from("CmdOrCtrl+Shift+R"),
            save_to_clipboard: true,
            auto_trim_whitespace: true,
            image_format: String::from("png"),
            jpg_quality: 90,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorSection {
    pub autosave_interval_ms: u64,
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f64,
    pub show_line_numbers: bool,
    pub spell_check: bool,
}

impl Default for EditorSection {
    fn default() -> Self {
        Self {
            autosave_interval_ms: 1000,
            font_family: String::from("Inter, sans-serif"),
            font_size: 16,
            line_height: 1.6,
            show_line_numbers: false,
            spell_check: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSection {
    pub theme: String,
    pub sidebar_width: u32,
    pub accent_color: String,
}

impl Default for AppearanceSection {
    fn default() -> Self {
        Self {
            theme: String::from("system"),
            sidebar_width: 260,
            accent_color: String::from("#6366f1"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LectureModeSection {
    pub enabled: bool,
    pub timestamp_format: String,
}

impl Default for LectureModeSection {
    fn default() -> Self {
        Self {
            enabled: false,
            timestamp_format: String::from("%H:%M:%S"),
        }
    }
}

// ---------------------------------------------------------------------------
// Load / Save helpers
// ---------------------------------------------------------------------------

pub fn load_config(vault_path: &Path) -> Result<VaultConfig, String> {
    let config_path = vault_path.join(".glyphic").join("config.toml");
    let contents =
        std::fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {e}"))?;
    toml::from_str(&contents).map_err(|e| format!("Failed to parse config: {e}"))
}

pub fn save_config(vault_path: &Path, config: &VaultConfig) -> Result<(), String> {
    let config_path = vault_path.join(".glyphic").join("config.toml");
    let contents =
        toml::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(&config_path, contents).map_err(|e| format!("Failed to write config: {e}"))
}
