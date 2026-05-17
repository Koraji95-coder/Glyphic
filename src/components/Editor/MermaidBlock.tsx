import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import { useEffect, useRef, useState } from 'react';

export function MermaidBlock({ node, editor }: ReactNodeViewProps) {
  const language = (node.attrs.language as string) ?? '';
  const isMermaid = language === 'mermaid';
  const source = node.textContent;

  const [svg, setSvg] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const renderCount = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isMermaid) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!source.trim()) {
      setSvg('');
      setRenderError(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      const style = getComputedStyle(document.documentElement);
      const accent = style.getPropertyValue('--accent').trim() || '#a78bfa';
      const textPrimary = style.getPropertyValue('--text-primary').trim() || '#e2e2e2';
      const bgTertiary = style.getPropertyValue('--bg-tertiary').trim() || '#18181b';

      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          primaryColor: bgTertiary,
          primaryTextColor: textPrimary,
          primaryBorderColor: accent,
          lineColor: accent,
          background: bgTertiary,
          mainBkg: bgTertiary,
          nodeBorder: accent,
          clusterBkg: bgTertiary,
          titleColor: textPrimary,
          edgeLabelBackground: bgTertiary,
          fontFamily: 'inherit',
        },
        securityLevel: 'strict',
      });

      const id = `mermaid-render-${++renderCount.current}`;
      mermaid
        .render(id, source.trim())
        .then(({ svg: renderedSvg }) => {
          const clean = DOMPurify.sanitize(renderedSvg, { USE_PROFILES: { svg: true, svgFilters: true } });
          setSvg(clean);
          setRenderError(null);
        })
        .catch((err: unknown) => {
          setRenderError(err instanceof Error ? err.message : String(err));
          setSvg('');
        });
    }, 280);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [isMermaid, source]);

  if (!isMermaid) {
    return (
      <NodeViewWrapper as="pre">
        <NodeViewContent as="code" className={language ? `language-${language}` : undefined} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className="mermaid-block my-4 rounded-lg border border-zinc-700 bg-zinc-900/70 backdrop-blur-xl overflow-hidden"
    >
      {/* Editable source */}
      {editor.isEditable && (
        <pre className="m-0 px-5 py-4 bg-zinc-950 border-b border-zinc-700 text-sm font-mono">
          <NodeViewContent as="code" className="language-mermaid" />
        </pre>
      )}

      {/* Rendered diagram */}
      {svg && (
        <div
          className="p-6 bg-zinc-900/70"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is produced by Mermaid and sanitized by DOMPurify
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {/* Error */}
      {renderError && (
        <div className="px-5 py-4 text-xs text-red-400 bg-red-500/10 border-t border-red-500/20">
          Mermaid error: {renderError}
        </div>
      )}
    </NodeViewWrapper>
  );
}