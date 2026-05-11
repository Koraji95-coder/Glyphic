use chrono::Utc;
use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

/// Backup metadata stored in settings
const LAST_BACKUP_TIMESTAMP_KEY: &str = "last_backup_timestamp";
const INCREMENTAL_ENABLED_KEY: &str = "backup_incremental_enabled";

/// Change detection result
#[derive(Debug, Clone)]
pub struct ChangeDetectionResult {
    pub has_changes: bool,
    pub new_notes: Vec<String>,
    pub modified_notes: Vec<String>,
    pub new_screenshots: Vec<String>,
    pub modified_screenshots: Vec<String>,
    pub total_files_to_backup: usize,
}

/// Restore point metadata
#[derive(Debug, Clone)]
pub struct RestorePoint {
    pub id: String,
    pub timestamp: String,
    pub size_bytes: i64,
    pub files_count: usize,
    pub notes_changed: usize,
    pub screenshots_changed: usize,
    pub dropbox_path: Option<String>,
}

/// Backup service for change detection and incremental backups
pub struct BackupService;

impl BackupService {
    /// Detect if vault content has changed since last backup
    /// Returns `ChangeDetectionResult` with detailed change info
    pub fn detect_changes(
        conn: &Connection,
        vault_path: &Path,
    ) -> Result<ChangeDetectionResult, String> {
        // Get last backup timestamp from settings
        let last_backup_str: Option<String> = conn
            .query_row(
                "SELECT value FROM backup_settings WHERE key = ?1",
                rusqlite::params![LAST_BACKUP_TIMESTAMP_KEY],
                |row| row.get(0),
            )
            .ok();

        let last_backup_timestamp = if let Some(ts) = last_backup_str {
            ts
        } else {
            // No previous backup — treat as first backup with all current files
            return Self::detect_all_changes(conn, vault_path);
        };

        // Query notes modified after last backup
        let mut stmt = conn
            .prepare(
                "SELECT path, modified_at FROM notes WHERE modified_at > ?1 ORDER BY modified_at DESC",
            )
            .map_err(|e| format!("Failed to query modified notes: {e}"))?;

        let modified_notes: Vec<String> = stmt
            .query_map(rusqlite::params![&last_backup_timestamp], |row| {
                row.get::<_, String>(0)
            })
            .map_err(|e| format!("Failed to iterate modified notes: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect modified notes: {e}"))?;

        // Query screenshots added/modified after last backup
        let mut stmt = conn
            .prepare(
                "SELECT path FROM screenshots WHERE captured_at > ?1 ORDER BY captured_at DESC",
            )
            .map_err(|e| format!("Failed to query modified screenshots: {e}"))?;

        let modified_screenshots: Vec<String> = stmt
            .query_map(rusqlite::params![&last_backup_timestamp], |row| {
                row.get::<_, String>(0)
            })
            .map_err(|e| format!("Failed to iterate modified screenshots: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect modified screenshots: {e}"))?;

        let has_changes = !modified_notes.is_empty() || !modified_screenshots.is_empty();
        let total_files_to_backup = modified_notes.len() + modified_screenshots.len();

        Ok(ChangeDetectionResult {
            has_changes,
            new_notes: modified_notes.clone(), // Simplified: treat all as "new" for this backup cycle
            modified_notes: vec![],
            new_screenshots: modified_screenshots.clone(),
            modified_screenshots: vec![],
            total_files_to_backup,
        })
    }

    /// Detect all changes (first backup scenario)
    fn detect_all_changes(
        conn: &Connection,
        _vault_path: &Path,
    ) -> Result<ChangeDetectionResult, String> {
        let notes_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap_or(0);

        let screenshots_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM screenshots", [], |row| row.get(0))
            .unwrap_or(0);

        Ok(ChangeDetectionResult {
            has_changes: notes_count > 0 || screenshots_count > 0,
            new_notes: vec![], // Placeholder: in real impl, would query all note paths
            modified_notes: vec![],
            new_screenshots: vec![],
            modified_screenshots: vec![],
            total_files_to_backup: (notes_count + screenshots_count) as usize,
        })
    }

