use tauri::command;

#[command]
pub fn ai_chat(message: String, note_context: Option<String>) -> String {
    let _ = note_context;
    let _ = message;
    "ScribeAI is not yet connected. The AI backend will be wired in Phase 5.".to_string()
}

#[command]
pub fn ai_summarize(note_content: String) -> String {
    let _ = note_content;
    "ScribeAI is not yet connected. The AI backend will be wired in Phase 5.".to_string()
}

#[command]
pub fn ai_flashcards(note_content: String) -> Vec<serde_json::Value> {
    let _ = note_content;
    vec![]
}

#[command]
pub fn ai_explain(text: String) -> String {
    let _ = text;
    "ScribeAI is not yet connected. The AI backend will be wired in Phase 5.".to_string()
}
