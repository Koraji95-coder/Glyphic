import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useVaultStore } from '../../stores/vaultStore';
import { useChatStore } from '../../stores/chatStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { MessageSquare, Menu } from 'lucide-react';

export function TitleBar() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const { isOpen: chatOpen, togglePanel } = useChatStore();
  const { toggleSidebar } = useLayoutStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const isMobile = useIsMobile();

  const appWindow = getCurrentWindow();

  useEffect(() => {
    if (isMobile) return;

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
  }, [isMobile]);

  const noteParts = activeNotePath
    ? activeNotePath.replace(/\.md$/, '').split('/')
    : [];

  const handleMinimize = useCallback(() => appWindow.minimize(), []);
  const handleToggleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  }, []);
  const handleClose = useCallback(() => appWindow.close(), []);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between select-none shrink-0"
      style={{
        height: 'var(--titlebar-height)',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        paddingLeft: '12px',
        paddingRight: '12px',
      }}
    >
      {/* Left: hamburger (mobile) or traffic lights + brand (desktop) */}
      <div className="flex items-center gap-3" style={{ minWidth: isMobile ? 'auto' : '160px' }}>
        {isMobile ? (
          /* Hamburger menu for mobile */
          <button
            onClick={toggleSidebar}
            aria-label="Open sidebar"
            className="touch-target p-2 rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Menu size={18} />
          </button>
        ) : (
          <>
            {/* macOS-style traffic light dots */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClose}
                aria-label="Close"
                className="w-3 h-3 rounded-full transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#ff5f57' }}
              />
              <button
                onClick={handleMinimize}
                aria-label="Minimize"
                className="w-3 h-3 rounded-full transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#febc2e' }}
              />
              <button
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                className="w-3 h-3 rounded-full transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#28c840' }}
              />
            </div>

            {/* Separator */}
            <div className="w-px h-4" style={{ backgroundColor: 'var(--border)' }} />

            {/* Brand logo + name */}
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded text-xs font-bold"
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--bg-app)',
                  fontFamily: 'var(--font-display)',
                  borderRadius: '4px',
                }}
              >
                G
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
              >
                Glyphic
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center: breadcrumb path (full on desktop, note title only on mobile) */}
      <div
        className="flex-1 flex items-center justify-center text-xs truncate px-4"
        style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
      >
        {noteParts.length > 0 ? (
          isMobile ? (
            /* Mobile: show only the note title */
            <span style={{ color: 'var(--text-secondary)' }}>
              {noteParts[noteParts.length - 1]}
            </span>
          ) : (
            /* Desktop: full breadcrumb path */
            <span>
              {noteParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && (
                    <span style={{ color: 'var(--text-ghost)', margin: '0 4px' }}>/</span>
                  )}
                  <span style={{ color: i === noteParts.length - 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                    {part}
                  </span>
                </span>
              ))}
            </span>
          )
        ) : (
          <span style={{ color: 'var(--text-ghost)' }}>No note selected</span>
        )}
      </div>

      {/* Right: Chat toggle */}
      <div className="flex items-center" style={{ minWidth: isMobile ? 'auto' : '160px', justifyContent: 'flex-end' }}>
        <button
          onClick={togglePanel}
          title="ScribeAI Chat (Ctrl+Shift+A)"
          className="touch-target p-1.5 rounded transition-colors"
          style={{
            backgroundColor: chatOpen ? 'var(--accent-dim)' : 'transparent',
            color: chatOpen ? 'var(--accent)' : 'var(--text-tertiary)',
          }}
          onMouseEnter={(e) => {
            if (!chatOpen) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = chatOpen ? 'var(--accent-dim)' : 'transparent';
          }}
        >
          <MessageSquare size={15} />
        </button>
      </div>
    </div>
  );
}
