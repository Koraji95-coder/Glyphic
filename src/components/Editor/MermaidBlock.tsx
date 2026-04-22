import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import { useEffect, useRef, useState } from 'react';

/**
 * React node view for Mermaid diagram code blocks.
 *
 * When the code block's language attribute is "mermaid", this component:
 *   - Shows an editable code area (via NodeViewContent) while in edit mode.
 *   - Renders a live SVG preview below the code area using mermaid.render().
 *   - Displays any parse errors inline (no thrown exceptions propagate).
 *   - Themes the diagram using the app's CSS custom properties.
 *
 * For all other languages the component falls back to a plain <pre><code>
 * wrapper so syntax-highlighting decorations from CodeBlockLowlight still apply.
 */
export function MermaidBlock({ node, editor }: ReactNodeViewProps) {
  const language = (node.attrs.language as string) ?? '';
  const isMermaid = language === 'mermaid';
  const source = node.textContent;

  const [svg, setSvg] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  // Monotonic counter used to produce unique element IDs for each render call.
  const renderCount = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isMermaid) return;

    // Clear any in-flight debounce.
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }

    if (!source.trim()) {
      setSvg('');
      setRenderError(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      // Read CSS variables at render time so the diagram matches the current theme.
      const style = getComputedStyle(document.documentElement);
      const accent = style.getPropertyValue('--accent').trim() || '#7c6df0';
      const textPrimary = style.getPropertyValue('--text-primary').trim() || '#e2e2e2';
      const bgTertiary = style.getPropertyValue('--bg-tertiary').trim() || '#1e1f26';

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
          // Sanitize the SVG produced by Mermaid before injecting into the DOM.
          // Mermaid already applies its own DOMPurify pass with securityLevel:'strict',
          // but a second pass here provides defense-in-depth against any regressions.
          const clean = DOMPurify.sanitize(renderedSvg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
          setSvg(clean);
          setRenderError(null);
        })
        .catch((err: unknown) => {
          setRenderError(err instanceof Error ? err.message : String(err));
          setSvg('');
        });
    }, 300);

    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [isMermaid, source]);

  // Non-mermaid code blocks: plain wrapper so lowlight decorations still apply.
  if (!isMermaid) {
    return (
      <NodeViewWrapper as="pre">
        <NodeViewContent as="code" className={language ? `language-${language}` : undefined} />
      </NodeViewWrapper>
    );
  }

  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="div"
      className="mermaid-block"
      style={{
        margin: '8px 0',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Editable source — shown while in edit mode */}
      {isEditable && (
        <pre
          style={{
            margin: 0,
            padding: '10px 14px',
            background: 'var(--bg-tertiary)',
            borderBottom: svg || renderError ? '1px solid var(--border)' : undefined,
            fontSize: '13px',
            fontFamily: 'monospace',
          }}
        >
          <NodeViewContent as="code" className="language-mermaid" />
        </pre>
      )}

      {/* Rendered SVG diagram */}
      {svg && (
        <div
          className="mermaid-svg"
          style={{ padding: '12px', background: 'var(--bg-tertiary)', overflowX: 'auto' }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is produced by Mermaid and sanitized by DOMPurify
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {/* Inline parse error */}
      {renderError && (
        <div
          className="mermaid-error"
          style={{
            color: 'var(--error, #f87171)',
            background: 'rgba(248,113,113,0.08)',
            borderTop: '1px solid rgba(248,113,113,0.3)',
            padding: '8px 14px',
            fontSize: '12px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
          }}
        >
          Mermaid error: {renderError}
        </div>
      )}
    </NodeViewWrapper>
  );
}
