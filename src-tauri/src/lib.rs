pub mod ai;
pub mod capture;
pub mod commands;
pub mod db;
pub mod export;
pub mod ocr;
pub mod vault;
// ← Remove pub mod diagrams; and pub mod fe; from here
//   They belong inside commands/mod.rs

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::Manager;

use commands::{
    ai_commands::{self, AiState},
    annotation_commands, capture_commands, export_commands, search_commands, settings_commands,
    state_commands, tag_commands, vault_commands,
};
use vault::watcher::VaultWatcher;

pub struct DbState(pub Mutex<rusqlite::Connection>);
pub struct WatcherState(pub Mutex<Option<VaultWatcher>>);
pub struct CaptureSessionState(pub Mutex<Option<PathBuf>>);

pub struct ActiveStreams(
    pub tokio::sync::Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>,
);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let conn = rusqlite::Connection::open_in_memory()
                .expect("failed to create placeholder database");
            app.manage(DbState(Mutex::new(conn)));
            app.manage(capture_commands::new_last_capture_store());
            app.manage(CaptureSessionState(Mutex::new(None)));
            app.manage(WatcherState(Mutex::new(None)));
            app.manage(AiState::new());
            app.manage(ActiveStreams(tokio::sync::Mutex::new(HashMap::new())));
            Ok(())
            // ← No invoke_handler inside setup — that was the syntax error
        })
        .invoke_handler(tauri::generate_handler![
            // capture
            capture_commands::start_capture,
            capture_commands::finish_capture,
            capture_commands::cancel_capture,
            capture_commands::repeat_last_capture,
            capture_commands::get_window_list,
            capture_commands::reocr_vault,
            capture_commands::ocr_available,
            // vault management (existing)
            vault_commands::create_vault,
            vault_commands::open_vault,
            vault_commands::list_vault_contents,
            vault_commands::create_note,
            vault_commands::read_note,
            vault_commands::save_note,
            vault_commands::delete_note,
            vault_commands::rename_note,
            vault_commands::create_folder,
            // search
            search_commands::search_notes,
            search_commands::search_all,
            search_commands::reindex_vault,
            search_commands::get_backlinks,
            // tags
            tag_commands::list_all_tags,
            tag_commands::tags_for_note,
            tag_commands::notes_with_tag,
            // export
            export_commands::export_pdf,
            export_commands::export_markdown,
            // annotations
            annotation_commands::save_annotations,
            annotation_commands::load_annotations,
            // settings
            settings_commands::get_settings,
            settings_commands::update_settings,
            // state
            state_commands::get_recent_vaults,
            state_commands::add_recent_vault,
            // ai
            ai_commands::ai_chat,
            ai_commands::ai_summarize,
            ai_commands::ai_flashcards,
            ai_commands::ai_explain,
            ai_commands::ai_explain_screenshot,
            ai_commands::ai_check_connection,
            ai_commands::ai_get_config,
            ai_commands::ai_update_config,
            ai_commands::ai_list_models,
            ai_commands::pull_model,
            ai_commands::ai_chat_stream,
            ai_commands::cancel_chat,
            // vault ingestion
            commands::vault_study::ingest_document,
            commands::vault_study::ingest_url,
            commands::vault_study::query_vault,
            commands::vault_study::search_vault,
            commands::vault_study::list_vault_sources,
            commands::vault_study::delete_vault_source,
            commands::vault_study::generate_flashcards,
            // diagrams
            commands::diagram_commands::render_diagram,
            // FE prep
            commands::fe_commands::list_fe_topics,
            commands::fe_commands::record_fe_attempt,
            commands::fe_commands::get_fe_statistics,
            commands::fe_commands::get_weak_fe_topics,
            commands::fe_commands::start_fe_session,
            commands::fe_commands::complete_fe_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glyphic");
}