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
  *, *::before, *::after { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-size: 15px;
  }

  .print-preview-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    line-height: 1.65;
    color: #1a1a1a;
    background: #fff;
  }

  .print-preview-content {
    max-width: 780px;
    margin: 0 auto;
    padding: 48px 56px;
  }

  /* Headings */
  .print-preview-content h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 2rem 0 0.75rem;
    line-height: 1.25;
    page-break-after: avoid;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.35rem;
  }
  .print-preview-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.75rem 0 0.6rem;
    line-height: 1.3;
    page-break-after: avoid;
    border-bottom: 1px solid #f0f0f0;
    padding-bottom: 0.25rem;
  }
  .print-preview-content h3 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 1.4rem 0 0.5rem;
    page-break-after: avoid;
  }
  .print-preview-content h4 {
    font-size: 1rem;
    font-weight: 600;
    margin: 1.2rem 0 0.4rem;
    page-break-after: avoid;
  }

  /* Body text */
  .print-preview-content p { margin: 0.6rem 0 0.8rem; }
  .print-preview-content a { color: #2563eb; text-decoration: underline; }
  .print-preview-content strong { font-weight: 700; }
  .print-preview-content em { font-style: italic; }

  /* Lists */
  .print-preview-content ul,
  .print-preview-content ol {
    padding-left: 1.75rem;
    margin: 0.5rem 0 0.8rem;
  }
  .print-preview-content li { margin: 0.25rem 0; }
  .print-preview-content li > p { margin: 0.15rem 0; }

  /* Task lists */
  .print-preview-content [data-type="taskItem"] { list-style: none; margin-left: -1.25rem; }
  .print-preview-content [data-type="taskItem"]::before { content: "☐ "; }
  .print-preview-content [data-type="taskItem"][data-checked="true"]::before { content: "☑ "; color: #059669; }

  /* Blockquotes */
  .print-preview-content blockquote {
    margin: 1rem 0;
    padding: 0.5rem 1rem;
    border-left: 4px solid #6366f1;
    background: #f9f9ff;
    color: #374151;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid;
  }

  /* Code */
  .print-preview-content code {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 0.875em;
    background: #f3f4f6;
    padding: 0.15em 0.35em;
    border-radius: 3px;
    color: #dc2626;
  }
  .print-preview-content pre {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 1rem 1.25rem;
    border-radius: 6px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0.8rem 0 1rem;
    page-break-inside: avoid;
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .print-preview-content pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
    border-radius: 0;
  }

  /* Images */
  .print-preview-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.8rem auto;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    page-break-inside: avoid;
  }

  /* Highlights & marks */
  .print-preview-content mark {
    background: #fef08a;
    padding: 0 3px;
    border-radius: 2px;
  }

  /* Horizontal rule */
  .print-preview-content hr {
    border: 0;
    border-top: 1px solid #d1d5db;
    margin: 1.5rem 0;
  }

  /* Timestamp badges */
  .print-preview-content [data-type="timestamp"] {
    display: inline-block;
    padding: 1px 5px;
    margin: 0 2px;
    background: #ede9fe;
    border-radius: 4px;
    font-size: 0.72em;
    color: #4c1d95;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .print-preview-content [data-type="timestamp"]::before {
    content: "[" attr(data-elapsed) "]";
  }

  /* Tables */
  .print-preview-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.9em;
    page-break-inside: avoid;
  }
  .print-preview-content th,
  .print-preview-content td {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    text-align: left;
  }
  .print-preview-content th {
    background: #f9fafb;
    font-weight: 600;
  }
  .print-preview-content tr:nth-child(even) td { background: #fafafa; }

  /* Print-specific rules */
  @media print {
    @page {
      margin: 0.65in 0.75in;
      size: letter;
    }
    .print-preview-content {
      padding: 0;
      max-width: none;
    }
    .print-preview-content pre {
      white-space: pre-wrap;
      word-break: break-all;
    }
    .print-preview-content img {
      max-height: 6in;
      object-fit: contain;
    }
    h1, h2, h3, h4 { page-break-after: avoid; }
    pre, blockquote, img, table { page-break-inside: avoid; }
  }
`;
