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

    // Refresh outgoing-link rows for this note so backlink lookups stay
    // accurate after every save. Resolve against the *actual* note id stored
    // in the DB (the upsert may have kept the original id rather than the
    // newly-generated one we passed in).
    let stored_id: Option<String> = conn
        .query_row(
            "SELECT id FROM notes WHERE path = ?1 LIMIT 1",
            params![path],
            |row| row.get(0),
        )
        .ok();
    if let Some(sid) = stored_id {
        let _ = super::backlinks::reindex_note_links(conn, &sid, content);
    }
    Ok(())
}

pub fn remove_from_index(conn: &Connection, note_path: &str) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE path = ?1", params![note_path])
        .map_err(|e| format!("Failed to remove from index: {e}"))?;
    Ok(())
}

pub fn rename_note_path(conn: &Connection, old_path: &str, new_path: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE notes SET path = ?1, modified_at = ?2 WHERE path = ?3",
        params![new_path, chrono::Utc::now().to_rfc3339(), old_path],
    )
    .map_err(|e| format!("Failed to rename in index: {e}"))?;
    Ok(())
}

pub fn reindex_vault(conn: &Connection, vault_path: &str) -> Result<usize, String> {
    // Clear existing index. Backlinks are wiped along with notes via the
    // ON DELETE CASCADE foreign key.
    conn.execute("DELETE FROM notes", [])
        .map_err(|e| format!("Failed to clear index: {e}"))?;
    // Defensive: also clear backlinks in case a previous run left orphan
    // rows from a schema where the cascade wasn't enforced.
    let _ = conn.execute("DELETE FROM backlinks", []);

    let base = Path::new(vault_path);
    let mut count: usize = 0;

    // First pass: insert all notes so target lookups during link extraction
    // can resolve forward references.
    let mut staged: Vec<(String, String)> = Vec::new(); // (path, content)
    for entry in WalkDir::new(base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().is_some_and(|ext| ext == "md")
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

        // Insert without re-indexing links (we'll do that after all notes exist).
        conn.execute(
            "INSERT INTO notes (id, path, title, content, tags, created_at, modified_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(path) DO UPDATE SET
                 title       = excluded.title,
                 content     = excluded.content,
                 tags        = excluded.tags,
                 modified_at = excluded.modified_at",
            params![id, &rel_path, title, &content, tags, &now, &now],
        )
        .map_err(|e| format!("Failed to index note: {e}"))?;
        staged.push((rel_path, content));
        count += 1;
    }

    // Second pass: extract backlinks now that every note id is known.
    for (path, content) in &staged {
        if let Ok(sid) = conn.query_row(
            "SELECT id FROM notes WHERE path = ?1 LIMIT 1",
            params![path],
            |row| row.get::<_, String>(0),
        ) {
            let _ = super::backlinks::reindex_note_links(conn, &sid, content);
        }
    }

    Ok(count)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

pub fn extract_title(content: &str, path: &Path) -> String {
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

pub fn extract_tags(content: &str) -> String {
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
