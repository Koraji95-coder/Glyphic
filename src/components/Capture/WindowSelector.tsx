import { useState, useCallback, useEffect } from 'react';
import { useVaultStore } from '../../stores/vaultStore';
import { commands } from '../../lib/tauri/commands';
import type { WindowInfo } from '../../types/capture';

export function WindowSelector() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fetch the window list on mount
  useEffect(() => {
    commands.getWindowList().then(setWindows).catch((e) => {
      console.error('Failed to list windows:', e);
    });
  }, []);

  const handleWindowClick = useCallback(
    async (win: WindowInfo) => {
      try {
        await commands.finishCapture(
          'window',
          win.x,
          win.y,
          win.width,
          win.height,
          vaultPath ?? '',
        );
        window.history.back();
      } catch (e) {
        console.error('Window capture failed:', e);
      }
    },
    [vaultPath],
  );

  return (
    <div className="absolute inset-0 z-10" style={{ cursor: 'pointer' }}>
      {windows.map((win, i) => (
        <div
          key={i}
          className="absolute transition-all duration-75"
          style={{
            left: win.x,
            top: win.y,
            width: win.width,
            height: win.height,
            border:
              hoveredIndex === i
                ? '2px solid #6366f1'
                : '1px solid rgba(255,255,255,0.15)',
            backgroundColor:
              hoveredIndex === i ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
            zIndex: hoveredIndex === i ? 5 : 1,
          }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => handleWindowClick(win)}
        >
          {/* Window title tooltip */}
          {hoveredIndex === i && (
            <div
              className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                color: '#fff',
              }}
            >
              {win.title || 'Untitled Window'}
            </div>
          )}
        </div>
      ))}

      {/* Instruction text */}
      {windows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            No windows detected. Try region capture instead.
          </div>
        </div>
      )}
    </div>
  );
}
