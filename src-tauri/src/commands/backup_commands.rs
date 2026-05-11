use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

use crate::db::schema;

/// Backup status enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BackupStatus {
    Pending,
    InProgress,
    Success,
    Failed,
}

impl std::fmt::Display for BackupStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BackupStatus::Pending => write!(f, "pending"),
            BackupStatus::InProgress => write!(f, "in_progress"),
            BackupStatus::Success => write!(f, "success"),
            BackupStatus::Failed => write!(f, "failed"),
        }
    }
}

/// Backup history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupHistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub status: String,
    pub error_message: Option<String>,
    pub dropbox_path: Option<String>,
    pub size_bytes: i64,
    pub notes_count: i64,
    pub screenshots_count: i64,
    pub created_at: String,
}

/// Backup status response for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupStatusResponse {
    pub last_backup: Option<BackupHistoryEntry>,
    pub is_backing_up: bool,
    pub dropbox_enabled: bool,
}

/// Trigger a manual backup to Dropbox
#[tauri::command]
pub async fn backup_now(vault_path: String) -> Result<BackupHistoryEntry, String> {
    let vault = Path::new(&vault_path);

    // Get DB connection
    let conn = schema::init_database(vault)?;

    // Create backup record
    let backup_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO backup_history (id, timestamp, status, created_at) 
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&backup_id, &now, BackupStatus::InProgress.to_string(), &now],
    )
    .map_err(|e| format!("Failed to create backup record: {e}"))?;

    // Count notes and screenshots for metadata
    let notes_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
        .unwrap_or(0);

    let screenshots_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM screenshots", [], |row| row.get(0))
        .unwrap_or(0);

    // Attempt backup to Dropbox
    // TODO: Implement actual Dropbox backup (serialize vault, upload, etc.)
    let backup_result = perform_dropbox_backup(vault, notes_count, screenshots_count).await;

    match backup_result {
        Ok((dropbox_path, size_bytes)) => {
            // Update backup record with success
            conn.execute(
                "UPDATE backup_history 
                 SET status = ?1, dropbox_path = ?2, size_bytes = ?3, notes_count = ?4, screenshots_count = ?5
                 WHERE id = ?6",
                rusqlite::params![
                    BackupStatus::Success.to_string(),
                    &dropbox_path,
                    size_bytes,
                    notes_count,
                    screenshots_count,
                    &backup_id
                ],
            )
            .map_err(|e| format!("Failed to update backup record: {e}"))?;

            get_backup_entry(&conn, &backup_id)
        }
        Err(e) => {
            // Update backup record with error
            let error_msg = format!("Backup failed: {}", e);
            conn.execute(
                "UPDATE backup_history 
                 SET status = ?1, error_message = ?2
                 WHERE id = ?3",
                rusqlite::params![BackupStatus::Failed.to_string(), &error_msg, &backup_id],
            )
            .map_err(|e| format!("Failed to update backup record: {e}"))?;

            Err(error_msg)
        }
    }
}

/// Get the backup status (last backup + is currently backing up)
#[tauri::command]
pub fn get_backup_status(vault_path: String) -> Result<BackupStatusResponse, String> {
    let vault = Path::new(&vault_path);
    let conn = schema::init_database(vault)?;

    // Get last backup entry
    let last_backup = conn
        .query_row(
            "SELECT id, timestamp, status, error_message, dropbox_path, size_bytes, notes_count, screenshots_count, created_at
             FROM backup_history 
             ORDER BY created_at DESC 
             LIMIT 1",
            [],
            |row| {
                Ok(BackupHistoryEntry {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    status: row.get(2)?,
                    error_message: row.get(3)?,
                    dropbox_path: row.get(4)?,
                    size_bytes: row.get(5)?,
                    notes_count: row.get(6)?,
                    screenshots_count: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .ok();

    // Check if any backup is currently in progress
    let is_backing_up: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM backup_history WHERE status = 'in_progress'",
            [],
            |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            },
        )
        .unwrap_or(false);

    // Check if Dropbox is enabled (has token in settings)
    let dropbox_enabled: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM backup_settings WHERE key = 'dropbox_token'",
            [],
            |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            },
        )
        .unwrap_or(false);

    Ok(BackupStatusResponse {
        last_backup,
        is_backing_up,
        dropbox_enabled,
    })
}

