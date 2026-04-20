//! OCR for screenshots.
//!
//! Implementation strategy: shell out to the `tesseract` CLI when present,
//! and degrade gracefully (no error to the user, just no searchable text)
//! when it isn't. This keeps OCR a *zero-friction* feature for users who
//! already have tesseract installed without forcing every Glyphic user to
//! ship a 30 MB native dependency.
//!
//! On every fresh process we cache whether tesseract is available so we
//! don't pay the lookup cost on every screenshot.

use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;

/// Cached availability of the tesseract CLI. `None` until first probed.
static TESSERACT_AVAILABLE: OnceLock<bool> = OnceLock::new();

/// Returns `true` if the tesseract CLI is on PATH and reports a version.
pub fn is_available() -> bool {
    *TESSERACT_AVAILABLE.get_or_init(|| {
        Command::new("tesseract")
            .arg("--version")
            .output()
            .map(|out| out.status.success())
            .unwrap_or(false)
    })
}

/// Run OCR on `image_path` and return the recognised text, trimmed.
///
/// Returns `Ok(String::new())` (not an error) when tesseract isn't
/// installed — callers treat OCR as a search-quality enhancement, not a
/// hard requirement, so we don't want to fail the whole capture pipeline.
pub fn ocr_image(image_path: &Path) -> Result<String, String> {
    if !is_available() {
        return Ok(String::new());
    }

    // `tesseract <input> stdout -l eng` writes plain text to stdout. We
    // pipe stdout/stderr separately so we can include stderr in any error
    // message without polluting the recognised text.
    let output = Command::new("tesseract")
        .arg(image_path)
        .arg("stdout")
        .arg("-l")
        .arg("eng")
        .output()
        .map_err(|e| format!("Failed to invoke tesseract: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "tesseract failed with status {}: {}",
            output.status, stderr
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
