import type { AnnotationData } from '../../types/annotation';

/**
 * Derive the annotation JSON sidecar path from an image path.
 * e.g. "attachments/img.png" → "attachments/img.png.annotations.json"
 */
export function getAnnotationPath(imagePath: string): string {
  return `${imagePath}.annotations.json`;
}

/**
 * Load annotation data for an image. Tries the JSON sidecar (the source of
 * truth) and falls back to the SQLite mirror. Returns null if neither has
 * any annotations for this image yet.
 *
 * `vaultPath` is optional — when omitted, `imagePath` is treated as an
 * absolute filesystem path (matches the existing call sites).
 */
export async function loadAnnotations(imagePath: string, vaultPath = ''): Promise<AnnotationData | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const raw = await invoke<string | null>('load_annotations', {
      vaultPath,
      imagePath,
    });
    if (!raw) return null;
    return JSON.parse(raw) as AnnotationData;
  } catch (e) {
    console.warn('Failed to load annotations:', e);
    return null;
  }
}

/**
 * Persist annotation data for an image. Writes the JSON sidecar (source of
 * truth) and mirrors the payload into the SQLite annotations table so any
 * text annotations show up in vault search.
 */
export async function saveAnnotations(imagePath: string, data: AnnotationData, vaultPath = ''): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke<void>('save_annotations', {
    vaultPath,
    imagePath,
    dataJson: JSON.stringify(data, null, 2),
  });
}
