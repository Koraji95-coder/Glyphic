pub mod ai;
pub mod capture;
pub mod commands;
pub mod db;
pub mod export;
pub mod vault;

use std::sync::Mutex;

use tauri::Manager;

use commands::{
    ai_commands::{self, AiState},
    capture_commands, export_commands, search_commands, settings_commands, vault_commands,
};

pub struct DbState(pub Mutex<rusqlite::Connection>);

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

            // ScribeAI state (provider config + shared HTTP client)
            app.manage(AiState::new());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // capture
            capture_commands::start_capture,
            capture_commands::finish_capture,
            capture_commands::repeat_last_capture,
            capture_commands::get_window_list,
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
            // export
            export_commands::export_pdf,
            export_commands::export_markdown,
            // settings
            settings_commands::get_settings,
            settings_commands::update_settings,
            // ai
            ai_commands::ai_chat,
            ai_commands::ai_summarize,
            ai_commands::ai_flashcards,
            ai_commands::ai_explain,
            ai_commands::ai_explain_screenshot,
            ai_commands::ai_check_connection,
            ai_commands::ai_get_config,
            ai_commands::ai_update_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glyphic");
}
