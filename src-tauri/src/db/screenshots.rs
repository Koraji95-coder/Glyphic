//! Persistence helpers for the `screenshots` table.
//!
//! Capture flow inserts one row per screenshot so vault search can hit
//! recognised OCR text via the `screenshots_fts` virtual table. Rows are
//! upserted by `path` (vault-relative) so re-OCR of an existing screenshot
//! is idempotent.

use rusqlite::{params, Connection};

/// Insert or update a screenshot row, keyed by `path`. Returns the row's
/// stable `id` (existing id is preserved on update).
pub fn upsert(
    conn: &Connection,
    path: &str,
    thumbnail_path: &str,
    width: u32,
    height: u32,
    ocr_text: &str,
    captured_at: &str,
) -> Result<String, String> {
    // Try to read the existing id first so the FTS rowid stays stable.
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM screenshots WHERE path = ?1 LIMIT 1",
            params![path],
            |row| row.get(0),
        )
        .ok();

    let id = existing.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    conn.execute(
        "INSERT INTO screenshots (id, note_id, path, thumbnail_path, width, height, ocr_text, captured_at)
         VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
             thumbnail_path = excluded.thumbnail_path,
             width          = excluded.width,
             height         = excluded.height,
             ocr_text       = excluded.ocr_text,
             captured_at    = excluded.captured_at",
        params![id, path, thumbnail_path, width as i64, height as i64, ocr_text, captured_at],
    )
    .map_err(|e| format!("Failed to upsert screenshot row: {e}"))?;

    Ok(id)
}

/// Iterate all screenshot rows. Returned tuples are (id, vault-relative path).
pub fn list_all(conn: &Connection) -> Result<Vec<(String, String)>, String> {
    let mut stmt = conn
        .prepare("SELECT id, path FROM screenshots ORDER BY captured_at DESC")
        .map_err(|e| format!("Failed to prepare screenshot list: {e}"))?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| format!("Failed to query screenshots: {e}"))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

/// Update only the OCR text for an existing screenshot row.
pub fn update_ocr(conn: &Connection, id: &str, ocr_text: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE screenshots SET ocr_text = ?1 WHERE id = ?2",
        params![ocr_text, id],
    )
    .map_err(|e| format!("Failed to update OCR text: {e}"))?;
    Ok(())
}
