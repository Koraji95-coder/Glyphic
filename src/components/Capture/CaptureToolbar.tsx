import type { LucideIcon } from 'lucide-react';
import { Scan, AppWindow, PenTool, Monitor, X } from 'lucide-react';
import { useCaptureStore } from '../../stores/captureStore';
import type { CaptureMode } from '../../types/capture';

const modes: { mode: CaptureMode; icon: LucideIcon; label: string; shortcut: string }[] = [
  { mode: 'region', icon: Scan, label: 'Region', shortcut: 'R' },
  { mode: 'window', icon: AppWindow, label: 'Window', shortcut: 'W' },
  { mode: 'freeform', icon: PenTool, label: 'Freeform', shortcut: 'F' },
  { mode: 'fullscreen', icon: Monitor, label: 'Fullscreen', shortcut: 'S' },
];

export function CaptureToolbar() {
  const captureMode = useCaptureStore((s) => s.captureMode);
  const setCaptureMode = useCaptureStore((s) => s.setCaptureMode);

  const handleClose = () => {
    window.history.back();
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 rounded-lg"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {modes.map(({ mode, icon: Icon, label, shortcut }) => (
        <button
          key={mode}
          onClick={() => setCaptureMode(mode)}
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

      {/* Divider */}
      <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

      <button
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
