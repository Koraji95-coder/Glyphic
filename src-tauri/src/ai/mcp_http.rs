// MCP HTTP server -- exposes Glyphic's vault tools (mcp_server.rs) on a
// local loopback port so the Foundry broker can call them when serving a
// `glyphic-vault` lane conversation.
//
// Endpoints
// ---------
//
//   GET  /health   -- returns 200 OK with `{"ok": true}`. Used by the
//                     broker for liveness checking and port discovery.
//   GET  /tools    -- returns the McpTool registry from
//                     mcp_server::available_tools() so the broker can
//                     advertise the tools to the LLM with their parameter
//                     schemas.
//   POST /execute  -- body: { "name": "...", "arguments": {...} } matching
//                     McpToolCall. Runs the tool against the local vault
//                     SQLite via mcp_server::execute_tool() and returns
//                     McpToolResult.
//
// Binding
// -------
//
// Listens on `127.0.0.1` (loopback only) so the endpoint is unreachable
// from off-host. The port is chosen via the GLYPHIC_MCP_PORT environment
// variable when set, otherwise defaults to 58001. The chosen port is
// written to `{app_data_dir}/.glyphic-mcp-port` so Foundry's broker can
// discover it without hard-coded coordination.
//
// Authentication
// --------------
//
// Loopback binding is the only security layer in G1. Future versions
// should require the toolkit's HMAC bearer token (Phase 1 of the
// activation system) so even a local rogue process can't poll the
// endpoint.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use tauri::{AppHandle, Manager};
use tokio::net::TcpListener;
use tokio::sync::Mutex;

use crate::ai::mcp_protocol::{McpToolCall, McpToolResult};
use crate::ai::mcp_server;
use crate::DbState;

const DEFAULT_PORT: u16 = 58001;
const PORT_SENTINEL_FILE: &str = ".glyphic-mcp-port";

/// Shared state passed to each axum handler. Wraps the Tauri app handle so
/// handlers can reach `DbState` (the rusqlite connection) for tool execution.
#[derive(Clone)]
struct McpHttpState {
    app: AppHandle,
}

/// Resolve the port to bind on. Honors `GLYPHIC_MCP_PORT` so dev runs can
/// avoid conflicts; falls back to DEFAULT_PORT for production.
fn resolve_port() -> u16 {
    std::env::var("GLYPHIC_MCP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT)
}

/// Write the chosen port to `{app_data_dir}/.glyphic-mcp-port` so the
/// Foundry broker can discover it without hard-coded coordination.
fn write_port_sentinel(app: &AppHandle, port: u16) {
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(dir.join(PORT_SENTINEL_FILE), port.to_string());
    }
}

// -- HTTP handlers ---------------------------------------------------------

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "ok": true, "service": "glyphic-mcp" }))
}

async fn list_tools() -> Json<serde_json::Value> {
    let tools = mcp_server::available_tools();
    Json(json!({ "tools": tools }))
}

async fn execute(
    State(state): State<Arc<Mutex<McpHttpState>>>,
    Json(call): Json<McpToolCall>,
) -> Result<Json<McpToolResult>, (StatusCode, String)> {
    let guard = state.lock().await;
    let app = guard.app.clone();
    drop(guard);

    // Acquire the rusqlite Connection through the managed DbState. The mutex
    // is held only for the synchronous tool execution so concurrent calls
    // serialize naturally -- adequate for the LLM-call-rate of a single user.
    let db_state = app
        .try_state::<DbState>()
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "DbState not managed".into()))?;
    let conn_guard = db_state
        .0
        .lock()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db lock poisoned: {e}")))?;

    let result = mcp_server::execute_tool(&*conn_guard, &call);
    Ok(Json(result))
}

// -- Lifecycle -------------------------------------------------------------

/// Start the MCP HTTP server on a background tokio task.
///
/// Must be called from inside the Tauri setup hook after `manage(DbState)`
/// has been called -- the /execute handler relies on DbState being in the
/// state map.
pub fn start_mcp_http_server(app: AppHandle) {
    let port = resolve_port();
    write_port_sentinel(&app, port);

    let state = Arc::new(Mutex::new(McpHttpState { app: app.clone() }));
    let router = Router::new()
        .route("/health", get(health))
        .route("/tools", get(list_tools))
        .route("/execute", post(execute))
        .with_state(state);

    tauri::async_runtime::spawn(async move {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        match TcpListener::bind(addr).await {
            Ok(listener) => {
                log::info!("[mcp-http] listening on http://{addr}");
                if let Err(e) = axum::serve(listener, router).await {
                    log::error!("[mcp-http] server crashed: {e}");
                }
            }
            Err(e) => {
                log::error!("[mcp-http] failed to bind {addr}: {e}");
                eprintln!("[mcp-http] failed to bind {addr}: {e}");
            }
        }
    });
}