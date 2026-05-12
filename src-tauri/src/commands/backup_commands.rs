use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::io::Cursor;
use std::path::Component;
use std::path::Path;
use uuid::Uuid;

use flate2::read::GzDecoder;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use tar::Archive;

use crate::db::{index, schema};
use crate::services::backup_service::{BackupService, ChangeDetectionResult};

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

/// Change detection response for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeDetectionResponse {
    pub has_changes: bool,
    pub notes_changed: usize,
    pub screenshots_changed: usize,
    pub total_files: usize,
    pub estimated_size_bytes: i64,
    pub size_warning: bool,
}

/// Restore point response for UI browser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestorePointResponse {
    pub id: String,
    pub timestamp: String,
    pub size_bytes: i64,
    pub files_count: usize,
    pub notes_changed: usize,
    pub screenshots_changed: usize,
    pub dropbox_path: Option<String>,
}

/// Restore execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreResultResponse {
    pub backup_id: String,
    pub files_restored: usize,
    pub restored_at: String,
}

/// Trigger a manual backup to Dropbox
#[tauri::command]
pub async fn backup_now(vault_path: String) -> Result<BackupHistoryEntry, String> {
    let vault = Path::new(&vault_path);

    // Get DB connection
    let conn = schema::init_database(vault)?;

    // Detect if vault content has changed since last backup
    let change_result = BackupService::detect_changes(&conn, vault)?;

    // If no changes detected, skip backup
    if !change_result.has_changes {
        return Err("No changes detected since last backup".to_string());
    }

    // Create backup record
    let backup_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO backup_history (id, timestamp, status, created_at) 
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&backup_id, &now, BackupStatus::InProgress.to_string(), &now],
    )
    .map_err(|e| format!("Failed to create backup record: {e}"))?;

    // Build list of changed files
    let file_list = BackupService::build_backup_relative_file_list(vault, &change_result)?;

    // Calculate backup size (only changed files)
    let backup_size = BackupService::calculate_backup_size(vault, &file_list)?;

    // Check if size exceeds 150MB warning threshold
    if BackupService::check_size_warning(backup_size) {
        // TODO: Return size warning to UI — user can confirm or cancel
        // For now, log and continue
        eprintln!(
            "WARNING: Backup size {} exceeds 150MB threshold",
            format_bytes(backup_size)
        );
    }

    // Count changed notes/screenshots for metadata
    let notes_count: i64 = change_result.new_notes.len() as i64;
    let screenshots_count: i64 = change_result.new_screenshots.len() as i64;

    // Attempt backup to Dropbox with incremental payload
    let backup_result = perform_dropbox_backup(
        vault,
        &backup_id,
        &change_result,
        &file_list,
        backup_size,
        notes_count,
        screenshots_count,
    )
    .await;

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

            // Record backup completion and update last_backup_timestamp
            BackupService::record_backup_completion(&conn, &backup_id)?;

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

/// Detect if vault content has changed since last backup (without triggering backup)
/// Returns change summary with size warning info
#[tauri::command]
pub fn detect_changes(vault_path: String) -> Result<ChangeDetectionResponse, String> {
    let vault = Path::new(&vault_path);
    let conn = schema::init_database(vault)?;

    // Detect changes
    let change_result = BackupService::detect_changes(&conn, vault)?;

    // Calculate estimated backup size if changes exist
    let estimated_size_bytes = if change_result.has_changes {
        let changed_files: Vec<String> = change_result
            .new_notes
            .iter()
            .chain(change_result.new_screenshots.iter())
            .cloned()
            .collect();
        BackupService::calculate_backup_size(vault, &changed_files).unwrap_or(0)
    } else {
        0
    };

    // Check if size would exceed warning threshold
    let size_warning = BackupService::check_size_warning(estimated_size_bytes);

    Ok(ChangeDetectionResponse {
        has_changes: change_result.has_changes,
        notes_changed: change_result.new_notes.len(),
        screenshots_changed: change_result.new_screenshots.len(),
        total_files: change_result.total_files_to_backup,
        estimated_size_bytes,
        size_warning,
    })
}

/// Get restore points for backup history browser
#[tauri::command]
pub fn get_restore_points(vault_path: String, limit: i64) -> Result<Vec<RestorePointResponse>, String> {
    let vault = Path::new(&vault_path);
    let conn = schema::init_database(vault)?;

    let points = BackupService::get_restore_points(&conn, limit)?;
    let response = points
        .into_iter()
        .map(|p| RestorePointResponse {
            id: p.id,
            timestamp: p.timestamp,
            size_bytes: p.size_bytes,
            files_count: p.files_count,
            notes_changed: p.notes_changed,
            screenshots_changed: p.screenshots_changed,
            dropbox_path: p.dropbox_path,
        })
        .collect();

    Ok(response)
}

