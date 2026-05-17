import type { LucideIcon } from 'lucide-react';
import { AppWindow, Monitor, PenTool, Scan, Timer, X } from 'lucide-react';
import { useCaptureStore } from '../../stores/captureStore';
import type { CaptureDelay } from '../../stores/captureStore';
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

  const handleClose = () => window.history.back();

  const handleModeClick = (mode: CaptureMode) => {
    if (mode === 'fullscreen' && onFullscreen) onFullscreen();
    else setCaptureMode(mode);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-1 bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 shadow-2xl rounded-lg px-3 py-2">
      {/* Mode buttons */}
      {modes.map(({ mode, icon: Icon, label, shortcut }) => (
        <button
          key={mode}
          onClick={() => handleModeClick(mode)}
          title={`${label} (${shortcut})`}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            captureMode === mode
              ? 'bg-blue-500 text-white'
              : 'hover:bg-zinc-800 text-zinc-300'
          }`}
        >
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-8 mx-2 bg-zinc-700" />

      {/* Delay toggle */}
      <button
        onClick={cycleDelay}
        title={`Delay: ${delayLabels[captureDelay]} (D)`}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          captureDelay > 0 ? 'bg-amber-500/10 text-amber-300' : 'hover:bg-zinc-800 text-zinc-300'
        }`}
      >
        <Timer size={17} />
        <span>{delayLabels[captureDelay]}</span>
      </button>

      {/* Multi-capture counter */}
      {captureCount > 0 && (
        <>
          <div className="w-px h-8 mx-2 bg-zinc-700" />
          <div className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500/10 text-indigo-300 text-sm font-medium rounded-lg">
            <span>{captureCount} captured</span>
          </div>
        </>
      )}

      {/* Close button */}
      <div className="w-px h-8 mx-2 bg-zinc-700" />
      <button
        onClick={handleClose}
        title="Close (Esc)"
        className="p-3 hover:bg-red-500/10 text-zinc-300 hover:text-red-300 rounded-lg transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
}