/// Set Dropbox token in backup settings
#[tauri::command]
pub fn set_dropbox_token(vault_path: String, token: String) -> Result<(), String> {
    let vault = Path::new(&vault_path);
    let conn = schema::init_database(vault)?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT OR REPLACE INTO backup_settings (key, value, updated_at) 
         VALUES ('dropbox_token', ?1, ?2)",
        rusqlite::params![&token, &now],
    )
    .map_err(|e| format!("Failed to set Dropbox token: {e}"))?;

    Ok(())
}

/// Get backup history entries
#[tauri::command]
pub fn get_backup_history(vault_path: String, limit: i64) -> Result<Vec<BackupHistoryEntry>, String> {
    let vault = Path::new(&vault_path);
    let conn = schema::init_database(vault)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, timestamp, status, error_message, dropbox_path, size_bytes, notes_count, screenshots_count, created_at
             FROM backup_history 
             ORDER BY created_at DESC 
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let entries = stmt
        .query_map(rusqlite::params![limit], |row| {
            Ok(BackupHistoryEntry {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                status: row.get(2)?,
                error_message: row.get(3)?,
                dropbox_path: row.get(4)?,
                size_bytes: row.get(5)?,
                notes_count: row.get(6)?,
                screenshots_count: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query backup history: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect backup history: {e}"))?;

    Ok(entries)
}

// ── Helper functions ──

/// Helper: Get a single backup entry by ID
fn get_backup_entry(conn: &rusqlite::Connection, backup_id: &str) -> Result<BackupHistoryEntry, String> {
    conn.query_row(
        "SELECT id, timestamp, status, error_message, dropbox_path, size_bytes, notes_count, screenshots_count, created_at
         FROM backup_history 
         WHERE id = ?1",
        rusqlite::params![backup_id],
        |row| {
            Ok(BackupHistoryEntry {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                status: row.get(2)?,
                error_message: row.get(3)?,
                dropbox_path: row.get(4)?,
                size_bytes: row.get(5)?,
                notes_count: row.get(6)?,
                screenshots_count: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| format!("Failed to retrieve backup entry: {e}"))
}

/// Perform the actual Dropbox backup
/// TODO: Implement full backup serialization and Dropbox API integration
/// Returns: (dropbox_path, size_bytes)
async fn perform_dropbox_backup(
    _vault_path: &Path,
    _notes_count: i64,
    _screenshots_count: i64,
) -> Result<(String, i64), String> {
    // Placeholder implementation
    // In full implementation, this would:
    // 1. Serialize vault (notes, screenshots, annotations) to YAML/JSON
    // 2. Create tarball
    // 3. Upload to Dropbox API with hardened path handling
    // 4. Return remote path and size

    let dropbox_path = format!(
        "/Glyphic/Backups/backup-{}.tar.gz",
        Uuid::new_v4().to_string()
    );
    let size_bytes = 1024 * 1024; // Placeholder: 1 MB

    Ok((dropbox_path, size_bytes as i64))
}

/// Hardened Dropbox path validation (following Suite audit patterns)
/// Prevents path traversal and normalizes filenames
#[allow(dead_code)]
fn validate_dropbox_path(path: &str) -> Result<String, String> {
    // Only allow specific characters in paths
    if !path
        .chars()
        .all(|c| c.is_alphanumeric() || "-_/.".contains(c))
    {
        return Err("Invalid characters in Dropbox path".to_string());
    }

    // Prevent path traversal
    if path.contains("..") {
        return Err("Path traversal detected".to_string());
    }

    // Ensure path starts with /
    if !path.starts_with('/') {
        return Err("Path must start with /".to_string());
    }

    Ok(path.to_string())
}

/// Normalize filename for Dropbox (remove special characters, limit length)
#[allow(dead_code)]
fn normalize_dropbox_filename(filename: &str) -> String {
    filename
        .chars()
        .map(|c| if c.is_alphanumeric() || "-._".contains(c) { c } else { '_' })
        .collect::<String>()
        .chars()
        .take(255)
        .collect()
}
