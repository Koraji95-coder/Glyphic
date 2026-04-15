use tauri::Manager;

pub fn show_overlay(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("capture-overlay")
        .ok_or_else(|| "capture-overlay window not found".to_string())?;

    window
        .show()
        .map_err(|e| format!("Failed to show overlay: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus overlay: {e}"))?;
    Ok(())
}

pub fn hide_overlay(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("capture-overlay")
        .ok_or_else(|| "capture-overlay window not found".to_string())?;

    window
        .hide()
        .map_err(|e| format!("Failed to hide overlay: {e}"))?;
    Ok(())
}
