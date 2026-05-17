import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { commands } from '../../lib/tauri/commands';
import { parseMarkdownToContent } from '../../lib/tiptap/markdownParser';

export function PrintPreview() {
  const [params] = useSearchParams();
  const vaultPath = params.get('vault') ?? '';
  const notePath = params.get('note') ?? '';
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultPath || !notePath) {
      setError('Missing vault or note parameter');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const raw = await commands.readNote(vaultPath, notePath);
        if (cancelled) return;
        const rendered = rewriteAssetUrls(parseMarkdownToContent(raw), vaultPath);
        setHtml(rendered);
      } catch (e) {
        setError(`Failed to load note: ${e}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vaultPath, notePath]);

  // Auto-print after content loads
  useEffect(() => {
    if (!html) return;

    const triggerPrint = async () => {
      await new Promise((r) => setTimeout(r, 300)); // give images time to load
      try {
        await waitForImages();
      } catch {
        // ignore image failures
      }
      window.print();

      // Close window after print dialog
      setTimeout(() => {
        import('@tauri-apps/api/webviewWindow')
          .then(({ getCurrentWebviewWindow }) => getCurrentWebviewWindow().close())
          .catch(() => window.close());
      }, 800);
    };

    triggerPrint();
  }, [html]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-red-400 text-sm">
        Error: {error}
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 text-sm">
        Preparing print preview…
      </div>
    );
  }

  return (
    <div className="print-preview-root">
      <style>{PRINT_CSS}</style>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted local note HTML for print */}
      <div className="print-preview-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function waitForImages(): Promise<void> {
  const imgs = Array.from(document.images);
  if (imgs.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let remaining = imgs.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
    };
    for (const img of imgs) {
      if (img.complete) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    }
    setTimeout(resolve, 3000);
  });
}

function rewriteAssetUrls(html: string, vaultPath: string): string {
  return html.replace(/<img\s+src="([^"]+)"/g, (full, src) => {
    if (/^(https?:|data:|asset:|file:|blob:)/.test(src)) return full;
    const sep = vaultPath.includes('\\') ? '\\' : '/';
    const trimmed = vaultPath.endsWith(sep) ? vaultPath.slice(0, -1) : vaultPath;
    const abs = `${trimmed}${sep}${src.replace(/^\//, '')}`;
    return `<img src="${convertFileSrc(abs)}"`;
  });
}

const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; font-size: 15px; }
  .print-preview-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.65; }
  .print-preview-content { max-width: 780px; margin: 0 auto; padding: 48px 56px; }
  h1 { font-size: 2rem; font-weight: 700; margin: 2rem 0 0.75rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.35rem; }
  h2 { font-size: 1.5rem; font-weight: 600; margin: 1.75rem 0 0.6rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 0.25rem; }
  h3 { font-size: 1.2rem; font-weight: 600; margin: 1.4rem 0 0.5rem; }
  p { margin: 0.6rem 0 0.8rem; }
  ul, ol { padding-left: 1.75rem; margin: 0.5rem 0 0.8rem; }
  li { margin: 0.25rem 0; }
  blockquote { margin: 1rem 0; padding: 0.5rem 1rem; border-left: 4px solid #6366f1; background: #f9f9ff; border-radius: 0 4px 4px 0; }
  code { font-family: 'JetBrains Mono', monospace; background: #f3f4f6; padding: 0.15em 0.35em; border-radius: 3px; }
  pre { background: #1e1e2e; color: #cdd6f4; padding: 1rem 1.25rem; border-radius: 6px; overflow-x: auto; margin: 0.8rem 0; }
  img { max-width: 100%; height: auto; display: block; margin: 0.8rem auto; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
  mark { background: #fef08a; padding: 0 3px; border-radius: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; }
  th { background: #f9fafb; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print {
    @page { margin: 0.65in 0.75in; size: letter; }
    .print-preview-content { padding: 0; max-width: none; }
    h1, h2, h3, h4 { page-break-after: avoid; }
    pre, blockquote, img, table { page-break-inside: avoid; }
  }
`;