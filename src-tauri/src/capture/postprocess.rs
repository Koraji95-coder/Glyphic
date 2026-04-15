use chrono::Utc;
use image::DynamicImage;
use std::path::Path;
use uuid::Uuid;

pub fn generate_thumbnail(img: &DynamicImage, max_width: u32) -> DynamicImage {
    let (w, h) = (img.width(), img.height());
    if w <= max_width {
        return img.clone();
    }
    let new_height = (h as f64 * max_width as f64 / w as f64) as u32;
    img.resize(max_width, new_height, image::imageops::FilterType::Lanczos3)
}

/// Save a captured image and its thumbnail into the vault's Unsorted/attachments/ directory.
/// Returns `(image_path, thumbnail_path)` relative to the vault root.
pub fn save_capture(
    img: &DynamicImage,
    vault_path: &str,
) -> Result<(String, String), String> {
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let id = &Uuid::new_v4().to_string()[..8];

    let attachments_dir = Path::new(vault_path)
        .join("Unsorted")
        .join("attachments");

    std::fs::create_dir_all(&attachments_dir)
        .map_err(|e| format!("Failed to create attachments dir: {e}"))?;

    // Full image
    let img_name = format!("capture_{timestamp}_{id}.png");
    let img_full = attachments_dir.join(&img_name);
    img.save(&img_full)
        .map_err(|e| format!("Failed to save image: {e}"))?;

    // Thumbnail
    let thumb = generate_thumbnail(img, 400);
    let thumb_name = format!("capture_{timestamp}_{id}_thumb.png");
    let thumb_full = attachments_dir.join(&thumb_name);
    thumb
        .save(&thumb_full)
        .map_err(|e| format!("Failed to save thumbnail: {e}"))?;

    let rel_img = format!("Unsorted/attachments/{img_name}");
    let rel_thumb = format!("Unsorted/attachments/{thumb_name}");

    Ok((rel_img, rel_thumb))
}
