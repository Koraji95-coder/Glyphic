use chrono::Utc;
use image::{DynamicImage, Rgba};
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

/// Maximum per-channel deviation (out of 255) at which a pixel is still
/// considered to belong to the same uniform border as the corner pixel.
const TRIM_PIXEL_TOLERANCE: u8 = 8;
/// Maximum fraction of pixels in a row/col that may differ from the border
/// color before we stop trimming. Allows the occasional anti-aliased pixel
/// (e.g. window-corner pixels) without preventing the trim.
const TRIM_OUTLIER_FRACTION: f32 = 0.02;

/// Crop solid-color borders around `img`. Inspects each edge in turn and
/// strips rows/columns whose pixels are within `TRIM_PIXEL_TOLERANCE` of
/// the corresponding corner color, allowing up to `TRIM_OUTLIER_FRACTION`
/// outliers per row/col. Returns the original image unchanged if no
/// trimming applies (e.g. image is already tight).
pub fn trim_uniform_borders(img: DynamicImage) -> DynamicImage {
    let rgba = img.to_rgba8();
    let (w, h) = (rgba.width(), rgba.height());
    if w == 0 || h == 0 {
        return img;
    }

    // Use the four corner colors as candidate "background" colors; trim each
    // edge independently using the corresponding corner. This handles images
    // whose top/bottom borders differ from the side borders (e.g. when a
    // window-manager bezel is asymmetric).
    let top_left = rgba.get_pixel(0, 0).0;
    let top_right = rgba.get_pixel(w - 1, 0).0;
    let bottom_left = rgba.get_pixel(0, h - 1).0;
    let bottom_right = rgba.get_pixel(w - 1, h - 1).0;

    // Trim top: iterate rows from 0 downward.
    let mut top = 0u32;
    while top < h {
        let bg = if same_color(&top_left, &top_right) {
            top_left
        } else {
            // Mixed top-corner colors → bail and use top-left only.
            top_left
        };
        if !row_is_uniform(&rgba, top, &bg) {
            break;
        }
        top += 1;
    }

    // Trim bottom.
    let mut bottom = h;
    while bottom > top {
        let bg = if same_color(&bottom_left, &bottom_right) {
            bottom_left
        } else {
            bottom_left
        };
        if !row_is_uniform(&rgba, bottom - 1, &bg) {
            break;
        }
        bottom -= 1;
    }

    // Trim left.
    let mut left = 0u32;
    while left < w {
        let bg = if same_color(&top_left, &bottom_left) {
            top_left
        } else {
            top_left
        };
        if !col_is_uniform(&rgba, left, top, bottom, &bg) {
            break;
        }
        left += 1;
    }

    // Trim right.
    let mut right = w;
    while right > left {
        let bg = if same_color(&top_right, &bottom_right) {
            top_right
        } else {
            top_right
        };
        if !col_is_uniform(&rgba, right - 1, top, bottom, &bg) {
            break;
        }
        right -= 1;
    }

    let new_w = right.saturating_sub(left);
    let new_h = bottom.saturating_sub(top);
    if new_w == 0 || new_h == 0 || (new_w == w && new_h == h) {
        return img;
    }
    img.crop_imm(left, top, new_w, new_h)
}

fn same_color(a: &[u8; 4], b: &[u8; 4]) -> bool {
    pixel_close(a, b)
}

fn pixel_close(a: &[u8; 4], b: &[u8; 4]) -> bool {
    a.iter()
        .zip(b.iter())
        .all(|(x, y)| (*x as i16 - *y as i16).unsigned_abs() <= TRIM_PIXEL_TOLERANCE as u16)
}

fn row_is_uniform(rgba: &image::RgbaImage, y: u32, bg: &[u8; 4]) -> bool {
    let w = rgba.width();
    let mut outliers = 0u32;
    let allowed = ((w as f32) * TRIM_OUTLIER_FRACTION) as u32;
    for x in 0..w {
        let Rgba(p) = *rgba.get_pixel(x, y);
        if !pixel_close(&p, bg) {
            outliers += 1;
            if outliers > allowed {
                return false;
            }
        }
    }
    true
}

fn col_is_uniform(rgba: &image::RgbaImage, x: u32, y0: u32, y1: u32, bg: &[u8; 4]) -> bool {
    if y1 <= y0 {
        return true;
    }
    let height = y1 - y0;
    let mut outliers = 0u32;
    let allowed = ((height as f32) * TRIM_OUTLIER_FRACTION) as u32;
    for y in y0..y1 {
        let Rgba(p) = *rgba.get_pixel(x, y);
        if !pixel_close(&p, bg) {
            outliers += 1;
            if outliers > allowed {
                return false;
            }
        }
    }
    true
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

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    /// A 40×30 image consisting of a red 20×10 inner rectangle padded by a
    /// solid white border. After trimming, only the red rectangle should remain.
    #[test]
    fn trims_solid_white_borders() {
        let mut buf = ImageBuffer::from_pixel(40, 30, Rgba([255u8, 255, 255, 255]));
        for y in 10..20 {
            for x in 10..30 {
                buf.put_pixel(x, y, Rgba([255, 0, 0, 255]));
            }
        }
        let img = DynamicImage::ImageRgba8(buf);
        let trimmed = trim_uniform_borders(img);
        assert_eq!(trimmed.width(), 20);
        assert_eq!(trimmed.height(), 10);
        // Spot-check the corner is the inner red color.
        let p = trimmed.to_rgba8().get_pixel(0, 0).0;
        assert_eq!(p, [255, 0, 0, 255]);
    }

    /// An image with no uniform border should be returned unchanged.
    #[test]
    fn no_change_when_no_border() {
        // Build an image whose every edge has multiple distinct colors so no
        // edge can match a uniform-corner heuristic.
        let mut buf = ImageBuffer::from_pixel(20, 20, Rgba([10u8, 20, 30, 255]));
        for x in 0..20 {
            buf.put_pixel(x, 0, Rgba([(x * 12) as u8, 0, 0, 255]));
            buf.put_pixel(x, 19, Rgba([0, (x * 12) as u8, 0, 255]));
        }
        for y in 0..20 {
            buf.put_pixel(0, y, Rgba([0, 0, (y * 12) as u8, 255]));
            buf.put_pixel(19, y, Rgba([(y * 12) as u8, (y * 12) as u8, 0, 255]));
        }
        let img = DynamicImage::ImageRgba8(buf);
        let trimmed = trim_uniform_borders(img);
        assert_eq!(trimmed.width(), 20);
        assert_eq!(trimmed.height(), 20);
    }

    /// Tolerates a small number of off-color pixels per row (anti-aliasing).
    #[test]
    fn tolerates_small_outliers() {
        let mut buf = ImageBuffer::from_pixel(100, 30, Rgba([255u8, 255, 255, 255]));
        // Drop a single off-color pixel into row 2 — should still be trimmed.
        buf.put_pixel(50, 2, Rgba([0, 0, 0, 255]));
        // Inner content rows.
        for y in 10..20 {
            for x in 10..90 {
                buf.put_pixel(x, y, Rgba([100, 100, 100, 255]));
            }
        }
        let img = DynamicImage::ImageRgba8(buf);
        let trimmed = trim_uniform_borders(img);
        assert!(trimmed.height() < 30);
        assert!(trimmed.width() < 100);
    }
}

