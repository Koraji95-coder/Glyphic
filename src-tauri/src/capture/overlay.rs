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

pub fn show_overlay_with_bg(app: &tauri::AppHandle, bg_path: &str) -> Result<(), String> {
    let window = app
        .get_webview_window("capture-overlay")
        .ok_or_else(|| "capture-overlay window not found".to_string())?;

    let encoded = urlencoding_encode(bg_path);

    // Build the navigation URL by updating the path and query on the window's current URL.
    // This preserves the correct scheme/host whether we're in dev (http) or production (tauri).
    let mut nav_url = window
        .url()
        .map_err(|e| format!("Failed to get overlay URL: {e}"))?;
    nav_url.set_path("/capture");
    nav_url.set_query(Some(&format!("bg={encoded}")));

    window
        .navigate(nav_url)
        .map_err(|e| format!("Failed to navigate overlay: {e}"))?;
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

/// Percent-encode a string so it is safe to embed in a URL query value.
/// Only unreserved characters (RFC 3986) are left unencoded.
fn urlencoding_encode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}
