// MCP (Model Context Protocol) tool server for the Glyphic vault.
// Exposes vault operations as callable tools so that an LLM can query the
// user's notes during a conversation.  The `gather_context` fallback is kept
// for backwards-compatible RAG injection when the LLM does not use tools.

use rusqlite::{params, Connection};
use serde_json::json;

use crate::ai::mcp_protocol::{McpTool, McpToolCall, McpToolResult};
use crate::db::search;

const MAX_CONTEXT_CHARS: usize = 4_000;

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

/// Returns the list of MCP tools available in Glyphic's vault.
pub fn available_tools() -> Vec<McpTool> {
    vec![
        McpTool {
            name: "search_notes".into(),
            description: "Search the user's vault for notes matching a query. \
                Returns matching note titles and relevant snippets."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to look for in the vault."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default 5).",
                        "default": 5
                    }
                },
                "required": ["query"]
            }),
        },
        McpTool {
            name: "get_note".into(),
            description: "Read the full content of a specific note by its path.".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The note path as stored in the vault (relative path)."
                    }
                },
                "required": ["path"]
            }),
        },
        McpTool {
            name: "list_notes".into(),
            description: "List all notes in the vault, optionally filtered to a specific folder."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "folder": {
                        "type": "string",
                        "description": "Optional folder path to list notes from."
                    }
                }
            }),
        },
        McpTool {
            name: "get_recent_notes".into(),
            description: "Return the N most recently modified notes in the vault.".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "count": {
                        "type": "integer",
                        "description": "Number of recent notes to return (default 5).",
                        "default": 5
                    }
                }
            }),
        },
    ]
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

/// Executes an MCP tool call against the vault database.
pub fn execute_tool(conn: &Connection, call: &McpToolCall) -> McpToolResult {
    match call.name.as_str() {
        "search_notes" => execute_search_notes(conn, &call.arguments),
        "get_note" => execute_get_note(conn, &call.arguments),
        "list_notes" => execute_list_notes(conn, &call.arguments),
        "get_recent_notes" => execute_get_recent_notes(conn, &call.arguments),
        other => McpToolResult {
            tool_name: other.to_string(),
            success: false,
            content: format!("Unknown tool: {other}"),
        },
    }
}

fn execute_search_notes(conn: &Connection, args: &serde_json::Value) -> McpToolResult {
    let query = match args.get("query").and_then(|v| v.as_str()) {
        Some(q) => q.to_string(),
        None => {
            return McpToolResult {
                tool_name: "search_notes".into(),
                success: false,
                content: "Missing required parameter: query".into(),
            }
        }
    };
    let limit = args
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(5) as usize;

    match search::search_notes(conn, &query, limit) {
        Ok(results) if results.is_empty() => McpToolResult {
            tool_name: "search_notes".into(),
            success: true,
            content: "No notes found matching the query.".into(),
        },
        Ok(results) => {
            let mut output = format!("Found {} note(s) matching '{}':\n\n", results.len(), query);
            for r in &results {
                output.push_str(&format!("**{}** (path: {})\n{}\n\n", r.title, r.path, r.snippet));
            }
            McpToolResult {
                tool_name: "search_notes".into(),
                success: true,
                content: output,
            }
        }
        Err(e) => McpToolResult {
            tool_name: "search_notes".into(),
            success: false,
            content: format!("Search failed: {e}"),
        },
    }
}

