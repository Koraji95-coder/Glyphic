/// Export a note as a self-contained Markdown file.
///
/// All images referenced in the note (via `asset://localhost/` URLs or
/// vault-relative paths) are copied to an `attachments/` sub-directory next
/// to the output file, and the image `src` attributes are rewritten to the
/// corresponding `./attachments/<filename>` relative path. This makes the
/// exported bundle importable in Obsidian or any other Markdown editor.
///
/// The original note and its source images are never modified.
pub fn export_markdown(vault_path: &str, note_path: &str, output_path: &str) -> Result<(), String> {
    let src_path = std::path::Path::new(vault_path).join(note_path);
    if !src_path.exists() {
        return Err(format!("Note not found: {note_path}"));
    }

    let content = std::fs::read_to_string(&src_path)
        .map_err(|e| format!("Failed to read note: {e}"))?;

    let dest = std::path::Path::new(output_path);
    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {e}"))?;
        }
    }

    let (rewritten, images) = rewrite_image_paths(&content, vault_path);

    if !images.is_empty() {
        let attach_dir = dest
            .parent()
            .map(|p| p.join("attachments"))
            .unwrap_or_else(|| std::path::PathBuf::from("attachments"));
        std::fs::create_dir_all(&attach_dir)
            .map_err(|e| format!("Failed to create attachments directory: {e}"))?;
        for (abs_src, filename) in &images {
            let dest_img = attach_dir.join(filename);
            // Best-effort: skip if source is missing (may have been deleted externally).
            let _ = std::fs::copy(abs_src, &dest_img);
        }
    }

    std::fs::write(dest, rewritten)
        .map_err(|e| format!("Failed to write exported markdown: {e}"))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Scan `content` for `![alt](src)` image references, resolve each to an
/// absolute filesystem path, and rewrite to `./attachments/<filename>`.
///
/// Returns the rewritten markdown and a list of `(abs_path, dest_filename)` pairs
/// that should be copied to the `attachments/` directory.
fn rewrite_image_paths(
    content: &str,
    vault_path: &str,
) -> (String, Vec<(std::path::PathBuf, String)>) {
    let mut output = String::with_capacity(content.len() + 64);
    let mut images: Vec<(std::path::PathBuf, String)> = Vec::new();
    let mut seen: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    let mut i = 0usize;
    let bytes = content.as_bytes();

    while i < bytes.len() {
        // Look for the start of an image reference: `![`
        if i + 1 < bytes.len() && bytes[i] == b'!' && bytes[i + 1] == b'[' {
            // Find the end of the alt text `](`
            if let Some(alt_end) = find_substr(content, i + 2, "](") {
                // Find the closing `)` of the src
                if let Some(src_end) = find_char(content, alt_end + 2, ')') {
                    let alt = &content[i + 2..alt_end];
                    let src = &content[alt_end + 2..src_end];

                    // Skip external / data URLs — keep them verbatim.
                    let is_external = src.starts_with("http://")
                        || src.starts_with("https://")
                        || src.starts_with("data:");

                    if is_external {
                        output.push_str(&content[i..=src_end]);
                    } else {
                        // Resolve to absolute path and attempt to copy the file.
                        let abs = resolve_image_path(src, vault_path);
                        if let Some(abs_path) = abs {
                            // Deduplicate: same src → same destination filename.
                            let filename = if let Some(existing) = seen.get(src) {
                                existing.clone()
                            } else {
                                let name = abs_path
                                    .file_name()
                                    .map(|f| f.to_string_lossy().to_string())
                                    .unwrap_or_else(|| "image.png".to_string());
                                seen.insert(src.to_string(), name.clone());
                                images.push((abs_path, name.clone()));
                                name
                            };
                            output.push_str(&format!("![{alt}](./attachments/{filename})"));
                        } else {
                            // Can't resolve — preserve the original text.
                            output.push_str(&content[i..=src_end]);
                        }
                    }
                    i = src_end + 1;
                    continue;
                }
            }
        }

        // Not an image reference — copy the character verbatim (UTF-8 aware).
        let ch_len = content[i..]
            .chars()
            .next()
            .map(|c| c.len_utf8())
            .unwrap_or(1);
        output.push_str(&content[i..i + ch_len]);
        i += ch_len;
    }

    (output, images)
}

/// Try to resolve an image `src` attribute to an absolute filesystem path.
///
/// Handles three cases:
///   1. `asset://localhost/…` — Tauri asset-protocol URL. Strip the scheme and
///      decode percent-encoding.
///   2. Absolute filesystem path — use directly.
///   3. Relative path — join with `vault_path` (stripping a leading `./`).
///
/// Returns `None` if the resolved path does not exist on disk.
fn resolve_image_path(src: &str, vault_path: &str) -> Option<std::path::PathBuf> {
    let path: std::path::PathBuf = if let Some(rest) = src.strip_prefix("asset://localhost/") {
        // On Windows the encoded path starts with `/C:/…`; strip the leading slash.
        let fs_path = if cfg!(windows) && rest.starts_with('/') {
            &rest[1..]
        } else {
            rest
        };
        std::path::PathBuf::from(percent_decode(fs_path))
    } else if std::path::Path::new(src).is_absolute() {
        std::path::PathBuf::from(src)
    } else {
        // Relative to vault root; strip leading `./` if present.
        std::path::Path::new(vault_path).join(src.trim_start_matches("./"))
    };

    if path.exists() { Some(path) } else { None }
}

/// Find the byte offset (relative to the start of `s`) of the first
/// occurrence of `needle` at or after position `start`.
fn find_substr(s: &str, start: usize, needle: &str) -> Option<usize> {
    s[start..].find(needle).map(|p| start + p)
}

/// Find the byte offset (relative to the start of `s`) of the first
/// occurrence of `ch` at or after position `start`.
fn find_char(s: &str, start: usize, ch: char) -> Option<usize> {
    s[start..].find(ch).map(|p| start + p)
}

/// Decode `%XX` percent-encoded bytes in a URL path segment into a UTF-8 string.
fn percent_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (from_hex(bytes[i + 1]), from_hex(bytes[i + 2])) {
                out.push(char::from(hi * 16 + lo));
                i += 3;
                continue;
            }
        }
        out.push(char::from(bytes[i]));
        i += 1;
    }
    out
}

fn from_hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}
