export function getFileIcon(filename: string): string {
  if (filename.endsWith('.md')) return '📄';
  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.webp')) return '🖼️';
  return '📁';
}
