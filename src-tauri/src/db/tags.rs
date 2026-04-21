use rusqlite::Connection;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct TagInfo {
    pub name: String,
    pub count: usize,
}

/// Parse the raw frontmatter `tags:` line value into individual tag names.
/// Accepts the YAML inline-array form (`[a, b]`), the empty form (`[]`), or
/// a comma-separated string. Tag names are trimmed and stripped of `#`,
/// surrounding quotes, and surrounding brackets.
pub fn parse_tags_line(raw: &str) -> Vec<String> {
    let trimmed = raw.trim().trim_start_matches('[').trim_end_matches(']');
    if trimmed.is_empty() {
        return Vec::new();
    }
    trimmed
        .split(',')
        .map(|t| {
            t.trim()
                .trim_matches('"')
                .trim_matches('\'')
                .trim_start_matches('#')
                .to_string()
        })
        .filter(|t| !t.is_empty())
        .collect()
}

/// Aggregate tag usage across all indexed notes. Returns `(name, count)`
/// rows sorted by descending count, then by name.
pub fn list_all_tags(conn: &Connection) -> Result<Vec<TagInfo>, String> {
    let mut stmt = conn
        .prepare("SELECT tags FROM notes")
        .map_err(|e| format!("Failed to prepare tag query: {e}"))?;

    let mut counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Tag query failed: {e}"))?;
    for row in rows {
        if let Ok(raw) = row {
            for tag in parse_tags_line(&raw) {
                *counts.entry(tag).or_insert(0) += 1;
            }
        }
    }

    let mut tags: Vec<TagInfo> = counts
        .into_iter()
        .map(|(name, count)| TagInfo { name, count })
        .collect();
    tags.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.name.cmp(&b.name)));
    Ok(tags)
}

/// Return the parsed tags for a single note, looked up by its vault-relative path.
pub fn tags_for_note(conn: &Connection, note_path: &str) -> Result<Vec<String>, String> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT tags FROM notes WHERE path = ?1 LIMIT 1",
            rusqlite::params![note_path],
            |row| row.get(0),
        )
        .ok();
    Ok(raw.map(|r| parse_tags_line(&r)).unwrap_or_default())
}

/// List vault-relative note paths whose frontmatter tags include `tag`.
pub fn notes_with_tag(conn: &Connection, tag: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT path, tags FROM notes")
        .map_err(|e| format!("Failed to prepare notes_with_tag query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("notes_with_tag query failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        if let Ok((path, raw)) = row {
            if parse_tags_line(&raw).iter().any(|t| t == tag) {
                out.push(path);
            }
        }
    }
    out.sort();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_inline_array() {
        assert_eq!(parse_tags_line("[math, calc, physics]"), vec!["math", "calc", "physics"]);
    }

    #[test]
    fn parses_empty_array() {
        assert!(parse_tags_line("[]").is_empty());
        assert!(parse_tags_line("").is_empty());
        assert!(parse_tags_line("   ").is_empty());
    }

    #[test]
    fn strips_quotes_and_hash() {
        // Use a raw string with two-hash delimiter so single `#` characters
        // inside the literal don't terminate the string early.
        assert_eq!(parse_tags_line(r##"["#math", '#calc']"##), vec!["math", "calc"]);
    }

    #[test]
    fn parses_comma_separated() {
        assert_eq!(parse_tags_line("math, calc"), vec!["math", "calc"]);
    }
}
