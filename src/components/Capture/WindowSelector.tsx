import { useCallback, useEffect, useState } from 'react';

import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { useCaptureStore } from '../../stores/captureStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { WindowInfo } from '../../types/capture';

export function WindowSelector() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const addToQueue = useCaptureStore((s) => s.addToQueue);

  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    commands
      .getWindowList()
      .then(setWindows)
      .catch((e) => {
        reportError({ context: 'Capture window list', message: 'Failed to list windows', error: e });
      });
  }, []);

  const handleWindowClick = useCallback(
    async (win: WindowInfo, e: React.MouseEvent) => {
      try {
        const result = await commands.finishCapture(
          'window',
          win.x,
          win.y,
          win.width,
          win.height,
          vaultPath ?? ''
        );

        if (e.shiftKey) {
          addToQueue(result);
        } else {
          window.history.back();
        }
      } catch (e) {
        reportError({ context: 'Capture window', message: 'Window capture failed', error: e });
      }
    },
    [vaultPath, addToQueue]
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between bg-zinc-900">
        <span className="font-semibold text-white">Select Window</span>
      </div>

      <div className="flex-1 p-6 grid grid-cols-2 gap-4 overflow-y-auto">
        {windows.map((win, i) => (
          <button
            key={i}
            onClick={(e) => handleWindowClick(win, e)}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={`group relative flex flex-col items-center justify-center p-6 rounded-lg border transition-all ${
              hoveredIndex === i
                ? 'border-violet-500 bg-zinc-900 shadow-sm scale-105'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            {/* Window preview placeholder */}
            <div className="w-40 h-28 bg-zinc-800 rounded-md mb-4 flex items-center justify-center border border-zinc-700 group-hover:border-violet-400 transition-colors">
              <span className="text-zinc-400 text-xs font-mono">WINDOW</span>
            </div>
            <div className="text-sm font-medium text-white text-center line-clamp-2">{win.title || 'Untitled Window'}</div>
            <div className="text-xs text-zinc-400 mt-1">
              {win.width}×{win.height}
            </div>
          </button>
        ))}
      </div>

      {windows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-center px-8">
          <div>
            <p className="text-lg">No windows detected</p>
            <p className="text-sm mt-2">Try using region capture instead</p>
          </div>
        </div>
      )}
    </div>
  );
}