/// Restore vault files from a selected restore point archive in Dropbox.
#[tauri::command]
pub async fn restore_from_point(
    vault_path: String,
    restore_point_id: String,
) -> Result<RestoreResultResponse, String> {
    let vault = Path::new(&vault_path);
    let conn = schema::init_database(vault)?;

    let dropbox_path: String = conn
        .query_row(
            "SELECT dropbox_path FROM backup_history WHERE id = ?1 AND status = 'success'",
            rusqlite::params![&restore_point_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to resolve restore point path: {e}"))?;

    let token = get_dropbox_token(&conn)?;
    let archive_bytes = download_archive_from_dropbox(&token, &dropbox_path).await?;
    let files_restored = restore_archive_into_vault(vault, &archive_bytes)?;

    // Rebuild note/search index so restored content is immediately queryable.
    index::reindex_vault(&conn, &vault_path)?;

    Ok(RestoreResultResponse {
        backup_id: restore_point_id,
        files_restored,
        restored_at: Utc::now().to_rfc3339(),
    })
}

// ── Helper functions ──

/// Format bytes to human-readable size (B, KB, MB, GB)
fn format_bytes(bytes: i64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size > 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    format!("{:.2} {}", size, UNITS[unit_idx])
}

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

/// Perform the actual Dropbox backup with incremental payload
/// Accepts only changed files from ChangeDetectionResult
/// TODO: Implement full Dropbox API integration
/// Returns: (dropbox_path, size_bytes)
async fn perform_dropbox_backup(
    vault_path: &Path,
    backup_id: &str,
    _change_result: &ChangeDetectionResult,
    changed_files: &[String],
    _backup_size: i64,
    _notes_count: i64,
    _screenshots_count: i64,
) -> Result<(String, i64), String> {
    // Build incremental archive with only changed files and embedded manifest.
    let (archive_path, archive_size) =
        BackupService::create_incremental_archive(vault_path, backup_id, changed_files)?;

    let dropbox_path = BackupService::build_dropbox_archive_path();

    let conn = schema::init_database(vault_path)?;
    let token = get_dropbox_token(&conn)?;
    upload_archive_to_dropbox(&token, &dropbox_path, &archive_path).await?;

    // Cleanup local temporary archive after successful upload.
    let _ = fs::remove_file(&archive_path);

    Ok((dropbox_path, archive_size))
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

fn get_dropbox_token(conn: &rusqlite::Connection) -> Result<String, String> {
    conn.query_row(
        "SELECT value FROM backup_settings WHERE key = 'dropbox_token'",
        [],
        |row| row.get(0),
    )
    .map_err(|_| "Dropbox token not configured".to_string())
}

async fn upload_archive_to_dropbox(token: &str, dropbox_path: &str, archive_path: &Path) -> Result<(), String> {
    let file_bytes = fs::read(archive_path).map_err(|e| format!("Failed to read archive file for upload: {e}"))?;
    let client = reqwest::Client::new();

    let args = serde_json::json!({
        "path": dropbox_path,
        "mode": "add",
        "autorename": true,
        "mute": false,
        "strict_conflict": false
    });

    let response = client
        .post("https://content.dropboxapi.com/2/files/upload")
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .header("Dropbox-API-Arg", args.to_string())
        .header(CONTENT_TYPE, "application/octet-stream")
        .body(file_bytes)
        .send()
        .await
        .map_err(|e| format!("Dropbox upload request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "<unable to read response>".to_string());
        return Err(format!("Dropbox upload failed ({status}): {body}"));
    }

    Ok(())
}

async fn download_archive_from_dropbox(token: &str, dropbox_path: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let args = serde_json::json!({ "path": dropbox_path });

    let response = client
        .post("https://content.dropboxapi.com/2/files/download")
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .header("Dropbox-API-Arg", args.to_string())
        .send()
        .await
        .map_err(|e| format!("Dropbox download request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "<unable to read response>".to_string());
        return Err(format!("Dropbox download failed ({status}): {body}"));
    }

    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Failed to read Dropbox download bytes: {e}"))
}

fn restore_archive_into_vault(vault_path: &Path, archive_bytes: &[u8]) -> Result<usize, String> {
    let decoder = GzDecoder::new(Cursor::new(archive_bytes));
    let mut archive = Archive::new(decoder);
    let mut restored_files = 0usize;

    for entry_result in archive
        .entries()
        .map_err(|e| format!("Failed to enumerate archive entries: {e}"))?
    {
        let mut entry = entry_result.map_err(|e| format!("Failed reading archive entry: {e}"))?;
        let entry_path = entry
            .path()
            .map_err(|e| format!("Failed reading archive entry path: {e}"))?;

        if !is_safe_archive_path(&entry_path) {
            return Err(format!(
                "Unsafe path detected in restore archive: {}",
                entry_path.display()
            ));
        }

        let destination = vault_path.join(&entry_path);

        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed creating restore directory '{}': {e}", parent.display()))?;
        }

        let entry_type = entry.header().entry_type();
        if entry_type.is_dir() {
            fs::create_dir_all(&destination).map_err(|e| {
                format!(
                    "Failed creating restore directory '{}': {e}",
                    destination.display()
                )
            })?;
            continue;
        }

        if entry_type.is_file() {
            let mut output = File::create(&destination).map_err(|e| {
                format!(
                    "Failed creating restore file '{}': {e}",
                    destination.display()
                )
            })?;
            std::io::copy(&mut entry, &mut output).map_err(|e| {
                format!(
                    "Failed writing restore file '{}': {e}",
                    destination.display()
                )
            })?;
            restored_files += 1;
        }
    }

    Ok(restored_files)
}

fn is_safe_archive_path(path: &Path) -> bool {
    !path.is_absolute()
        && !path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )
        })
}
