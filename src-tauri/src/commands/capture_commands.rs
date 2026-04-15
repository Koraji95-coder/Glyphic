use chrono::Utc;
use serde::Serialize;
use std::sync::Mutex;
use tauri::Emitter;

use crate::capture::{crop, overlay, postprocess, screen, window_detect};

#[derive(Debug, Clone, Serialize)]
pub struct CaptureResult {
    pub path: String,
    pub thumbnail_path: String,
    pub width: u32,
    pub height: u32,
    pub captured_at: String,
}

/// In-memory storage for repeat-last-capture.
pub struct LastCaptureState {
    pub region: Option<LastRegion>,
    pub vault_path: Option<String>,
}

pub struct LastRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

pub type LastCaptureStore = Mutex<LastCaptureState>;

pub fn new_last_capture_store() -> LastCaptureStore {
    Mutex::new(LastCaptureState {
        region: None,
        vault_path: None,
    })
}

#[tauri::command]
pub fn start_capture(app: tauri::AppHandle) -> Result<(), String> {
    overlay::show_overlay(&app)
}

#[tauri::command]
pub fn finish_capture(
    app: tauri::AppHandle,
    last_capture: tauri::State<'_, LastCaptureStore>,
    mode: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    points: Option<Vec<(u32, u32)>>,
    vault_path: String,
) -> Result<CaptureResult, String> {
    // Hide the overlay first so it doesn't appear in the capture
    overlay::hide_overlay(&app)?;

    // Small delay to let the overlay disappear
    std::thread::sleep(std::time::Duration::from_millis(150));

    let screenshot = screen::capture_fullscreen()?;

    let cropped = match mode.as_str() {
        "fullscreen" => screenshot,
        "freeform" => {
            let pts = points.ok_or_else(|| "Internal error: freeform mode called without points parameter".to_string())?;
            crop::crop_freeform(&screenshot, &pts)?
        }
        _ => {
            // region and window modes both use rectangular crop
            crop::crop_region(&screenshot, x, y, width, height)?
        }
    };

    let (img_path, thumb_path) = postprocess::save_capture(&cropped, &vault_path)?;
    let now = Utc::now().to_rfc3339();

    // Store last region for repeat capture
    if mode == "region" || mode == "window" {
        if let Ok(mut state) = last_capture.inner().lock() {
            state.region = Some(LastRegion {
                x,
                y,
                width,
                height,
            });
            state.vault_path = Some(vault_path.clone());
        }
    }

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
pub fn repeat_last_capture(
    app: tauri::AppHandle,
    last_capture: tauri::State<'_, LastCaptureStore>,
) -> Result<CaptureResult, String> {
    let (x, y, width, height, vault_path) = {
        let state = last_capture
            .inner()
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        let region = state
            .region
            .as_ref()
            .ok_or_else(|| "No previous capture region stored".to_string())?;
        let vp = state
            .vault_path
            .as_ref()
            .ok_or_else(|| "No vault path stored".to_string())?
            .clone();
        (region.x, region.y, region.width, region.height, vp)
    };

    // Capture without showing overlay
    let screenshot = screen::capture_fullscreen()?;
    let cropped = crop::crop_region(&screenshot, x, y, width, height)?;
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
pub fn get_window_list() -> Result<Vec<window_detect::WindowInfo>, String> {
    window_detect::list_windows()
}
