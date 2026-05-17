import DOMPurify from 'dompurify';
import { Download, GitBranch, ImageDown, Play, RefreshCw, X } from 'lucide-react';
import mermaid from 'mermaid';
import { useCallback, useEffect, useRef, useState } from 'react';

import { commands } from '../../lib/tauri/commands';
import { events } from '../../lib/tauri/events';
import { useLayoutStore } from '../../stores/layoutStore';

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

export function DiagramMode() {
  const closeDiagramMode = useLayoutStore((s) => s.closeDiagramMode);

  const [diagramType, setDiagramType] = useState<DiagramType>('schemdraw');
  const [code, setCode] = useState(PLACEHOLDER.schemdraw);
  const [nlMode, setNlMode] = useState(false);
  const [nlPrompt, setNlPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<DiagramResult | null>(null);
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [mermaidError, setMermaidError] = useState('');
  const [generateError, setGenerateError] = useState('');
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);
  const [generationStage, setGenerationStage] = useState<'prompting' | 'generating' | 'validating' | ''>('');
  const mermaidIdRef = useRef(0);

  const handleTypeChange = useCallback((t: DiagramType) => {
    setDiagramType(t);
    setCode(PLACEHOLDER[t]);
    setResult(null);
    setMermaidSvg('');
    setMermaidError('');
    setGenerateError('');
    setNlMode(false);
  }, []);

  useEffect(() => {
    if (!result?.mermaid) return;
    const id = `diagram-mode-mermaid-${++mermaidIdRef.current}`;
    const style = getComputedStyle(document.documentElement);
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: style.getPropertyValue('--bg-tertiary').trim() || '#18181b',
        primaryTextColor: style.getPropertyValue('--text-primary').trim() || '#e2e2e2',
        primaryBorderColor: style.getPropertyValue('--accent').trim() || '#a78bfa',
        lineColor: style.getPropertyValue('--accent').trim() || '#a78bfa',
        background: style.getPropertyValue('--bg-tertiary').trim() || '#18181b',
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

  useEffect(() => {
    let unlisten: (() => void | Promise<void>) | null = null;
    events
      .onDiagramGenerateProgress((payload) => {
        if (payload?.event === 'progress') {
          setGenerationStage(payload.stage);
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // No-op: DiagramMode still works without progress events.
      });

    return () => {
      if (unlisten) void unlisten();
    };
  }, []);

  const handleRender = useCallback(async () => {
    setRendering(true);
    setResult(null);
    setMermaidSvg('');
    setMermaidError('');
    setGenerateError('');
    setGenerateWarnings([]);
    setGenerationStage('');
    try {
      let codeToRender = code;

      if (nlMode && nlPrompt.trim()) {
        setGenerating(true);
        try {
          const typeHint =
            diagramType === 'mermaid'
              ? 'mermaid'
              : diagramType === 'phasor' || diagramType === 'polar'
                ? 'matplotlib'
                : diagramType;
          const generated = await commands.generateCode(nlPrompt.trim(), typeHint);
          codeToRender = generated.code;
          setCode(generated.code);
          setGenerateWarnings(generated.warnings || []);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setGenerateError(msg);
          setRendering(false);
          setGenerating(false);
          return;
        } finally {
          setGenerating(false);
          setGenerationStage('');
        }
      }

      const res = (await commands.renderDiagram(diagramType, codeToRender)) as DiagramResult;
      setResult(res);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setRendering(false);
      if (!generating) {
        setGenerationStage('');
      }
    }
  }, [code, diagramType, nlMode, nlPrompt]);

  const handleExportSvg = useCallback(() => {
    if (!result) return;
    let svgContent = '';
    if (result.svg_base64) svgContent = atob(result.svg_base64);
    else if (mermaidSvg) svgContent = mermaidSvg;
    if (!svgContent) return;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, mermaidSvg]);

  const handleExportPng = useCallback(async () => {
    if (!result?.svg_base64) return;
    try {
      const res = (await commands.exportPng(diagramType, code)) as { png_base64?: string; error?: string };
      if (res.error) {
        setResult((prev) => ({ ...prev, error: res.error }));
        return;
      }
      if (res.png_base64) {
        const byteChars = atob(res.png_base64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArray], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagram-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setResult((prev) => ({ ...prev, error: String(e) }));
    }
  }, [result, diagramType, code]);

  const hasRendered = result?.svg_base64 || mermaidSvg || result?.error;
  const canExportPng = !!result?.svg_base64 && diagramType !== 'mermaid';
  const isBusy = rendering || generating;
  const stageLabel =
    generationStage === 'prompting'
      ? 'Structuring prompt'
      : generationStage === 'generating'
        ? 'Generating code'
        : generationStage === 'validating'
          ? 'Validating output'
          : '';
  const usedFallback = generateWarnings.some((warning) => warning.toLowerCase().includes('fallback applied'));

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3">
          <GitBranch className="text-blue-400" size={20} />
          <span className="text-lg font-semibold text-white">Diagram Studio</span>
        </div>
        <button
          onClick={closeDiagramMode}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-700 bg-zinc-900 shrink-0 flex-wrap">
          {/* Diagram type pills */}
          <div className="flex gap-1 flex-wrap">
            {DIAGRAM_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTypeChange(t.value)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                  diagramType === t.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Natural language toggle */}
          <button
            onClick={() => setNlMode((v) => !v)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              nlMode ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            ✨ Describe
          </button>

          {hasRendered && (
            <>
              <button
                onClick={handleExportSvg}
                className="flex items-center gap-2 px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
              >
                <Download size={16} />
                Export SVG
              </button>

              <button
                onClick={() => {
                  if (canExportPng) void handleExportPng();
                }}
                disabled={!canExportPng}
                title={!canExportPng ? 'PNG export is unavailable for Mermaid diagrams. Use Export SVG.' : 'Export diagram as PNG'}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition-colors ${
                  canExportPng
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-700'
                }`}
              >
                <ImageDown size={16} />
                Export PNG
              </button>
            </>
          )}

          <button
            onClick={handleRender}
            disabled={isBusy}
            className={`flex items-center gap-2 px-7 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              isBusy
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-linear-to-r from-violet-500 to-cyan-400 text-white hover:brightness-110'
            }`}
          >
            <Play size={16} />
            {generating ? 'Generating…' : rendering ? 'Rendering…' : 'Render'}
          </button>
        </div>

        {/* NL Prompt */}
        {nlMode && (
          <div className="px-6 py-4 border-b border-zinc-700 bg-zinc-900">
            <input
              type="text"
              value={nlPrompt}
              onChange={(e) => setNlPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRender()}
              placeholder="Describe the diagram you want (press Enter)"
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-lg px-5 py-4 text-white outline-none"
            />
          </div>
        )}

        {/* Split view: Code + Preview */}
        <div className="flex flex-1 min-h-0">
          {/* Code editor */}
          <div className="flex-1 flex flex-col border-r border-zinc-700">
            <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-700 text-xs font-medium tracking-widest text-zinc-400 uppercase">
              {nlMode ? 'Generated Code' : 'Code'}
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-zinc-950 text-zinc-200 font-mono text-sm p-6 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-700 text-xs font-medium tracking-widest text-zinc-400 uppercase">
              Preview
            </div>
            <div className="flex-1 overflow-auto p-8 bg-zinc-950 flex items-start justify-center">
              {rendering && (
                <div className="text-zinc-400 flex items-center gap-3">
                  <RefreshCw className="animate-spin" size={18} />
                  {generating ? 'Generating diagram…' : 'Rendering…'}
                </div>
              )}

              {!rendering && !result && !generateError && (
                <div className="text-center text-zinc-400">
                  <p>Click <span className="font-semibold text-blue-300">Render</span> to see the diagram</p>
                  {stageLabel && <p className="mt-2 text-xs text-zinc-500">{stageLabel}...</p>}
                </div>
              )}

              {!rendering && generateError && (
                <div className="max-w-md text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6">
                  Generation failed: {generateError}
                  <button
                    onClick={handleRender}
                    className="mt-4 flex items-center gap-2 text-blue-300 hover:text-white"
                  >
                    <RefreshCw size={14} /> Regenerate
                  </button>
                </div>
              )}

              {!rendering && result?.error && (
                <div className="max-w-md text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6">
                  {result.error}
                  {nlMode && nlPrompt.trim() && (
                    <button
                      onClick={handleRender}
                      className="mt-4 flex items-center gap-2 text-blue-300 hover:text-white"
                    >
                      <RefreshCw size={14} /> Regenerate
                    </button>
                  )}
                </div>
              )}

              {!rendering && generateWarnings.length > 0 && (
                <div className="max-w-2xl mb-6 self-start text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-lg p-5">
                  <p className="text-sm font-semibold mb-2">Generation notes</p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {generateWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                  {usedFallback && (
                    <p className="mt-3 text-xs text-amber-100/90">
                      Fallback template was used so you can keep momentum. Edit labels/components and render again for your exact target diagram.
                    </p>
                  )}
                </div>
              )}

              {!rendering && result?.svg_base64 && (
                <img
                  src={`data:image/svg+xml;base64,${result.svg_base64}`}
                  alt="Rendered diagram"
                  className="max-w-full max-h-full shadow-2xl"
                />
              )}

              {!rendering && mermaidSvg && (
                <div
                  className="max-w-full"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG produced by Mermaid and sanitized
                  dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                />
              )}

              {!rendering && mermaidError && (
                <div className="max-w-md text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6">
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