fn execute_get_note(conn: &Connection, args: &serde_json::Value) -> McpToolResult {
    let path = match args.get("path").and_then(|v| v.as_str()) {
        Some(p) => p.to_string(),
        None => {
            return McpToolResult {
                tool_name: "get_note".into(),
                success: false,
                content: "Missing required parameter: path".into(),
            }
        }
    };

    let result: rusqlite::Result<(String, String)> = conn.query_row(
        "SELECT title, content FROM notes WHERE path = ?1",
        params![path],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );

    match result {
        Ok((title, content)) => {
            let truncated = if content.len() > MAX_CONTEXT_CHARS {
                format!("{}…\n[content truncated]", &content[..MAX_CONTEXT_CHARS])
            } else {
                content
            };
            McpToolResult {
                tool_name: "get_note".into(),
                success: true,
                content: format!("# {title}\n\n{truncated}"),
            }
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => McpToolResult {
            tool_name: "get_note".into(),
            success: false,
            content: format!("No note found at path: {path}"),
        },
        Err(e) => McpToolResult {
            tool_name: "get_note".into(),
            success: false,
            content: format!("Failed to read note: {e}"),
        },
    }
}

fn execute_list_notes(conn: &Connection, args: &serde_json::Value) -> McpToolResult {
    let folder_filter = args.get("folder").and_then(|v| v.as_str()).map(str::to_string);

    let query_result: Result<Vec<(String, String, String)>, String> = (|| {
        if let Some(ref folder) = folder_filter {
            let pattern = format!("{folder}%");
            let mut stmt = conn
                .prepare(
                    "SELECT path, title, modified_at FROM notes \
                     WHERE path LIKE ?1 ORDER BY modified_at DESC LIMIT 100",
                )
                .map_err(|e| e.to_string())?;
            let rows: Vec<(String, String, String)> = stmt
                .query_map(params![pattern], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            Ok(rows)
        } else {
            let mut stmt = conn
                .prepare(
                    "SELECT path, title, modified_at FROM notes \
                     ORDER BY modified_at DESC LIMIT 100",
                )
                .map_err(|e| e.to_string())?;
            let rows: Vec<(String, String, String)> = stmt
                .query_map([], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            Ok(rows)
        }
    })();

    match query_result {
        Ok(notes) if notes.is_empty() => McpToolResult {
            tool_name: "list_notes".into(),
            success: true,
            content: "No notes found.".into(),
        },
        Ok(notes) => {
            let mut output = format!("Found {} note(s):\n\n", notes.len());
            for (path, title, modified) in &notes {
                output.push_str(&format!("- **{title}** `{path}` (modified: {modified})\n"));
            }
            McpToolResult {
                tool_name: "list_notes".into(),
                success: true,
                content: output,
            }
        }
        Err(e) => McpToolResult {
            tool_name: "list_notes".into(),
            success: false,
            content: format!("Failed to list notes: {e}"),
        },
    }
}

fn execute_get_recent_notes(conn: &Connection, args: &serde_json::Value) -> McpToolResult {
    let count = args
        .get("count")
        .and_then(|v| v.as_u64())
        .unwrap_or(5) as i64;

    let result: rusqlite::Result<Vec<(String, String, String)>> = conn
        .prepare("SELECT path, title, modified_at FROM notes ORDER BY modified_at DESC LIMIT ?1")
        .and_then(|mut stmt| {
            stmt.query_map(params![count], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
        });

    match result {
        Ok(notes) if notes.is_empty() => McpToolResult {
            tool_name: "get_recent_notes".into(),
            success: true,
            content: "No notes found in the vault.".into(),
        },
        Ok(notes) => {
            let mut output = format!("The {} most recently modified notes:\n\n", notes.len());
            for (path, title, modified) in &notes {
                output.push_str(&format!("- **{title}** `{path}` (modified: {modified})\n"));
            }
            McpToolResult {
                tool_name: "get_recent_notes".into(),
                success: true,
                content: output,
            }
        }
        Err(e) => McpToolResult {
            tool_name: "get_recent_notes".into(),
            success: false,
            content: format!("Failed to get recent notes: {e}"),
        },
    }
}

// ---------------------------------------------------------------------------
// Tool prompt formatting
// ---------------------------------------------------------------------------

/// Formats the available MCP tools as a block that can be appended to the
/// system prompt so the LLM knows what tools are available and how to call
/// them.
pub fn format_tools_for_prompt(tools: &[McpTool]) -> String {
    let mut out = String::from(
        "You have access to the following vault tools. \
To call a tool, respond with ONLY a JSON object on a single line in this exact format:\n\
{\"tool\": \"<tool_name>\", \"arguments\": {<args>}}\n\n\
Available tools:\n",
    );
    for tool in tools {
        out.push_str(&format!("\n- **{}**: {}\n", tool.name, tool.description));
        if let Some(props) = tool.parameters.get("properties") {
            if let Some(obj) = props.as_object() {
                for (param, schema) in obj {
                    let desc = schema
                        .get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let required = tool
                        .parameters
                        .get("required")
                        .and_then(|r| r.as_array())
                        .map(|arr| arr.iter().any(|v| v.as_str() == Some(param)))
                        .unwrap_or(false);
                    let req_marker = if required { " (required)" } else { " (optional)" };
                    out.push_str(&format!("  - `{param}`{req_marker}: {desc}\n"));
                }
            }
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Tool call detection
// ---------------------------------------------------------------------------

/// Attempts to parse an LLM response as a tool call.
/// Looks for `{"tool": "...", "arguments": {...}}` patterns.
pub fn parse_tool_call(response: &str) -> Option<McpToolCall> {
    let trimmed = response.trim();

    // Try the whole response first, then scan line-by-line for embedded JSON.
    let candidates: Vec<&str> = std::iter::once(trimmed)
        .chain(trimmed.lines())
        .collect();

    for candidate in candidates {
        let s = candidate.trim();
        if !s.starts_with('{') {
            continue;
        }
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(s) {
            if let (Some(name), Some(args)) = (
                val.get("tool").and_then(|v| v.as_str()),
                val.get("arguments"),
            ) {
                return Some(McpToolCall {
                    name: name.to_string(),
                    arguments: args.clone(),
                });
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Legacy RAG fallback
// ---------------------------------------------------------------------------

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

    let mut context = String::from("Relevant notes from the user's vault:\n\n");
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
