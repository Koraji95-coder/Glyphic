import DOMPurify from 'dompurify';
import katex from 'katex';
import { useMemo } from 'react';

/**
 * Component that renders inline ($...$) and display ($$...$$) KaTeX math.
 *
 * - Parses content for math delimiters and renders with KaTeX.renderToString
 * - Non-math text is rendered as plain text nodes.
 * - All HTML is sanitized with DOMPurify before insertion.
 * - Display math ($$...$$) is centered; inline math ($...$) flows with text.
 */
export function MathBlock({ content }: { content: string }): React.ReactElement {
  const html = useMemo(() => {
    // Parse content into segments: text, inline math, or display math
    const segments: Array<{ type: 'text' | 'inline' | 'display'; content: string }> = [];

    // Use a regex to find display ($$...$$) and inline ($...$) math.
    // Match $$ first (display), then $ (inline), treating everything else as text.
    const displayRegex = /\$\$(.*?)\$\$/gs;
    const inlineRegex = /\$(.*?)\$/g;

    let lastIndex = 0;

    // First pass: extract display math
    const displayMatches: Array<{ start: number; end: number; content: string }> = [];
    let match = displayRegex.exec(content);
    while (match !== null) {
      displayMatches.push({
        start: match.index,
        end: displayRegex.lastIndex,
        content: match[1],
      });
      match = displayRegex.exec(content);
    }

    // Second pass: extract inline math, being careful not to overlap with display math
    const inlineMatches: Array<{ start: number; end: number; content: string }> = [];
    match = inlineRegex.exec(content);
    while (match !== null) {
      const isInsideDisplay = displayMatches.some(
        (dm) => match && match.index >= dm.start && inlineRegex.lastIndex <= dm.end,
      );
      if (!isInsideDisplay && match) {
        inlineMatches.push({
          start: match.index,
          end: inlineRegex.lastIndex,
          content: match[1],
        });
      }
      match = inlineRegex.exec(content);
    }

    // Merge and sort all matches
    const allMatches = [...displayMatches, ...inlineMatches].sort((a, b) => a.start - b.start);

    // Build segments
    lastIndex = 0;
    for (const m of allMatches) {
      if (lastIndex < m.start) {
        segments.push({ type: 'text', content: content.substring(lastIndex, m.start) });
      }
      const type = displayMatches.includes(m) ? 'display' : 'inline';
      segments.push({ type, content: m.content });
      lastIndex = m.end;
    }
    if (lastIndex < content.length) {
      segments.push({ type: 'text', content: content.substring(lastIndex) });
    }

    // Render each segment to HTML
    let html = '';
    for (const seg of segments) {
      if (seg.type === 'text') {
        html += escapeHtml(seg.content);
      } else if (seg.type === 'inline') {
        try {
          const rendered = katex.renderToString(seg.content, { throwOnError: false });
          html += `<span class="math-inline">${rendered}</span>`;
        } catch {
          html += escapeHtml(`$${seg.content}$`);
        }
      } else if (seg.type === 'display') {
        try {
          const rendered = katex.renderToString(seg.content, {
            displayMode: true,
            throwOnError: false,
          });
          html += `<div class="math-display" style="text-align:center;margin:0.5em 0;">${rendered}</div>`;
        } catch {
          html += escapeHtml(`$$${seg.content}$$`);
        }
      }
    }

    // Sanitize before returning
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'span',
        'div',
        'svg',
        'g',
        'line',
        'rect',
        'circle',
        'path',
        'text',
        'tspan',
        'foreignObject',
        'math',
        'mrow',
        'mi',
        'mn',
        'mo',
        'msup',
        'msub',
        'mfrac',
        'msqrt',
        'mover',
        'munder',
        'mtable',
        'mtr',
        'mtd',
      ],
      ALLOWED_ATTR: [
        'class',
        'style',
        'viewBox',
        'xmlns',
        'width',
        'height',
        'x',
        'y',
        'r',
        'd',
        'fill',
        'stroke',
        'stroke-width',
        'transform',
        'role',
        'aria-hidden',
        'aria-label',
        'display',
      ],
    });
  }, [content]);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized by DOMPurify
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Escape HTML special characters in text segments.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}
