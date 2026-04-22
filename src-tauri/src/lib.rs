pub mod ai;
pub mod capture;
pub mod commands;
pub mod db;
pub mod export;
pub mod ocr;
pub mod vault;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialise an in-memory DB as a placeholder until a vault is opened.
            let conn = rusqlite::Connection::open_in_memory()
                .expect("failed to create placeholder database");
            app.manage(DbState(Mutex::new(conn)));

            // In-memory store for repeat-last-capture
            app.manage(capture_commands::new_last_capture_store());

            // In-memory store for the current capture session's temp screenshot path
            app.manage(CaptureSessionState(Mutex::new(None)));

            // Holds the currently-running vault filesystem watcher (if any).
            app.manage(WatcherState(Mutex::new(None)));

            // ScribeAI state (provider config + shared HTTP client)
            app.manage(AiState::new());

            Ok(())
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
            // vault
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
            // app state (recent vaults / first-launch detection)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glyphic");
}
