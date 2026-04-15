import { useState, useCallback, useRef } from 'react';
import { useVaultStore } from '../../stores/vaultStore';
import { useCaptureStore } from '../../stores/captureStore';
import { commands } from '../../lib/tauri/commands';
import type { Region } from '../../types/capture';

export function RegionSelector() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const captureMode = useCaptureStore((s) => s.captureMode);
  const setLastRegion = useCaptureStore((s) => s.setLastRegion);
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

  const handleMouseUp = useCallback(async () => {
    if (!isDragging || !region || region.width < 5 || region.height < 5) {
      setIsDragging(false);
      setRegion(null);
      return;
    }

    setIsDragging(false);
    setLastRegion(region);

    try {
      await commands.finishCapture(
        captureMode,
        region.x,
        region.y,
        region.width,
        region.height,
        vaultPath ?? '',
      );
      window.history.back();
    } catch (e) {
      console.error('Capture failed:', e);
    }
  }, [isDragging, region, captureMode, vaultPath, setLastRegion]);

  return (
    <div
      className="absolute inset-0 z-10"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Selection rectangle */}
      {region && region.width > 0 && region.height > 0 && (
        <>
          {/* Clear area inside selection */}
          <div
            className="absolute"
            style={{
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height,
              border: '2px solid var(--accent)',
              backgroundColor: 'transparent',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
            }}
          />

          {/* Dimension label */}
          <div
            className="absolute px-2 py-0.5 rounded text-xs font-mono"
            style={{
              left: region.x,
              top: region.y + region.height + 6,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
            }}
          >
            {Math.round(region.width)} × {Math.round(region.height)}
          </div>
        </>
      )}
    </div>
  );
}
