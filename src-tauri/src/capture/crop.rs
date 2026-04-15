use image::{DynamicImage, RgbaImage};

pub fn crop_region(
    img: &DynamicImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<DynamicImage, String> {
    if x + width > img.width() || y + height > img.height() {
        return Err(format!(
            "Crop region ({x}, {y}, {width}x{height}) exceeds image bounds ({}x{})",
            img.width(),
            img.height()
        ));
    }

    Ok(img.crop_imm(x, y, width, height))
}

/// Crop the image to the bounding box of the given polygon points, and make
/// everything outside the polygon transparent (PNG with alpha channel).
pub fn crop_freeform(
    img: &DynamicImage,
    points: &[(u32, u32)],
) -> Result<DynamicImage, String> {
    if points.len() < 3 {
        return Err("Freeform capture requires at least 3 points".to_string());
    }

    // Compute bounding box
    let min_x = points.iter().map(|p| p.0).min().unwrap_or(0);
    let min_y = points.iter().map(|p| p.1).min().unwrap_or(0);
    let max_x = points.iter().map(|p| p.0).max().unwrap_or(0).min(img.width().saturating_sub(1));
    let max_y = points.iter().map(|p| p.1).max().unwrap_or(0).min(img.height().saturating_sub(1));

    let box_w = max_x.saturating_sub(min_x) + 1;
    let box_h = max_y.saturating_sub(min_y) + 1;

    if box_w < 2 || box_h < 2 {
        return Err("Freeform selection too small".to_string());
    }

    // Translate points to bounding-box coordinates
    let local_pts: Vec<(u32, u32)> = points.iter().map(|&(x, y)| (x - min_x, y - min_y)).collect();

    // Crop to bounding box first
    let cropped = img.crop_imm(min_x, min_y, box_w, box_h);
    let rgba = cropped.to_rgba8();

    // Create output with transparency outside polygon
    let mut out = RgbaImage::new(box_w, box_h);

    for py in 0..box_h {
        for px in 0..box_w {
            if point_in_polygon(px, py, &local_pts) {
                out.put_pixel(px, py, *rgba.get_pixel(px, py));
            }
            // else leave transparent (default 0,0,0,0)
        }
    }

    Ok(DynamicImage::ImageRgba8(out))
}

/// Ray-casting point-in-polygon test.
fn point_in_polygon(x: u32, y: u32, poly: &[(u32, u32)]) -> bool {
    let (px, py) = (x as f64, y as f64);
    let n = poly.len();
    let mut inside = false;

    let mut j = n - 1;
    for i in 0..n {
        let (xi, yi) = (poly[i].0 as f64, poly[i].1 as f64);
        let (xj, yj) = (poly[j].0 as f64, poly[j].1 as f64);

        if ((yi > py) != (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
        j = i;
    }
    inside
}
