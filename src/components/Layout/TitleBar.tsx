import { useState, useEffect, useCallback } from 'react';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useVaultStore } from '../../stores/vaultStore';

export function TitleBar() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const [isMaximized, setIsMaximized] = useState(false);

  const appWindow = getCurrentWindow();

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
      } catch {
        /* not in Tauri */
      }
    };
    checkMaximized();

    let unlisten: (() => void) | undefined;
    appWindow
      .onResized(async () => {
        try {
          setIsMaximized(await appWindow.isMaximized());
        } catch {
          /* noop */
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, []);

  const noteTitle = activeNotePath
    ? activeNotePath.split('/').pop()?.replace(/\.md$/, '') ?? ''
    : '';

  const handleMinimize = useCallback(() => appWindow.minimize(), []);
  const handleToggleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  }, []);
  const handleClose = useCallback(() => appWindow.close(), []);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 px-3 select-none shrink-0"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* App name */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <span
          className="text-sm font-semibold tracking-wide"
          style={{ color: 'var(--accent)' }}
        >
          Glyphic
        </span>
      </div>

      {/* Active note title */}
      <div
        className="flex-1 text-center text-sm truncate px-4"
        style={{ color: 'var(--text-secondary)' }}
      >
        {noteTitle}
      </div>

      {/* Window controls */}
      <div className="flex items-center gap-0.5 min-w-[80px] justify-end">
        <button
          onClick={handleMinimize}
          className="p-1.5 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleToggleMaximize}
          className="p-1.5 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="p-1.5 rounded transition-colors hover:bg-red-500/20 hover:text-red-500"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
