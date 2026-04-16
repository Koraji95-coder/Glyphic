import type { LucideIcon } from 'lucide-react';
import { AppWindow, Monitor, PenTool, Scan, Timer, X } from 'lucide-react';
import type { CaptureDelay } from '../../stores/captureStore';
import { useCaptureStore } from '../../stores/captureStore';
import type { CaptureMode } from '../../types/capture';

const modes: { mode: CaptureMode; icon: LucideIcon; label: string; shortcut: string }[] = [
  { mode: 'region', icon: Scan, label: 'Region', shortcut: 'R' },
  { mode: 'window', icon: AppWindow, label: 'Window', shortcut: 'W' },
  { mode: 'freeform', icon: PenTool, label: 'Freeform', shortcut: 'F' },
  { mode: 'fullscreen', icon: Monitor, label: 'Fullscreen', shortcut: 'S' },
];

const delayLabels: Record<CaptureDelay, string> = {
  0: 'Off',
  3: '3s',
  5: '5s',
};

interface CaptureToolbarProps {
  onFullscreen?: () => void;
  captureCount?: number;
}

export function CaptureToolbar({ onFullscreen, captureCount = 0 }: CaptureToolbarProps) {
  const captureMode = useCaptureStore((s) => s.captureMode);
  const setCaptureMode = useCaptureStore((s) => s.setCaptureMode);
  const captureDelay = useCaptureStore((s) => s.captureDelay);
  const cycleDelay = useCaptureStore((s) => s.cycleDelay);

  const handleClose = () => {
    window.history.back();
  };

  const handleModeClick = (mode: CaptureMode) => {
    if (mode === 'fullscreen' && onFullscreen) {
      onFullscreen();
    } else {
      setCaptureMode(mode);
    }
  };

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 rounded-lg"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {modes.map(({ mode, icon: Icon, label, shortcut }) => (
        <button
          type="button"
          key={mode}
          onClick={() => handleModeClick(mode)}
          title={`${label} (${shortcut})`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
          style={{
            backgroundColor: captureMode === mode ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
            color: captureMode === mode ? '#fff' : 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}

      {/* Delay toggle */}
      <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
      <button
        type="button"
        onClick={cycleDelay}
        title={`Delay: ${delayLabels[captureDelay]} (D)`}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors"
        style={{
          backgroundColor: captureDelay > 0 ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
          color: captureDelay > 0 ? '#fbbf24' : 'rgba(255, 255, 255, 0.7)',
        }}
      >
        <Timer size={15} />
        <span>{delayLabels[captureDelay]}</span>
      </button>

      {/* Multi-capture counter badge */}
      {captureCount > 0 && (
        <>
          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc',
            }}
          >
            <span>{captureCount} captured</span>
          </div>
        </>
      )}

      {/* Divider */}
      <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

      <button
        type="button"
        onClick={handleClose}
        title="Close (Esc)"
        className="p-1.5 rounded-md transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255, 255, 255, 0.7)' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
