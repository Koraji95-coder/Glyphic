//! Backlink extraction and persistence.
//!
//! For every note that gets indexed we scan its body for outgoing links and
//! record them in the `backlinks` table so the UI can later answer "which
//! notes link to this one?".
//!
//! Two link forms are recognised:
//!   * `[[wiki link]]` / `[[notes/foo|alias]]` — Obsidian-style wikilinks.
//!     The target is matched against note paths and titles.
//!   * `[label](relative/path.md)` — standard Markdown links to local notes.
//!     Absolute URLs (http(s):, mailto:, etc.) are ignored.
//!
//! Resolution is best-effort: we look up the target by exact path match
//! first, then by basename, then by title (case-insensitive). If nothing
//! matches the link is silently dropped (we don't track unresolved links —
//! a future enhancement could surface them).

use rusqlite::{params, Connection};

/// Re-extract the outgoing links for a note and replace its rows in the
/// `backlinks` table. Safe to call repeatedly on the same note.
pub fn reindex_note_links(conn: &Connection, source_id: &str, body: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM backlinks WHERE source_note_id = ?1",
        params![source_id],
    )
    .map_err(|e| format!("Failed to clear old backlinks: {e}"))?;

    let links = extract_links(body);
    if links.is_empty() {
        return Ok(());
    }

    for link in links {
        if let Some(target_id) = resolve_target(conn, &link.target) {
            // Don't record self-links — they're noise in the UI.
            if target_id == source_id {
                continue;
            }
            let id = uuid::Uuid::new_v4().to_string();
            // Best-effort insert; ignore failures so one bad row can't sink
            // the whole index pass.
            let _ = conn.execute(
                "INSERT INTO backlinks (id, source_note_id, target_note_id, context)
                 VALUES (?1, ?2, ?3, ?4)",
                params![id, source_id, target_id, link.context],
            );
        }
    }

    Ok(())
}

#[derive(Debug, Clone)]
struct ExtractedLink {
    /// The raw target text from the link (path or wikilink target).
    target: String,
    /// A short snippet of the line containing the link, for UI display.
    context: String,
}

/// Scan markdown text for outgoing links. Skips fenced code blocks so we
/// don't pick up examples inside `\`\`\`...\`\`\``.
fn extract_links(body: &str) -> Vec<ExtractedLink> {
    let mut out: Vec<ExtractedLink> = Vec::new();
    let mut in_fence = false;
    for line in body.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let trimmed = line.trim();
        let context = if trimmed.len() > 200 {
            format!("{}…", &trimmed[..200])
        } else {
            trimmed.to_string()
        };

        for target in scan_wikilinks(line) {
            out.push(ExtractedLink {
                target,
                context: context.clone(),
            });
        }
        for target in scan_md_links(line) {
            out.push(ExtractedLink {
                target,
                context: context.clone(),
            });
        }
    }
    out
}

/// Extract `[[target]]` or `[[target|alias]]` link targets from a single line.
fn scan_wikilinks(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bytes = line.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            if let Some(end) = find_close(line, i + 2, "]]") {
                let inner = &line[i + 2..end];
                // Strip any pipe alias.
                let target = inner.split('|').next().unwrap_or(inner).trim();
                if !target.is_empty() {
                    out.push(target.to_string());
                }
                i = end + 2;
                continue;
            }
        }
        i += 1;
    }
    out
}

/// Extract `[label](target)` link targets, skipping non-local URLs.
fn scan_md_links(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        // Skip image syntax `![label](target)` — those reference attachments,
        // not notes. We need to advance past the closing `)` so the `[...]`
        // inside the image syntax isn't picked up as a regular link.
        if bytes[i] == b'!' && bytes.get(i + 1) == Some(&b'[') {
            if let Some(label_end) = find_close(line, i + 2, "]") {
                if line.as_bytes().get(label_end + 1) == Some(&b'(') {
                    if let Some(target_end) = find_close(line, label_end + 2, ")") {
                        i = target_end + 1;
                        continue;
                    }
                }
            }
            // Malformed image — advance past the `!`.
            i += 1;
            continue;
        }
        if bytes[i] == b'[' {
            // Find the matching `]` that's followed by `(`.
            if let Some(label_end) = find_close(line, i + 1, "]") {
                if line.as_bytes().get(label_end + 1) == Some(&b'(') {
                    if let Some(target_end) = find_close(line, label_end + 2, ")") {
                        let target = line[label_end + 2..target_end].trim();
                        // Skip absolute URLs and anchor-only links.
                        if !target.is_empty()
                            && !target.starts_with('#')
                            && !is_absolute_url(target)
                        {
                            // Strip any `#fragment` and `?query` from local paths.
                            let clean = target
                                .split(['#', '?'])
                                .next()
                                .unwrap_or(target)
                                .trim()
                                .to_string();
                            if !clean.is_empty() {
                                out.push(clean);
                            }
                        }
                        i = target_end + 1;
                        continue;
                    }
                }
            }
        }
        i += 1;
    }
    out
}

