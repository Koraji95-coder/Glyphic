//! Frontend-facing commands for screenshot annotations.
//!
//! Annotations have two homes:
//!   * The `<image>.annotations.json` sidecar on disk, which is the source
//!     of truth (image-relative coords, survives DB rebuilds).
//!   * The `annotation_blobs` SQLite table, which mirrors the sidecar so
//!     full-text search can hit any text annotations.
//!
//! These commands keep both in sync. They take a `vault_path` plus an
//! `image_path` (vault-relative) so saves and loads can resolve absolute
//! disk paths consistently.

use std::path::Path;

use crate::DbState;

const SIDECAR_SUFFIX: &str = ".annotations.json";

#[tauri::command]
pub fn save_annotations(
    state: tauri::State<'_, DbState>,
    vault_path: String,
    image_path: String,
    data_json: String,
) -> Result<(), String> {
    if image_path.trim().is_empty() {
        return Err("image_path is required".to_string());
    }
    // Validate the payload up front — if it isn't even valid JSON we don't
    // want to write a broken sidecar and have the editor fail to load it
    // back later.
    serde_json::from_str::<serde_json::Value>(&data_json)
        .map_err(|e| format!("Invalid annotation JSON: {e}"))?;

    let sidecar_path = sidecar_path(&vault_path, &image_path);
    if let Some(parent) = sidecar_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create annotation directory: {e}"))?;
        }
    }
    std::fs::write(&sidecar_path, &data_json)
        .map_err(|e| format!("Failed to write annotation sidecar: {e}"))?;

    // DB mirror — failure here is non-fatal; the sidecar is the source of
    // truth and search will still recover next reindex.
    if let Ok(conn) = state.0.lock() {
        let _ = crate::db::annotations::save_blob(&conn, &image_path, &data_json);
    }
    Ok(())
}

#[tauri::command]
pub fn load_annotations(
    state: tauri::State<'_, DbState>,
    vault_path: String,
    image_path: String,
) -> Result<Option<String>, String> {
    if image_path.trim().is_empty() {
        return Err("image_path is required".to_string());
    }
    let sidecar_path = sidecar_path(&vault_path, &image_path);
    match std::fs::read_to_string(&sidecar_path) {
        Ok(contents) => {
            // Opportunistically refresh the DB mirror so search stays current
            // even if the sidecar was edited externally between sessions.
            if let Ok(conn) = state.0.lock() {
                let _ = crate::db::annotations::save_blob(&conn, &image_path, &contents);
            }
            Ok(Some(contents))
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            // Fall back to whatever is in the DB (e.g. sidecar got deleted
            // but we still have a copy from a prior save).
            if let Ok(conn) = state.0.lock() {
                return crate::db::annotations::load_blob(&conn, &image_path);
            }
            Ok(None)
        }
        Err(err) => Err(format!("Failed to read annotation sidecar: {err}")),
    }
}

fn sidecar_path(vault_path: &str, image_path: &str) -> std::path::PathBuf {
    if Path::new(image_path).is_absolute() {
        // Caller already passed an absolute path — don't join.
        return Path::new(&format!("{image_path}{SIDECAR_SUFFIX}")).to_path_buf();
    }
    Path::new(vault_path).join(format!("{image_path}{SIDECAR_SUFFIX}"))
}