    /// Calculate total backup size (only changed files)
    pub fn calculate_backup_size(
        vault_path: &Path,
        changed_files: &[String],
    ) -> Result<i64, String> {
        let mut total_size: i64 = 0;

        // Add note files
        let notes_dir = vault_path.join("notes");
        if notes_dir.exists() {
            for file_path in changed_files.iter().filter(|p| p.ends_with(".md")) {
                let full_path = vault_path.join(file_path);
                if let Ok(metadata) = fs::metadata(&full_path) {
                    total_size += metadata.len() as i64;
                }
            }
        }

        // Add screenshot files
        let captures_dir = vault_path.join(".glyphic").join("captures");
        if captures_dir.exists() {
            for file_path in changed_files.iter().filter(|p| !p.ends_with(".md")) {
                let full_path = vault_path.join(file_path);
                if let Ok(metadata) = fs::metadata(&full_path) {
                    total_size += metadata.len() as i64;
                }
            }
        }

        // Add metadata overhead (JSON, etc) — estimate 10% extra
        total_size = (total_size as f64 * 1.1) as i64;

        Ok(total_size)
    }

    /// Check if backup size exceeds limit (150 MB)
    pub fn check_size_warning(size_bytes: i64) -> bool {
        const SIZE_LIMIT_MB: i64 = 150;
        const SIZE_LIMIT_BYTES: i64 = SIZE_LIMIT_MB * 1024 * 1024;
        size_bytes > SIZE_LIMIT_BYTES
    }

    /// Record backup completion and update last_backup_timestamp
    pub fn record_backup_completion(
        conn: &Connection,
        _backup_id: &str,
    ) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();

        // Update last backup timestamp
        conn.execute(
            "INSERT OR REPLACE INTO backup_settings (key, value, updated_at) 
             VALUES (?1, ?2, ?3)",
            rusqlite::params![LAST_BACKUP_TIMESTAMP_KEY, &now, &now],
        )
        .map_err(|e| format!("Failed to update last backup timestamp: {e}"))?;

        Ok(())
    }

    /// Get all restore points from backup history (sorted by date DESC)
    pub fn get_restore_points(conn: &Connection, limit: i64) -> Result<Vec<RestorePoint>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT id, timestamp, size_bytes, notes_count, screenshots_count, dropbox_path, status
                 FROM backup_history 
                 WHERE status = 'success'
                 ORDER BY created_at DESC 
                 LIMIT ?1",
            )
            .map_err(|e| format!("Failed to prepare restore points query: {e}"))?;

        let points = stmt
            .query_map(rusqlite::params![limit], |row| {
                Ok(RestorePoint {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    size_bytes: row.get(2)?,
                    files_count: (row.get::<_, i64>(3)? + row.get::<_, i64>(4)?) as usize,
                    notes_changed: row.get::<_, i64>(3)? as usize,
                    screenshots_changed: row.get::<_, i64>(4)? as usize,
                    dropbox_path: row.get(5)?,
                })
            })
            .map_err(|e| format!("Failed to query restore points: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect restore points: {e}"))?;

        Ok(points)
    }

    /// Enable/disable incremental backups in settings
    pub fn set_incremental_enabled(
        conn: &Connection,
        enabled: bool,
    ) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO backup_settings (key, value, updated_at) 
             VALUES (?1, ?2, ?3)",
            rusqlite::params![
                INCREMENTAL_ENABLED_KEY,
                if enabled { "true" } else { "false" },
                &now
            ],
        )
        .map_err(|e| format!("Failed to update incremental setting: {e}"))?;

        Ok(())
    }

    /// Get incremental backup setting
    pub fn is_incremental_enabled(conn: &Connection) -> bool {
        conn.query_row(
            "SELECT value FROM backup_settings WHERE key = ?1",
            rusqlite::params![INCREMENTAL_ENABLED_KEY],
            |row| {
                let val: String = row.get(0)?;
                Ok(val == "true")
            },
        )
        .unwrap_or(true) // Default to true
    }

    /// Build a list of files to include in backup based on change detection
    pub fn build_backup_file_list(
        vault_path: &Path,
        change_result: &ChangeDetectionResult,
    ) -> Result<Vec<PathBuf>, String> {
        let mut files = Vec::new();

        // Add changed note files
        for note_path in &change_result.new_notes {
            let full_path = vault_path.join(note_path);
            if full_path.exists() && full_path.is_file() {
                files.push(full_path);
            }
        }

        // Add changed screenshot files
        for screenshot_path in &change_result.new_screenshots {
            let full_path = vault_path.join(screenshot_path);
            if full_path.exists() && full_path.is_file() {
                files.push(full_path);
            }
            // Also include thumbnail if exists
            if let Some(stem) = Path::new(screenshot_path).file_stem() {
                let thumb_path = vault_path
                    .join(".glyphic")
                    .join("thumbnails")
                    .join(format!("{}.png", stem.to_string_lossy()));
                if thumb_path.exists() {
                    files.push(thumb_path);
                }
            }
        }

        // Include metadata: vault config + backup manifest
        let config_path = vault_path.join(".glyphic").join("config.toml");
        if config_path.exists() {
            files.push(config_path);
        }

        Ok(files)
    }
}