fn is_absolute_url(s: &str) -> bool {
    // Quick check for scheme://... or mailto:, javascript:, etc.
    if let Some(idx) = s.find(':') {
        let scheme = &s[..idx];
        if !scheme.is_empty() && scheme.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '-' || c == '.')
        {
            return true;
        }
    }
    false
}

fn find_close(s: &str, start: usize, needle: &str) -> Option<usize> {
    s[start..].find(needle).map(|p| start + p)
}

/// Try to find a `notes.id` for the given link target. Tries an exact-path
/// match first, then the same with `.md` appended, then a basename match,
/// then a case-insensitive title match.
fn resolve_target(conn: &Connection, target: &str) -> Option<String> {
    let target = target.trim();
    if target.is_empty() {
        return None;
    }

    // 1. Exact path match.
    if let Ok(id) = conn.query_row(
        "SELECT id FROM notes WHERE path = ?1 LIMIT 1",
        params![target],
        |row| row.get::<_, String>(0),
    ) {
        return Some(id);
    }
    // 2. Path with `.md` appended (wikilinks usually omit the extension).
    let with_md = if target.ends_with(".md") {
        target.to_string()
    } else {
        format!("{target}.md")
    };
    if with_md != target {
        if let Ok(id) = conn.query_row(
            "SELECT id FROM notes WHERE path = ?1 LIMIT 1",
            params![with_md],
            |row| row.get::<_, String>(0),
        ) {
            return Some(id);
        }
    }
    // 3. Basename match (path ends with the link target).
    let pattern_md = format!("%/{with_md}");
    if let Ok(id) = conn.query_row(
        "SELECT id FROM notes WHERE path = ?1 OR path LIKE ?2 LIMIT 1",
        params![with_md, pattern_md],
        |row| row.get::<_, String>(0),
    ) {
        return Some(id);
    }
    // 4. Title match (case-insensitive).
    if let Ok(id) = conn.query_row(
        "SELECT id FROM notes WHERE LOWER(title) = LOWER(?1) LIMIT 1",
        params![target],
        |row| row.get::<_, String>(0),
    ) {
        return Some(id);
    }
    None
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Backlink {
    pub source_id: String,
    pub source_path: String,
    pub source_title: String,
    pub context: String,
}

/// Return all notes that link to the given note (by path).
pub fn get_backlinks(conn: &Connection, note_path: &str) -> Result<Vec<Backlink>, String> {
    let target_id: String = match conn.query_row(
        "SELECT id FROM notes WHERE path = ?1 LIMIT 1",
        params![note_path],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(_) => return Ok(Vec::new()),
    };

    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.path, n.title, b.context
             FROM backlinks b
             JOIN notes n ON n.id = b.source_note_id
             WHERE b.target_note_id = ?1
             ORDER BY n.title",
        )
        .map_err(|e| format!("Failed to prepare backlinks query: {e}"))?;

    let rows = stmt
        .query_map(params![target_id], |row| {
            Ok(Backlink {
                source_id: row.get(0)?,
                source_path: row.get(1)?,
                source_title: row.get(2)?,
                context: row.get(3)?,
            })
        })
        .map_err(|e| format!("Backlinks query failed: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_wikilinks() {
        let body = "see [[Other Note]] and [[notes/foo|alias]] please";
        let links = extract_links(body);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert!(targets.contains(&"Other Note"));
        assert!(targets.contains(&"notes/foo"));
    }

    #[test]
    fn extracts_md_links_skipping_external() {
        let body = "[link](./foo.md) and [ext](https://example.com) and [img](attachments/x.png)";
        let links = extract_links(body);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert!(targets.contains(&"./foo.md"));
        assert!(targets.contains(&"attachments/x.png"));
        assert!(!targets.iter().any(|t| t.starts_with("https://")));
    }

    #[test]
    fn skips_links_inside_code_fences() {
        let body = "outside [[a]]\n```\ninside [[b]]\n```\nafter [[c]]";
        let links = extract_links(body);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert!(targets.contains(&"a"));
        assert!(!targets.contains(&"b"));
        assert!(targets.contains(&"c"));
    }

    #[test]
    fn skips_image_syntax() {
        let body = "![alt](path.png) and [link](other.md)";
        let links = extract_links(body);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert!(!targets.contains(&"path.png"));
        assert!(targets.contains(&"other.md"));
    }

    #[test]
    fn strips_anchors_and_aliases() {
        let body = "[a](foo.md#section) [[bar|baz]]";
        let links = extract_links(body);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert!(targets.contains(&"foo.md"));
        assert!(targets.contains(&"bar"));
    }
}
