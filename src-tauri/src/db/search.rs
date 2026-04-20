use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub match_type: String,
}

pub fn search_notes(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.path, n.title, snippet(notes_fts, 1, '<mark>', '</mark>', '…', 32)
             FROM notes_fts
             JOIN notes n ON n.rowid = notes_fts.rowid
             WHERE notes_fts MATCH ?1
             LIMIT ?2",
        )
        .map_err(|e| format!("Failed to prepare search: {e}"))?;

    let results = stmt
        .query_map(params![query, limit as i64], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                snippet: row.get(3)?,
                match_type: "note".to_string(),
            })
        })
        .map_err(|e| format!("Search query failed: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

pub fn search_all(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    let mut results = search_notes(conn, query, limit)?;

    // Also search screenshots
    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.path, '', snippet(screenshots_fts, 0, '<mark>', '</mark>', '…', 32)
             FROM screenshots_fts
             JOIN screenshots s ON s.rowid = screenshots_fts.rowid
             WHERE screenshots_fts MATCH ?1
             LIMIT ?2",
        )
        .map_err(|e| format!("Failed to prepare screenshot search: {e}"))?;

    let screenshot_results: Vec<SearchResult> = stmt
        .query_map(params![query, limit as i64], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                snippet: row.get(3)?,
                match_type: "screenshot".to_string(),
            })
        })
        .map_err(|e| format!("Screenshot search failed: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    results.extend(screenshot_results);

    // Also search text-annotation content (image_path is the result key —
    // there's no separate id for annotation rows).
    let mut stmt = conn
        .prepare(
            "SELECT a.image_path,
                    snippet(annotation_blobs_fts, 0, '<mark>', '</mark>', '…', 32)
             FROM annotation_blobs_fts
             JOIN annotation_blobs a ON a.rowid = annotation_blobs_fts.rowid
             WHERE annotation_blobs_fts MATCH ?1
             LIMIT ?2",
        )
        .map_err(|e| format!("Failed to prepare annotation search: {e}"))?;

    let annotation_results: Vec<SearchResult> = stmt
        .query_map(params![query, limit as i64], |row| {
            let path: String = row.get(0)?;
            Ok(SearchResult {
                id: path.clone(),
                path,
                title: String::new(),
                snippet: row.get(1)?,
                match_type: "annotation".to_string(),
            })
        })
        .map_err(|e| format!("Annotation search failed: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    results.extend(annotation_results);
    results.truncate(limit);
    Ok(results)
}
