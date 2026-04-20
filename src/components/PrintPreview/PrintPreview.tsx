import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { commands } from '../../lib/tauri/commands';
import { parseMarkdownToContent } from '../../lib/tiptap/markdownParser';

/**
 * Hidden print-preview route used by the PDF export pipeline. The flow is:
 *   1. Backend opens this route in a separate WebviewWindow with
 *      `?vault=...&note=...` query params.
 *   2. We fetch the note's markdown, render it to HTML, and rewrite image
 *      sources through the asset: protocol so they actually load.
 *   3. Once the layout is painted we call `window.print()`. The user picks
 *      "Save as PDF" in the OS dialog and chooses the output path.
 *   4. After print returns control we close the window.
 */
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

  // Trigger print after the rendered HTML has had a chance to paint and
  // images have loaded. We close the window after the print dialog returns
  // (whether the user saved or cancelled).
  useEffect(() => {
    if (!html) return;
    let triggered = false;
    const trigger = async () => {
      if (triggered) return;
      triggered = true;
      // Give the browser a tick to lay out images before printing.
      await new Promise((r) => setTimeout(r, 250));
      try {
        await waitForImages();
      } catch {
        /* ignore image load failures, still print */
      }
      window.print();
      // window.print() is synchronous in most browsers; close shortly after.
      setTimeout(() => {
        try {
          import('@tauri-apps/api/webviewWindow')
            .then(({ getCurrentWebviewWindow }) => getCurrentWebviewWindow().close())
            .catch(() => window.close());
        } catch {
          window.close();
        }
      }, 500);
    };
    trigger();
  }, [html]);

  if (error) {
    return <div style={{ padding: 32, fontFamily: 'sans-serif' }}>Error: {error}</div>;
  }
  if (!html) {
    return <div style={{ padding: 32, fontFamily: 'sans-serif' }}>Preparing…</div>;
  }

  return (
    <div className="print-preview-root">
      {/* Print-friendly stylesheet kept inline so it survives the isolated window. */}
      <style>{PRINT_CSS}</style>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: rendering trusted local note HTML for print preview */}
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
      if (img.complete) {
        done();
      } else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    }
    // Hard timeout so we never hang waiting for a broken image.
    setTimeout(resolve, 3000);
  });
}

/**
 * Rewrite image src attributes in the rendered note HTML so vault-relative
 * paths are routed through Tauri's `asset:` protocol. Absolute URLs (http(s),
 * data:, asset:) are left untouched.
 */
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
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  .print-preview-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.5;
    color: #111;
    background: #fff;
  }
  .print-preview-content { max-width: 800px; margin: 0 auto; padding: 32px; }
  .print-preview-content h1 { font-size: 1.8rem; margin: 1rem 0 0.6rem; }
  .print-preview-content h2 { font-size: 1.5rem; margin: 1rem 0 0.5rem; }
  .print-preview-content h3 { font-size: 1.25rem; margin: 0.8rem 0 0.4rem; }
  .print-preview-content p { margin: 0.5rem 0; }
  .print-preview-content ul, .print-preview-content ol { padding-left: 1.5rem; margin: 0.5rem 0; }
  .print-preview-content li > p { margin: 0.2rem 0; }
  .print-preview-content blockquote {
    margin: 0.6rem 0; padding: 0.4rem 0.8rem;
    border-left: 3px solid #aaa; color: #444; background: #f7f7f7;
  }
  .print-preview-content pre {
    background: #f4f4f4; padding: 0.8rem 1rem; border-radius: 4px;
    overflow-x: auto; font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.85rem;
  }
  .print-preview-content code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.9em; }
  .print-preview-content img { max-width: 100%; height: auto; page-break-inside: avoid; }
  .print-preview-content mark { background: #fff59d; padding: 0 2px; }
  .print-preview-content a { color: #2563eb; text-decoration: underline; }
  .print-preview-content hr { border: 0; border-top: 1px solid #ccc; margin: 1rem 0; }
  .print-preview-content [data-type="taskItem"] { list-style: none; }
  .print-preview-content [data-type="taskItem"]::before {
    content: "☐ "; margin-right: 4px;
  }
  .print-preview-content [data-type="taskItem"][data-checked="true"]::before {
    content: "☑ ";
  }
  .print-preview-content [data-type="timestamp"] {
    display: inline-block; padding: 0 4px; margin: 0 2px;
    background: #eef; border-radius: 4px; font-size: 0.75em; color: #335;
  }
  .print-preview-content [data-type="timestamp"]::before {
    content: "[" attr(data-elapsed) "]";
  }
  @media print {
    @page { margin: 0.5in; }
    .print-preview-content { padding: 0; max-width: none; }
  }
`;
