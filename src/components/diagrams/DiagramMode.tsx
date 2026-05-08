import DOMPurify from 'dompurify';
import { Download, GitBranch, Play, X } from 'lucide-react';
import mermaid from 'mermaid';
import { useCallback, useEffect, useRef, useState } from 'react';
import { commands } from '../../lib/tauri/commands';
import { useLayoutStore } from '../../stores/layoutStore';

// ── Types ─────────────────────────────────────────────────────────────────────

type DiagramType = 'schemdraw' | 'circuit' | 'matplotlib' | 'phasor' | 'polar' | 'mermaid';

interface DiagramResult {
  svg_base64?: string;
  mermaid?: string;
  error?: string;
}

const DIAGRAM_TYPES: { value: DiagramType; label: string }[] = [
  { value: 'schemdraw', label: 'Circuit (Schemdraw)' },
  { value: 'matplotlib', label: 'Matplotlib' },
  { value: 'phasor', label: 'Phasor (Polar)' },
  { value: 'mermaid', label: 'Mermaid' },
];

const PLACEHOLDER: Record<DiagramType, string> = {
  schemdraw: `import schemdraw.elements as elm
d = schemdraw.Drawing()
d += elm.Resistor().right().label('R1')
d += elm.Capacitor().down().label('C1')
d += elm.Line().left()
d += elm.SourceV().up().label('V1')`,
  circuit: `import schemdraw.elements as elm
d = schemdraw.Drawing()
d += elm.Resistor().right().label('R1')
d += elm.Capacitor().down().label('C1')
d += elm.Line().left()
d += elm.SourceV().up().label('V1')`,
  matplotlib: `import numpy as np
t = np.linspace(0, 2*np.pi, 200)
plt.plot(t, np.sin(t), label='sin(t)')
plt.xlabel('t'); plt.ylabel('Amplitude')
plt.legend(); plt.title('Sine wave')`,
  phasor: `import numpy as np
fig, ax = plt.subplots(subplot_kw={'projection': 'polar'})
ax.annotate('', xy=(np.pi/4, 1.0), xytext=(0, 0),
            arrowprops=dict(arrowstyle='->', color='cyan', lw=2))
ax.set_title('Phasor V = 1∠45°')`,
  polar: `import numpy as np
theta = np.linspace(0, 2*np.pi, 300)
r = 1 + 0.5 * np.cos(3 * theta)
fig, ax = plt.subplots(subplot_kw={'projection': 'polar'})
ax.plot(theta, r)`,
  mermaid: `graph TD
    A[Start] --> B{Condition}
    B -->|Yes| C[Action A]
    B -->|No| D[Action B]
    C --> E[End]
    D --> E`,
};

// ── Main component ────────────────────────────────────────────────────────────

