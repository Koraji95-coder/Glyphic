//! Persistence + full-text indexing for screenshot annotations.
//!
//! Annotations live primarily as `<image>.annotations.json` sidecars on
//! disk (image-relative coordinates that survive DB rebuilds). This module
//! mirrors them into SQLite so search can hit the text content of any
//! `text` annotations a user has typed.
//!
//! `annotation_blobs` stores one row per image:
//!   * `image_path` — vault-relative image path (primary key).
//!   * `data`       — the full Fabric.js JSON blob, opaque to Rust.
//!   * `text_index` — concatenated text-annotation strings, indexed in FTS.
//!   * `updated_at` — RFC3339 timestamp of the last write.

use rusqlite::{params, Connection};

/// Persist (or update) the annotation blob for an image.
///
/// `data_json` should be the serialized [`AnnotationData`] payload as
/// produced by the frontend; we only parse it to extract the searchable
/// text fields, never to validate the structure.
pub fn save_blob(conn: &Connection, image_path: &str, data_json: &str) -> Result<(), String> {
    let text_index = extract_text(data_json);
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO annotation_blobs (image_path, data, text_index, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(image_path) DO UPDATE SET
             data       = excluded.data,
             text_index = excluded.text_index,
             updated_at = excluded.updated_at",
        params![image_path, data_json, text_index, now],
    )
    .map_err(|e| format!("Failed to save annotation blob: {e}"))?;
    Ok(())
}

/// Load the annotation blob for an image. Returns `Ok(None)` when there
/// isn't one (rather than an error) so callers can treat absent annotations
/// as the common case.
pub fn load_blob(conn: &Connection, image_path: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT data FROM annotation_blobs WHERE image_path = ?1",
        params![image_path],
        |row| row.get::<_, String>(0),
    )
    .map(Some)
    .or_else(|err| {
        if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            Ok(None)
        } else {
            Err(format!("Failed to load annotation blob: {err}"))
        }
    })
}

/// Delete the annotation blob for an image (if any). Used when the
/// underlying screenshot is removed.
#[allow(dead_code)]
pub fn delete_blob(conn: &Connection, image_path: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM annotation_blobs WHERE image_path = ?1",
        params![image_path],
    )
    .map_err(|e| format!("Failed to delete annotation blob: {e}"))?;
    Ok(())
}

/// Pull text-annotation strings out of the JSON payload. The frontend
/// emits `{"objects": [...]}` where each object may have `type: "text"`
/// and a `text` field. We collect them all into one whitespace-joined
/// string for FTS. Best-effort: malformed payloads return an empty index
/// instead of failing the save.
fn extract_text(data_json: &str) -> String {
    let value: serde_json::Value = match serde_json::from_str(data_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };
    let Some(objects) = value.get("objects").and_then(|v| v.as_array()) else {
        return String::new();
    };
    let mut parts: Vec<&str> = Vec::new();
    for obj in objects {
        if obj.get("type").and_then(|t| t.as_str()) == Some("text") {
            if let Some(text) = obj.get("text").and_then(|t| t.as_str()) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed);
                }
            }
        }
    }
    parts.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_text_from_payload() {
        let json = r#"{
            "version": 1,
            "objects": [
                {"type":"arrow"},
                {"type":"text","text":"hello world"},
                {"type":"text","text":"  spaced  "},
                {"type":"text"},
                {"type":"rect"}
            ]
        }"#;
        assert_eq!(extract_text(json), "hello world spaced");
    }

    #[test]
    fn malformed_returns_empty() {
        assert_eq!(extract_text("not json"), "");
        assert_eq!(extract_text("{}"), "");
        assert_eq!(extract_text("[]"), "");
    }
}
