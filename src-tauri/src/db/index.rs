use rusqlite::{params, Connection};
use std::path::Path;
use walkdir::WalkDir;

pub fn index_note(
    conn: &Connection,
    id: &str,
    path: &str,
    title: &str,
    content: &str,
    tags: &str,
    created_at: &str,
    modified_at: &str,
) -> Result<(), String> {
    // Upsert by path so saving the same note repeatedly keeps a stable id and
    // FTS rowid (avoiding duplicate rows or churn on every keystroke save).
    conn.execute(
        "INSERT INTO notes (id, path, title, content, tags, created_at, modified_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(path) DO UPDATE SET
             title       = excluded.title,
             content     = excluded.content,
             tags        = excluded.tags,
             modified_at = excluded.modified_at",
        params![id, path, title, content, tags, created_at, modified_at],
    )
    .map_err(|e| format!("Failed to index note: {e}"))?;
    Ok(())
}

pub fn remove_from_index(conn: &Connection, note_path: &str) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE path = ?1", params![note_path])
        .map_err(|e| format!("Failed to remove from index: {e}"))?;
    Ok(())
}

pub fn reindex_vault(conn: &Connection, vault_path: &str) -> Result<usize, String> {
    // Clear existing index
    conn.execute("DELETE FROM notes", [])
        .map_err(|e| format!("Failed to clear index: {e}"))?;

    let base = Path::new(vault_path);
    let mut count: usize = 0;

    for entry in WalkDir::new(base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().map_or(false, |ext| ext == "md")
                && !e.path().to_string_lossy().contains(".glyphic")
        })
    {
        let full_path = entry.path();
        let rel_path = full_path
            .strip_prefix(base)
            .unwrap_or(full_path)
            .to_string_lossy()
            .to_string();

        let content = std::fs::read_to_string(full_path).unwrap_or_default();
        let title = extract_title(&content, full_path);
        let tags = extract_tags(&content);
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        index_note(conn, &id, &rel_path, &title, &content, &tags, &now, &now)?;
        count += 1;
    }

    Ok(count)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_title(content: &str, path: &Path) -> String {
    // Try to get title from YAML frontmatter
    if content.starts_with("---") {
        for line in content.lines().skip(1) {
            if line.starts_with("---") {
                break;
            }
            if let Some(rest) = line.strip_prefix("title:") {
                return rest.trim().trim_matches('"').to_string();
            }
        }
    }
    // Fallback to filename
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string())
}

fn extract_tags(content: &str) -> String {
    if content.starts_with("---") {
        for line in content.lines().skip(1) {
            if line.starts_with("---") {
                break;
            }
            if let Some(rest) = line.strip_prefix("tags:") {
                return rest.trim().to_string();
            }
        }
    }
    String::new()
}
