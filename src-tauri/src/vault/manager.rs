use std::path::Path;

use chrono::Utc;
use serde::Serialize;
use uuid::Uuid;

use crate::db::schema::init_database;
use crate::vault::config::{self, VaultConfig};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct NoteFile {
    pub id: String,
    pub path: String,
    pub title: String,
    pub created_at: String,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub entry_type: String,
    pub children: Option<Vec<VaultEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<String>,
}

// ---------------------------------------------------------------------------
// Vault operations
// ---------------------------------------------------------------------------

pub fn create_vault(path: &str, name: &str) -> Result<VaultConfig, String> {
    let vault_path = Path::new(path);

    // Create directory structure
    std::fs::create_dir_all(vault_path.join(".glyphic"))
        .map_err(|e| format!("Failed to create .glyphic dir: {e}"))?;
    std::fs::create_dir_all(vault_path.join("Unsorted").join("notes"))
        .map_err(|e| format!("Failed to create Unsorted/notes: {e}"))?;
    std::fs::create_dir_all(vault_path.join("Unsorted").join("attachments"))
        .map_err(|e| format!("Failed to create Unsorted/attachments: {e}"))?;

    // Write default config
    let mut cfg = VaultConfig::default();
    cfg.vault.name = name.to_string();
    cfg.vault.created_at = Utc::now().to_rfc3339();
    config::save_config(vault_path, &cfg)?;

    // Initialise database
    init_database(vault_path)?;

    Ok(cfg)
}

pub fn open_vault(path: &str) -> Result<VaultConfig, String> {
    let vault_path = Path::new(path);
    if !vault_path.join(".glyphic").join("config.toml").exists() {
        return Err("Not a valid Glyphic vault (missing .glyphic/config.toml)".into());
    }
    // Ensure DB exists
    init_database(vault_path)?;
    config::load_config(vault_path)
}

pub fn create_folder(vault_path: &str, relative_path: &str) -> Result<(), String> {
    let base = Path::new(vault_path).join(relative_path);
    std::fs::create_dir_all(base.join("notes"))
        .map_err(|e| format!("Failed to create notes dir: {e}"))?;
    std::fs::create_dir_all(base.join("attachments"))
        .map_err(|e| format!("Failed to create attachments dir: {e}"))?;
    Ok(())
}

pub fn create_note(vault_path: &str, folder: &str, title: &str) -> Result<NoteFile, String> {
    let now = Utc::now();
    let id = Uuid::new_v4().to_string();
    let file_name = sanitize_filename(title);
    let rel_path = Path::new(folder)
        .join("notes")
        .join(format!("{file_name}.md"));
    let full_path = Path::new(vault_path).join(&rel_path);

    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent dirs: {e}"))?;
    }

    let frontmatter = format!(
        "---\ntitle: \"{title}\"\ncreated: \"{created}\"\nmodified: \"{modified}\"\ntags: []\nlecture_timestamps: []\n---\n\n",
        title = title,
        created = now.to_rfc3339(),
        modified = now.to_rfc3339(),
    );

    std::fs::write(&full_path, &frontmatter)
        .map_err(|e| format!("Failed to write note file: {e}"))?;

    Ok(NoteFile {
        id,
        path: rel_path.to_string_lossy().to_string(),
        title: title.to_string(),
        created_at: now.to_rfc3339(),
        modified_at: now.to_rfc3339(),
    })
}

pub fn save_note(vault_path: &str, note_path: &str, content: &str) -> Result<(), String> {
    let full_path = Path::new(vault_path).join(note_path);
    std::fs::write(&full_path, content).map_err(|e| format!("Failed to save note: {e}"))
}

pub fn delete_note(vault_path: &str, note_path: &str) -> Result<(), String> {
    let full_path = Path::new(vault_path).join(note_path);
    trash::delete(&full_path).map_err(|e| format!("Failed to move to trash: {e}"))
}

pub fn rename_note(vault_path: &str, old_path: &str, new_name: &str) -> Result<NoteFile, String> {
    let base = Path::new(vault_path);
    let old_full = base.join(old_path);
    let parent = old_full
        .parent()
        .ok_or_else(|| "Invalid note path".to_string())?;
    let new_file = sanitize_filename(new_name);
    let new_full = parent.join(format!("{new_file}.md"));

    std::fs::rename(&old_full, &new_full).map_err(|e| format!("Failed to rename note: {e}"))?;

    let now = Utc::now();
    let rel_path = new_full
        .strip_prefix(base)
        .unwrap_or(&new_full)
        .to_string_lossy()
        .to_string();

    Ok(NoteFile {
        id: Uuid::new_v4().to_string(),
        path: rel_path,
        title: new_name.to_string(),
        created_at: now.to_rfc3339(),
        modified_at: now.to_rfc3339(),
    })
}

pub fn list_vault_contents(vault_path: &str) -> Result<Vec<VaultEntry>, String> {
    let root = Path::new(vault_path);
    build_tree(root, root)
}

pub fn read_note(vault_path: &str, note_path: &str) -> Result<String, String> {
    let full_path = Path::new(vault_path).join(note_path);
    std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read note: {e}"))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string()
}

fn build_tree(base: &Path, dir: &Path) -> Result<Vec<VaultEntry>, String> {
    let mut entries = Vec::new();

    let read_dir =
        std::fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {e}"))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden directories
        if name.starts_with('.') {
            continue;
        }

        let rel_path = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        if path.is_dir() {
            let children = build_tree(base, &path)?;
            entries.push(VaultEntry {
                name,
                path: rel_path,
                entry_type: "folder".to_string(),
                children: Some(children),
                modified_at: None,
            });
        } else {
            let modified_at = std::fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let dt: chrono::DateTime<chrono::Utc> = t.into();
                    dt.to_rfc3339()
                });
            entries.push(VaultEntry {
                name,
                path: rel_path,
                entry_type: "file".to_string(),
                children: None,
                modified_at,
            });
        }
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}
