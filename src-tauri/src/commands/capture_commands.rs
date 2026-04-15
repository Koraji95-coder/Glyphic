use chrono::Utc;
use serde::Serialize;
use tauri::Emitter;

use crate::capture::{crop, overlay, postprocess, screen};

#[derive(Debug, Clone, Serialize)]
pub struct CaptureResult {
    pub path: String,
    pub thumbnail_path: String,
    pub width: u32,
    pub height: u32,
    pub captured_at: String,
}

#[tauri::command]
pub fn start_capture(app: tauri::AppHandle) -> Result<(), String> {
    overlay::show_overlay(&app)
}

#[tauri::command]
pub fn finish_capture(
    app: tauri::AppHandle,
    mode: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    vault_path: String,
) -> Result<CaptureResult, String> {
    // Hide the overlay first so it doesn't appear in the capture
    overlay::hide_overlay(&app)?;

    // Small delay to let the overlay disappear
    std::thread::sleep(std::time::Duration::from_millis(150));

    let screenshot = screen::capture_fullscreen()?;

    let cropped = if mode == "fullscreen" {
        screenshot
    } else {
        crop::crop_region(&screenshot, x, y, width, height)?
    };

    let (img_path, thumb_path) = postprocess::save_capture(&cropped, &vault_path)?;
    let now = Utc::now().to_rfc3339();

    let result = CaptureResult {
        path: img_path,
        thumbnail_path: thumb_path,
        width: cropped.width(),
        height: cropped.height(),
        captured_at: now,
    };

    let _ = app.emit("screenshot-captured", &result);

    Ok(result)
}

#[tauri::command]
pub fn repeat_last_capture(_app: tauri::AppHandle) -> Result<(), String> {
    // TODO: Implement repeat-last-capture logic (store last region and recapture)
    Err("repeat_last_capture not yet implemented".to_string())
}
