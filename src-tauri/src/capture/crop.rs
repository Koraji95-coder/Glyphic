use image::DynamicImage;

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
