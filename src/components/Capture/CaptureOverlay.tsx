import { useCallback, useEffect, useRef, useState } from 'react';
import { commands } from '../../lib/tauri/commands';
import { useCaptureStore } from '../../stores/captureStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { CaptureMode } from '../../types/capture';
import { CaptureToolbar } from './CaptureToolbar';
import { FreeformSelector } from './FreeformSelector';
import { Magnifier } from './Magnifier';
import { RegionSelector } from './RegionSelector';
import { WindowSelector } from './WindowSelector';

export function CaptureOverlay() {
  const captureMode = useCaptureStore((s) => s.captureMode);
  const setCaptureMode = useCaptureStore((s) => s.setCaptureMode);
  const multiCaptureQueue = useCaptureStore((s) => s.multiCaptureQueue);
  const clearQueue = useCaptureStore((s) => s.clearQueue);
  const captureDelay = useCaptureStore((s) => s.captureDelay);
  const cycleDelay = useCaptureStore((s) => s.cycleDelay);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [screenshotBg, _setScreenshotBg] = useState<string | null>(null);
  const [delayCountdown, setDelayCountdown] = useState<number | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Execute a capture action after applying the configured delay. */
  const withDelay = useCallback(
    (action: () => void) => {
      if (captureDelay === 0) {
        action();
        return;
      }
      let remaining = captureDelay;
      setDelayCountdown(remaining);
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) {
          setDelayCountdown(null);
          action();
        } else {
          setDelayCountdown(remaining);
          delayTimerRef.current = setTimeout(tick, 1000);
        }
      };
      delayTimerRef.current = setTimeout(tick, 1000);
    },
    [captureDelay],
  );

  // Clean up delay timer on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, []);

  const handleFullscreenCapture = useCallback(async () => {
    const doCapture = async () => {
      try {
        await commands.finishCapture('fullscreen', 0, 0, 0, 0, vaultPath ?? '');
        window.history.back();
      } catch (e) {
        console.error('Fullscreen capture failed:', e);
      }
    };
    withDelay(doCapture);
  }, [vaultPath, withDelay]);

  // Handle keyboard shortcuts for mode switching and escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore during countdown
      if (delayCountdown !== null) return;

      const key = e.key.toLowerCase();
      const modeKeys: Record<string, CaptureMode> = {
        r: 'region',
        w: 'window',
        f: 'freeform',
        s: 'fullscreen',
      };

      if (key === 'escape') {
        // If there are queued multi-captures, they were already emitted as events
        // and inserted by the editor; just clear the queue and close
        clearQueue();
        window.history.back();
        return;
      }

      if (key === 'd') {
        cycleDelay();
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
    [setCaptureMode, handleFullscreenCapture, clearQueue, cycleDelay, delayCountdown],
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

      {/* Delay countdown */}
      {delayCountdown !== null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div
            className="text-7xl font-bold"
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              textShadow: '0 2px 16px rgba(0, 0, 0, 0.6)',
            }}
          >
            {delayCountdown}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <CaptureToolbar onFullscreen={handleFullscreenCapture} captureCount={multiCaptureQueue.length} />

      {/* Mode-specific selectors (disabled during countdown) */}
      {delayCountdown === null && (
        <>
          {captureMode === 'region' && <RegionSelector />}
          {captureMode === 'freeform' && <FreeformSelector />}
          {captureMode === 'window' && <WindowSelector />}
        </>
      )}

      {/* Magnifier loupe for region and freeform modes */}
      {(captureMode === 'region' || captureMode === 'freeform') && <Magnifier screenshotSrc={screenshotBg} />}
    </div>
  );
}
