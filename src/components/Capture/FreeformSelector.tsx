import { useCallback, useRef, useState } from 'react';
import { commands } from '../../lib/tauri/commands';
import { useCaptureStore } from '../../stores/captureStore';
import { useVaultStore } from '../../stores/vaultStore';

export function FreeformSelector() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const addToQueue = useCaptureStore((s) => s.addToQueue);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDrawing(true);
    setPoints([{ x: e.clientX, y: e.clientY }]);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      setPoints((prev) => [...prev, { x: e.clientX, y: e.clientY }]);
    },
    [isDrawing],
  );

  const handleMouseUp = useCallback(
    async (e: React.MouseEvent) => {
      if (!isDrawing || points.length < 3) {
        setIsDrawing(false);
        setPoints([]);
        return;
      }

      setIsDrawing(false);

      // Convert points to (u32, u32) tuples for Rust
      const pointTuples: [number, number][] = points.map((p) => [Math.round(p.x), Math.round(p.y)]);

      try {
        const result = await commands.finishCapture('freeform', 0, 0, 0, 0, vaultPath ?? '', pointTuples);

        // Multi-capture: if Shift is held, keep overlay open and queue
        if (e.shiftKey) {
          addToQueue(result);
          setPoints([]);
        } else {
          window.history.back();
        }
      } catch (e) {
        console.error('Freeform capture failed:', e);
      }
    },
    [isDrawing, points, vaultPath, addToQueue],
  );

  // Build SVG path data from points
  const pathData =
    points.length > 1
      ? `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ')
      : '';

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} aria-hidden="true">
        {points.length > 1 && (
          <>
            {/* Freeform path */}
            <path
              d={pathData}
              fill="none"
              stroke="var(--accent, #6366f1)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Closing line (from last point back to first) while drawing */}
            {isDrawing && points.length > 2 && (
              <line
                x1={points[points.length - 1].x}
                y1={points[points.length - 1].y}
                x2={points[0].x}
                y2={points[0].y}
                stroke="var(--accent, #6366f1)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.6"
              />
            )}
          </>
        )}
      </svg>

      {/* Point count indicator */}
      {points.length > 0 && (
        <div
          className="absolute px-2 py-0.5 rounded text-xs font-mono"
          style={{
            left: points[points.length - 1].x + 12,
            top: points[points.length - 1].y + 12,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: '#fff',
          }}
        >
          {points.length} points
        </div>
      )}
    </div>
  );
}
