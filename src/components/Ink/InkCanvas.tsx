import { useCallback, useEffect, useRef, useState } from 'react';
import { useStylus } from '../../hooks/useStylus';
import type { InkPoint, InkStroke } from '../../types/ink';

interface InkCanvasProps {
  width: number;
  height: number;
  isActive: boolean;
  onStrokesChange?: (strokes: InkStroke[]) => void;
  initialStrokes?: InkStroke[];
  color?: string;
  tool?: 'pen' | 'highlighter' | 'eraser';
}

function strokeToPath(points: InkPoint[], baseWidth: number): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp = points[i - 1];
    const p = points[i];
    const mx = (cp.x + p.x) / 2;
    const my = (cp.y + p.y) / 2;
    d += ` Q ${cp.x} ${cp.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function pressureToWidth(pressure: number, baseWidth: number): number {
  // Map pressure 0.0–1.0 to width range [baseWidth * 0.5, baseWidth * 2.5]
  return baseWidth * (0.5 + pressure * 2);
}

export function InkCanvas({
  width,
  height,
  isActive,
  onStrokesChange,
  initialStrokes = [],
  color = 'var(--accent)',
  tool = 'pen',
}: InkCanvasProps) {
  const [strokes, setStrokes] = useState<InkStroke[]>(initialStrokes);
  const [currentPoints, setCurrentPoints] = useState<InkPoint[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);

  const { isPenActive, pointerType } = useStylus(containerRef);

  // Allow drawing with pen always, or with any pointer when isActive
  const canDraw = isActive && (pointerType === 'pen' || isPenActive || pointerType === 'mouse');

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isActive) return;
      if (e.pointerType === 'touch' && isPenActive) return; // palm rejection
      isDrawingRef.current = true;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentPoints([{ x, y, pressure: e.pressure || 0.5 }]);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isActive, isPenActive],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawingRef.current || !isActive) return;
      if (e.pointerType === 'touch' && isPenActive) return; // palm rejection
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentPoints((pts) => [...pts, { x, y, pressure: e.pressure || 0.5 }]);
    },
    [isActive, isPenActive],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      setCurrentPoints((pts) => {
        if (pts.length < 2) return [];
        if (tool !== 'eraser') {
          const id =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2);
          const newStroke: InkStroke = {
            id,
            points: pts,
            color,
            width: 2,
            tool,
          };
          const updated = [...strokes, newStroke];
          setStrokes(updated);
          onStrokesChange?.(updated);
        }
        return [];
      });
    },
    [strokes, color, tool, onStrokesChange],
  );

  const handleEraseStroke = useCallback(
    (id: string) => {
      const updated = strokes.filter((s) => s.id !== id);
      setStrokes(updated);
      onStrokesChange?.(updated);
    },
    [strokes, onStrokesChange],
  );

  // Sync initial strokes
  useEffect(() => {
    setStrokes(initialStrokes);
  }, [initialStrokes]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        pointerEvents: isActive ? 'all' : 'none',
        cursor: isActive ? 'crosshair' : 'default',
        touchAction: isActive ? 'none' : 'auto',
        zIndex: 10,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {/* Committed strokes */}
        {strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={strokeToPath(stroke.points, stroke.width)}
            stroke={stroke.color}
            strokeWidth={
              stroke.points.length > 0
                ? pressureToWidth(
                    stroke.points.reduce((sum, p) => sum + p.pressure, 0) / stroke.points.length,
                    stroke.width,
                  )
                : stroke.width
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={stroke.tool === 'highlighter' ? 0.4 : 1}
            style={{ cursor: tool === 'eraser' ? 'pointer' : 'default' }}
            onClick={tool === 'eraser' ? () => handleEraseStroke(stroke.id) : undefined}
          />
        ))}

        {/* In-progress stroke */}
        {currentPoints.length >= 2 && (
          <path
            d={strokeToPath(currentPoints, 2)}
            stroke={color}
            strokeWidth={
              currentPoints.length > 0
                ? pressureToWidth(currentPoints.reduce((sum, p) => sum + p.pressure, 0) / currentPoints.length, 2)
                : 2
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={tool === 'highlighter' ? 0.4 : 1}
          />
        )}
      </svg>
    </div>
  );
}
