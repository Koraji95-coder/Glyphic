import { Maximize2, Minimize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLightboxStore } from '../../stores/lightboxStore';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

export function Lightbox() {
  const { src, close } = useLightboxStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    if (src) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [src]);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(MAX_ZOOM, z * 1.25));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(MIN_ZOOM, z / 1.25));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, close]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragState.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
    },
    [pan]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragState.current;
      if (!d) return;
      setPan({
        x: d.originX + (e.clientX - d.startX),
        y: d.originY + (e.clientY - d.startY),
      });
    };
    const onUp = () => {
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={close}
      className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center overflow-hidden"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="max-w-none max-h-none select-none pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: dragState.current ? 'none' : 'transform 0.08s ease-out',
          imageRendering: zoom > 2 ? 'pixelated' : 'auto',
        }}
      />

      {/* Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-2xl border border-zinc-700 rounded-3xl px-2 py-2 shadow-2xl z-50"
      >
        <ToolbarBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}>
          <ZoomOut size={16} />
        </ToolbarBtn>

        <span className="px-4 text-xs font-mono text-zinc-400 min-w-[52px] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <ToolbarBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}>
          <ZoomIn size={16} />
        </ToolbarBtn>

        <ToolbarBtn
          label="Fit to screen"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Minimize2 size={16} />
        </ToolbarBtn>

        <ToolbarBtn
          label="Reset"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={16} />
        </ToolbarBtn>
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={close}
        className="absolute top-6 right-6 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-white p-3 rounded-3xl transition-colors z-50"
      >
        <X size={20} />
      </button>
    </div>
  );
}

function ToolbarBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex items-center justify-center w-9 h-9 hover:bg-zinc-800 rounded-2xl transition-colors text-zinc-300 hover:text-white"
    >
      {children}
    </button>
  );
}