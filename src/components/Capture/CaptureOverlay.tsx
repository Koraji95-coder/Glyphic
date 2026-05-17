import { convertFileSrc } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reportError } from '../../lib/errorReporter';
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

  const [screenshotBg, setScreenshotBg] = useState<string | null>(null);
  const [delayCountdown, setDelayCountdown] = useState<number | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bg = params.get('bg');
    if (bg) setScreenshotBg(convertFileSrc(bg));
  }, []);

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
        reportError({ context: 'Capture overlay', message: 'Fullscreen capture failed', error: e });
      }
    };
    withDelay(doCapture);
  }, [vaultPath, withDelay]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (delayCountdown !== null) return;
      const key = e.key.toLowerCase();

      if (key === 'escape') {
        commands.cancelCapture().catch(() => {});
        clearQueue();
        window.history.back();
        return;
      }

      if (key === 'd') {
        cycleDelay();
        return;
      }

      const modeKeys: Record<string, CaptureMode> = { r: 'region', w: 'window', f: 'freeform', s: 'fullscreen' };
      if (key in modeKeys) {
        const newMode = modeKeys[key];
        if (newMode === 'fullscreen') handleFullscreenCapture();
        else setCaptureMode(newMode);
      }
    },
    [setCaptureMode, handleFullscreenCapture, clearQueue, cycleDelay, delayCountdown],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (captureMode === 'fullscreen') handleFullscreenCapture();
  }, [captureMode, handleFullscreenCapture]);

  if (captureMode === 'fullscreen') return null;

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
      <div className="absolute inset-0 bg-black/40" />

      {/* Delay countdown */}
      {delayCountdown !== null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-[180px] font-bold text-white/90 tracking-[-0.05em] drop-shadow-2xl">
            {delayCountdown}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <CaptureToolbar onFullscreen={handleFullscreenCapture} captureCount={multiCaptureQueue.length} />

      {/* Mode-specific selectors */}
      {delayCountdown === null && (
        <>
          {captureMode === 'region' && <RegionSelector />}
          {captureMode === 'freeform' && <FreeformSelector />}
          {captureMode === 'window' && <WindowSelector />}
        </>
      )}

      {/* Magnifier */}
      {(captureMode === 'region' || captureMode === 'freeform') && <Magnifier screenshotSrc={screenshotBg} />}
    </div>
  );
}