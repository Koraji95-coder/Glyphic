import { Maximize2, Minimize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLightboxStore } from '../../stores/lightboxStore';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/** Full-resolution image viewer with wheel-zoom and drag-pan. ESC closes. */
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
    [pan.x, pan.y],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragState.current;
      if (!d) return;
      setPan({ x: d.originX + (e.clientX - d.startX), y: d.originY + (e.clientY - d.startY) });
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
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.92)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: dragState.current ? 'grabbing' : 'grab',
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'none',
          maxHeight: 'none',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: dragState.current ? 'none' : 'transform 0.08s ease-out',
          userSelect: 'none',
          pointerEvents: 'none',
          imageRendering: zoom > 2 ? 'pixelated' : 'auto',
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="toolbar"
        aria-label="Lightbox controls"
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '4px',
          padding: '6px',
          backgroundColor: 'rgba(20,20,28,0.85)',
          border: '1px solid var(--border)',
          borderRadius: '999px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <ToolbarBtn label="Zoom out (-)" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}>
          <ZoomOut size={14} />
        </ToolbarBtn>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono, monospace)',
            minWidth: '52px',
            justifyContent: 'center',
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <ToolbarBtn label="Zoom in (+)" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}>
          <ZoomIn size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          label="Fit (0)"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Minimize2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn label="100%" onClick={() => setZoom(1)}>
          <Maximize2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          label="Reset"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={14} />
        </ToolbarBtn>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Close viewer"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(20,20,28,0.85)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '50%',
          backdropFilter: 'blur(8px)',
        }}
      >
        <X size={16} />
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
      aria-label={label}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '6px 8px',
        borderRadius: '999px',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </button>
  );
}
