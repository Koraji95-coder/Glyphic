import { useCallback, useRef, useState } from 'react';
import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { useCaptureStore } from '../../stores/captureStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { Region } from '../../types/capture';

export function RegionSelector() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const captureMode = useCaptureStore((s) => s.captureMode);
  const setLastRegion = useCaptureStore((s) => s.setLastRegion);
  const addToQueue = useCaptureStore((s) => s.addToQueue);

  const [isDragging, setIsDragging] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startPoint.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setRegion(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !startPoint.current) return;

      const x = Math.min(startPoint.current.x, e.clientX);
      const y = Math.min(startPoint.current.y, e.clientY);
      const width = Math.abs(e.clientX - startPoint.current.x);
      const height = Math.abs(e.clientY - startPoint.current.y);

      setRegion({ x, y, width, height });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(
    async (e: React.MouseEvent) => {
      if (!isDragging || !region || region.width < 5 || region.height < 5) {
        setIsDragging(false);
        setRegion(null);
        return;
      }

      setIsDragging(false);
      setLastRegion(region);

      try {
        const result = await commands.finishCapture(
          captureMode,
          region.x,
          region.y,
          region.width,
          region.height,
          vaultPath ?? '',
        );

        if (e.shiftKey) {
          addToQueue(result);
          setRegion(null);
        } else {
          window.history.back();
        }
      } catch (err) {
        reportError({ context: 'Capture region', message: 'Capture failed', error: err });
      }
    },
    [isDragging, region, captureMode, vaultPath, setLastRegion, addToQueue],
  );

  return (
    <div
      className="absolute inset-0 z-[9999] cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {region && region.width > 0 && region.height > 0 && (
        <>
          {/* Selection rectangle + outer mask */}
          <div
            className="absolute border-2 border-violet-400 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style={{
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height,
            }}
          />

          {/* Dimension label */}
          <div
            className="absolute px-3 py-1 bg-black/75 text-white text-xs font-mono rounded-md backdrop-blur-md border border-zinc-700 shadow-sm"
            style={{
              left: region.x,
              top: region.y + region.height + 8,
            }}
          >
            {Math.round(region.width)} × {Math.round(region.height)}
          </div>
        </>
      )}
    </div>
  );
}