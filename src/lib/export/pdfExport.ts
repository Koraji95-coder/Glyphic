import { commands } from '../tauri/commands';

export interface PdfExportOptions {
  /** The vault root path (used by the backend to resolve asset URLs). */
  vaultPath: string;
  /** Vault-relative note path (e.g. "Notes/my-note.md"). */
  notePath: string;
  /**
   * Suggested output file name shown in the OS save dialog.
   * When using the webview print path the OS controls the output location,
   * so this value is forwarded but may be unused by the backend.
   */
  suggestedFileName?: string;
}

/**
 * Derive a suggested PDF file name from a vault-relative note path.
 * Strips the `.md` extension and appends `.pdf`.
 * Example: "Notes/my-note.md" → "my-note.pdf"
 */
export function suggestPdfFileName(notePath: string): string {
  return notePath.split('/').pop()?.replace(/\.md$/i, '.pdf') ?? 'note.pdf';
}

/**
 * Export the current note to PDF via the OS print dialog.
 *
 * Opens a hidden Tauri print-preview webview that fetches the note's markdown,
 * renders it to styled HTML, waits for images, then calls `window.print()`.
 * The user picks "Save as PDF" (or a printer) in the OS dialog and chooses
 * the output path — no file path is required from the caller.
 */
export async function exportNoteToPdf(options: PdfExportOptions): Promise<void> {
  const { vaultPath, notePath, suggestedFileName = suggestPdfFileName(notePath) } = options;
  await commands.exportPdf(vaultPath, notePath, suggestedFileName);
}
