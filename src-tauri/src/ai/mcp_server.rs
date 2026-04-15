// Simplified RAG context layer.  Searches the vault via FTS5 and returns
// relevant note excerpts to be injected into the AI system prompt.

use rusqlite::Connection;

use crate::db::search;

const MAX_CONTEXT_CHARS: usize = 4_000;

/// Searches the vault for notes relevant to `query` and returns a formatted
/// context block suitable for inclusion in an AI system prompt.
///
/// Returns `None` when no relevant notes are found or the search fails.
pub fn gather_context(conn: &Connection, query: &str) -> Option<String> {
    // FTS5 requires at least one non-empty token; skip trivial queries.
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return None;
    }

    let results = search::search_notes(conn, trimmed, 3).ok()?;
    if results.is_empty() {
        return None;
    }

    let mut context =
        String::from("Relevant notes from the user's vault:\n\n");
    let mut total_chars = 0;

    for result in results {
        let entry = format!("**{}**\n{}\n\n", result.title, result.snippet);
        if total_chars + entry.len() > MAX_CONTEXT_CHARS {
            break;
        }
        context.push_str(&entry);
        total_chars += entry.len();
    }

    Some(context)
}
