import { useState, useCallback, useEffect } from 'react';
import { useCaptureStore } from '../../stores/captureStore';
import { useVaultStore } from '../../stores/vaultStore';
import { commands } from '../../lib/tauri/commands';
import { RegionSelector } from './RegionSelector';
import { FreeformSelector } from './FreeformSelector';
import { WindowSelector } from './WindowSelector';
import { CaptureToolbar } from './CaptureToolbar';
import { Magnifier } from './Magnifier';
import type { CaptureMode } from '../../types/capture';

export function CaptureOverlay() {
  const captureMode = useCaptureStore((s) => s.captureMode);
  const setCaptureMode = useCaptureStore((s) => s.setCaptureMode);
  const multiCaptureQueue = useCaptureStore((s) => s.multiCaptureQueue);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [screenshotBg, setScreenshotBg] = useState<string | null>(null);

  const handleFullscreenCapture = useCallback(async () => {
    try {
      await commands.finishCapture('fullscreen', 0, 0, 0, 0, vaultPath ?? '');
      window.history.back();
    } catch (e) {
      console.error('Fullscreen capture failed:', e);
    }
  }, [vaultPath]);

  // Handle keyboard shortcuts for mode switching and escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const modeKeys: Record<string, CaptureMode> = {
        r: 'region',
        w: 'window',
        f: 'freeform',
        s: 'fullscreen',
      };

      if (key === 'escape') {
        window.history.back();
        return;
      }

      if (key in modeKeys) {
        const newMode = modeKeys[key];
        if (newMode === 'fullscreen') {
          handleFullscreenCapture();
        } else {
          setCaptureMode(newMode);
        }
      }
    },
    [setCaptureMode, handleFullscreenCapture],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // If mode is set to fullscreen, trigger immediately
  useEffect(() => {
    if (captureMode === 'fullscreen') {
      handleFullscreenCapture();
    }
  }, [captureMode, handleFullscreenCapture]);

  // Don't render overlay UI if fullscreen mode (capture happens immediately)
  if (captureMode === 'fullscreen') {
    return null;
  }

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
      <CaptureToolbar
        onFullscreen={handleFullscreenCapture}
        captureCount={multiCaptureQueue.length}
      />

      {/* Mode-specific selectors */}
      {captureMode === 'region' && <RegionSelector />}
      {captureMode === 'freeform' && <FreeformSelector />}
      {captureMode === 'window' && <WindowSelector />}

      {/* Magnifier loupe for region and freeform modes */}
      {(captureMode === 'region' || captureMode === 'freeform') && (
        <Magnifier screenshotSrc={screenshotBg} />
      )}
    </div>
  );
}
