import type { AnnotationData } from '../../types/annotation';

/**
 * Derive the annotation JSON sidecar path from an image path.
 * e.g. "attachments/img.png" → "attachments/img.png.annotations.json"
 */
export function getAnnotationPath(imagePath: string): string {
  return `${imagePath}.annotations.json`;
}

/**
 * Load annotation data from a JSON sidecar file via the Tauri fs plugin.
 * Returns null if the file doesn't exist.
 */
export async function loadAnnotations(imagePath: string): Promise<AnnotationData | null> {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const sidecarPath = getAnnotationPath(imagePath);
    const raw = await readTextFile(sidecarPath);
    return JSON.parse(raw) as AnnotationData;
  } catch {
    // File doesn't exist or isn't valid JSON — no annotations yet
    return null;
  }
}

/**
 * Save annotation data to a JSON sidecar file alongside the image.
 */
export async function saveAnnotations(imagePath: string, data: AnnotationData): Promise<void> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const sidecarPath = getAnnotationPath(imagePath);
  await writeTextFile(sidecarPath, JSON.stringify(data, null, 2));
}
