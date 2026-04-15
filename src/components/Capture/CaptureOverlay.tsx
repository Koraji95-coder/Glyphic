import { useState, useCallback, useEffect } from 'react';
import { useCaptureStore } from '../../stores/captureStore';
import { commands } from '../../lib/tauri/commands';
import { RegionSelector } from './RegionSelector';
import { CaptureToolbar } from './CaptureToolbar';

export function CaptureOverlay() {
  const captureMode = useCaptureStore((s) => s.captureMode);
  const [screenshotBg, setScreenshotBg] = useState<string | null>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Emit capture cancelled — close the overlay
      window.history.back();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        cursor: 'crosshair',
        backgroundImage: screenshotBg ? `url(${screenshotBg})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Toolbar */}
      <CaptureToolbar />

      {/* Region selector (default mode) */}
      {captureMode === 'region' && <RegionSelector />}
    </div>
  );
}
