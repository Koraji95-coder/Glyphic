#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn capture_fullscreen() -> Result<image::DynamicImage, String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to list monitors: {e}"))?;

    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| {
            // Fallback: try getting all monitors again and pick the first one
            Monitor::all().ok().and_then(|m| m.into_iter().next())
        })
        .ok_or_else(|| "No monitor found".to_string())?;

    let image = primary
        .capture_image()
        .map_err(|e| format!("Failed to capture screen: {e}"))?;

    Ok(image::DynamicImage::ImageRgba8(image))
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn capture_fullscreen() -> Result<image::DynamicImage, String> {
    Err("Screen capture is not supported on this platform".to_string())
}
