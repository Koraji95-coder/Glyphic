import { useCallback, useRef, useState } from 'react';
import { reportError } from '../../lib/errorReporter';
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

      const pointTuples: [number, number][] = points.map((p) => [Math.round(p.x), Math.round(p.y)]);

      try {
        const result = await commands.finishCapture(
          'freeform',
          0,
          0,
          0,
          0,
          vaultPath ?? '',
          pointTuples,
        );

        if (e.shiftKey) {
          addToQueue(result);
          setPoints([]);
        } else {
          window.history.back();
        }
      } catch (e) {
        reportError({ context: 'Capture freeform', message: 'Freeform capture failed', error: e });
      }
    },
    [isDrawing, points, vaultPath, addToQueue],
  );

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
      className="absolute inset-0 z-[9999] cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        {points.length > 1 && (
          <>
            <path
              d={pathData}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-md"
            />
            {isDrawing && points.length > 2 && (
              <line
                x1={points[points.length - 1].x}
                y1={points[points.length - 1].y}
                x2={points[0].x}
                y2={points[0].y}
                stroke="#a78bfa"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.6"
              />
            )}
          </>
        )}
      </svg>

      {/* Point count indicator */}
      {points.length > 0 && (
        <div
          className="absolute px-3 py-1 bg-black/80 text-white text-xs font-mono rounded-3xl border border-zinc-700 backdrop-blur-md shadow-2xl"
          style={{
            left: points[points.length - 1].x + 16,
            top: points[points.length - 1].y + 16,
          }}
        >
          {points.length} pts
        </div>
      )}
    </div>
  );
}