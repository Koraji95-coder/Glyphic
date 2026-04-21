use chrono::Utc;
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::Emitter;

use crate::capture::{crop, overlay, postprocess, screen, window_detect};
use crate::db::screenshots as screenshots_db;
use crate::ocr;
use crate::vault::config as vault_config;
use crate::DbState;

/// Read the vault config and decide whether to apply auto-trim. Failures to
/// read the config (missing file, parse error) are non-fatal: the user just
/// gets an un-trimmed image, which matches the pre-feature behavior.
fn should_auto_trim(vault_path: &str) -> bool {
    match vault_config::load_config(Path::new(vault_path)) {
        Ok(cfg) => cfg.capture.auto_trim_whitespace,
        Err(_) => false,
    }
}

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
    db_state: tauri::State<'_, DbState>,
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

    // Optionally trim solid-color borders (gated by `capture.auto_trim_whitespace`).
    let cropped = if should_auto_trim(&vault_path) {
        postprocess::trim_uniform_borders(cropped)
    } else {
        cropped
    };

    let (img_path, thumb_path) = postprocess::save_capture(&cropped, &vault_path)?;
    let now = Utc::now().to_rfc3339();

    // OCR + DB row are best-effort: don't fail the capture if either is
    // unavailable (no tesseract installed, DB locked, etc.).
    record_screenshot(
        &db_state,
        &vault_path,
        &img_path,
        &thumb_path,
        cropped.width(),
        cropped.height(),
        &now,
    );

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
    db_state: tauri::State<'_, DbState>,
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
    let cropped = if should_auto_trim(&vault_path) {
        postprocess::trim_uniform_borders(cropped)
    } else {
        cropped
    };
    let (img_path, thumb_path) = postprocess::save_capture(&cropped, &vault_path)?;
    let now = Utc::now().to_rfc3339();

    record_screenshot(
        &db_state,
        &vault_path,
        &img_path,
        &thumb_path,
        cropped.width(),
        cropped.height(),
        &now,
    );

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

/// Re-run OCR on every screenshot row in the DB. Useful after the user
/// installs tesseract for the first time, or upgrades to a newer language
/// pack. Returns `(processed, skipped)` counts.
#[tauri::command]
pub fn reocr_vault(
    db_state: tauri::State<'_, DbState>,
    vault_path: String,
) -> Result<(usize, usize), String> {
    if !ocr::is_available() {
        return Err(
            "OCR not available: install the `tesseract` CLI and ensure it is on PATH.".to_string(),
        );
    }

    // Snapshot the rows before holding the lock for OCR work — tesseract
    // can take seconds per image, and we don't want to block other DB
    // commands for the duration.
    let rows = {
        let conn = db_state
            .0
            .lock()
            .map_err(|e| format!("DB lock error: {e}"))?;
        screenshots_db::list_all(&conn)?
    };

    let mut processed = 0usize;
    let mut skipped = 0usize;
    for (id, rel_path) in rows {
        let abs = Path::new(&vault_path).join(&rel_path);
        if !abs.exists() {
            skipped += 1;
            continue;
        }
        match ocr::ocr_image(&abs) {
            Ok(text) => {
                if let Ok(conn) = db_state.0.lock() {
                    let _ = screenshots_db::update_ocr(&conn, &id, &text);
                }
                processed += 1;
            }
            Err(e) => {
                eprintln!("[ocr] failed on {rel_path}: {e}");
                skipped += 1;
            }
        }
    }
    Ok((processed, skipped))
}

/// Run OCR on a freshly-captured image and insert/update a `screenshots`
/// row so vault search picks it up. Logs and swallows errors — capture
/// itself must always succeed even if OCR or the DB is unhappy.
fn record_screenshot(
    db_state: &tauri::State<'_, DbState>,
    vault_path: &str,
    rel_img_path: &str,
    rel_thumb_path: &str,
    width: u32,
    height: u32,
    captured_at: &str,
) {
    let abs = Path::new(vault_path).join(rel_img_path);
    let ocr_text = match ocr::ocr_image(&abs) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[ocr] {e}");
            String::new()
        }
    };

    if let Ok(conn) = db_state.0.lock() {
        if let Err(e) = screenshots_db::upsert(
            &conn,
            rel_img_path,
            rel_thumb_path,
            width,
            height,
            &ocr_text,
            captured_at,
        ) {
            eprintln!("[capture] failed to record screenshot row: {e}");
        }
    }
}