export function DiagramMode() {
  const closeDiagramMode = useLayoutStore((s) => s.closeDiagramMode);

  const [diagramType, setDiagramType] = useState<DiagramType>('schemdraw');
  const [code, setCode] = useState(PLACEHOLDER.schemdraw);
  const [nlMode, setNlMode] = useState(false);
  const [nlPrompt, setNlPrompt] = useState('');
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<DiagramResult | null>(null);
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [mermaidError, setMermaidError] = useState('');
  const mermaidIdRef = useRef(0);

  const handleTypeChange = useCallback((t: DiagramType) => {
    setDiagramType(t);
    setCode(PLACEHOLDER[t]);
    setResult(null);
    setMermaidSvg('');
    setMermaidError('');
    setNlMode(false);
  }, []);

  // Render Mermaid on the frontend when result.mermaid is returned
  useEffect(() => {
    if (!result?.mermaid) return;
    const id = `diagram-mode-mermaid-${++mermaidIdRef.current}`;
    const style = getComputedStyle(document.documentElement);
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: style.getPropertyValue('--bg-tertiary').trim() || '#1e1f26',
        primaryTextColor: style.getPropertyValue('--text-primary').trim() || '#e2e2e2',
        primaryBorderColor: style.getPropertyValue('--accent').trim() || '#7c6df0',
        lineColor: style.getPropertyValue('--accent').trim() || '#7c6df0',
        background: style.getPropertyValue('--bg-tertiary').trim() || '#1e1f26',
        fontFamily: 'inherit',
      },
      securityLevel: 'strict',
    });
    mermaid
      .render(id, result.mermaid.trim())
      .then(({ svg }) => {
        const clean = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
        setMermaidSvg(clean);
        setMermaidError('');
      })
      .catch((err: unknown) => {
        setMermaidError(err instanceof Error ? err.message : String(err));
        setMermaidSvg('');
      });
  }, [result]);

  const handleRender = useCallback(async () => {
    setRendering(true);
    setResult(null);
    setMermaidSvg('');
    setMermaidError('');
    try {
      let codeToRender = code;

      // NL-to-code: ask AI to generate code from natural-language description
      if (nlMode && nlPrompt.trim()) {
        const typeHint =
          diagramType === 'mermaid'
            ? 'Return only valid Mermaid diagram syntax, no other text.'
            : `Return only valid Python code. For schemdraw/circuit: assign the schemdraw.Drawing() to a variable named 'd'. For matplotlib/phasor/polar: use plt (already available) to create the figure. No plt.show(). No other text or explanation.`;
        const aiCode = await commands.aiChat(
          `Generate a ${diagramType} diagram for: "${nlPrompt.trim()}". ${typeHint}`,
        ).catch((e: unknown) => {
          console.error('NL-to-code AI generation failed:', e);
          return '';
        });
        if (aiCode) {
          // Strip possible markdown fences
          const stripped = aiCode
            .replace(/^```[a-z]*\n?/m, '')
            .replace(/\n?```$/m, '')
            .trim();
          codeToRender = stripped;
          setCode(stripped);
        }
      }

      const res = (await commands.renderDiagram(diagramType, codeToRender)) as DiagramResult;
      setResult(res);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setRendering(false);
    }
  }, [code, diagramType, nlMode, nlPrompt]);

  const handleExportSvg = useCallback(() => {
    if (!result) return;
    let svgContent = '';
    if (result.svg_base64) {
      svgContent = atob(result.svg_base64);
    } else if (mermaidSvg) {
      svgContent = mermaidSvg;
    }
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, mermaidSvg]);

  const hasRendered = result?.svg_base64 || mermaidSvg || result?.error;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GitBranch size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Diagram Studio</span>
        </div>
        <button
          type="button"
          onClick={closeDiagramMode}
          style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-ghost)', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--bg-sidebar)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          {/* Type pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {DIAGRAM_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: diagramType === t.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  backgroundColor: diagramType === t.value ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: diagramType === t.value ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.12s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* NL toggle */}
          <button
            type="button"
            onClick={() => setNlMode((v) => !v)}
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              border: nlMode ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: nlMode ? 'var(--accent-dim)' : 'var(--bg-card)',
              color: nlMode ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.12s',
            }}
          >
            ✨ Describe
          </button>

          {hasRendered && (
            <button
              type="button"
              onClick={handleExportSvg}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <Download size={12} />
              Export SVG
            </button>
          )}

          <button
            type="button"
            onClick={handleRender}
            disabled={rendering}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid transparent',
              backgroundColor: rendering ? 'var(--bg-hover)' : 'var(--accent)',
              color: rendering ? 'var(--text-ghost)' : '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: rendering ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            <Play size={13} />
            {rendering ? 'Rendering…' : 'Render'}
          </button>
        </div>

        {/* NL prompt input */}
        {nlMode && (
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-editor)',
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              value={nlPrompt}
              onChange={(e) => setNlPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleRender(); }}
              placeholder={`Describe the ${diagramType} diagram you want… (press Enter to generate)`}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Editor + Preview split */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
          {/* Code editor */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--border)',
              minWidth: 0,
            }}
          >
            <div
              style={{
                padding: '6px 14px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-ghost)',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--bg-sidebar)',
                flexShrink: 0,
              }}
            >
              {nlMode ? 'Generated Code' : 'Code'}
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                padding: '14px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'monospace',
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Preview panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              style={{
                padding: '6px 14px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-ghost)',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--bg-sidebar)',
                flexShrink: 0,
              }}
            >
              Preview
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-editor)',
              }}
            >
              {rendering && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', paddingTop: '40px' }}>Rendering…</div>
              )}

              {!rendering && !result && (
                <div style={{ color: 'var(--text-ghost)', fontSize: '13px', paddingTop: '40px', textAlign: 'center' }}>
                  Click <strong>Render</strong> to generate the diagram.
                </div>
              )}

              {!rendering && result?.error && (
                <div
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(248,113,113,0.4)',
                    backgroundColor: 'rgba(248,113,113,0.08)',
                    color: 'var(--red, #f87171)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {result.error}
                </div>
              )}

              {!rendering && result?.svg_base64 && (
                <img
                  src={`data:image/svg+xml;base64,${result.svg_base64}`}
                  alt="Rendered diagram"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              )}

              {!rendering && mermaidSvg && (
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG produced by Mermaid and sanitized by DOMPurify
                <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} style={{ maxWidth: '100%' }} />
              )}

              {!rendering && mermaidError && (
                <div
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(248,113,113,0.4)',
                    backgroundColor: 'rgba(248,113,113,0.08)',
                    color: 'var(--red, #f87171)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                >
                  Mermaid error: {mermaidError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
