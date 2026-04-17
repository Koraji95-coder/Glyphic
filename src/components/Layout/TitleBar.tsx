import { getCurrentWindow } from '@tauri-apps/api/window';
import { Menu, MessageSquare, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useChatStore } from '../../stores/chatStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useVaultStore } from '../../stores/vaultStore';

export function TitleBar() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const openNotes = useVaultStore((s) => s.openNotes);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const addOpenNote = useVaultStore((s) => s.addOpenNote);
  const removeOpenNote = useVaultStore((s) => s.removeOpenNote);
  const { isOpen: chatOpen, togglePanel } = useChatStore();
  const { toggleSidebar } = useLayoutStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const isMobile = useIsMobile();

  const appWindow = getCurrentWindow();

  // Track open notes — ensure active note is in the tab list
  useEffect(() => {
    if (activeNotePath && !openNotes.includes(activeNotePath)) {
      addOpenNote(activeNotePath);
    }
  }, [activeNotePath, openNotes, addOpenNote]);

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

  const handleMinimize = useCallback(() => appWindow.minimize(), []);
  const handleToggleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  }, []);
  const handleClose = useCallback(() => appWindow.close(), []);

  const handleCloseTab = useCallback(
    (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      removeOpenNote(path);
      // If closing the active tab, switch to an adjacent one
      if (path === activeNotePath) {
        const remaining = openNotes.filter((p) => p !== path);
        if (remaining.length > 0) {
          setActiveNote(remaining[remaining.length - 1], remaining[remaining.length - 1]);
        }
      }
    },
    [activeNotePath, openNotes, removeOpenNote, setActiveNote],
  );

  const handleTabClick = useCallback(
    (path: string) => {
      setActiveNote(path, path);
    },
    [setActiveNote],
  );

  return (
    <div
      data-tauri-drag-region
      className="flex items-center select-none shrink-0"
      style={{
        height: 'var(--titlebar-height)',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        paddingLeft: '12px',
        paddingRight: '12px',
        gap: '10px',
      }}
    >
      {/* Left: hamburger (mobile) or traffic lights (desktop) */}
      <div className="flex items-center shrink-0" style={{ gap: '8px' }}>
        {isMobile ? (
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
            {/* macOS traffic lights */}
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
            <div className="w-px h-4" style={{ backgroundColor: 'var(--border)' }} />
          </>
        )}
      </div>

      {/* Tab bar */}
      {!isMobile && openNotes.length > 0 ? (
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto" style={{ gap: '2px', padding: '0 4px' }}>
          {openNotes.map((path) => {
            const name = path.replace(/\.md$/, '').split('/').pop() || path;
            const isActive = path === activeNotePath;
            return (
              <div
                key={path}
                onClick={() => handleTabClick(path)}
                className="flex items-center shrink-0 cursor-pointer"
                style={{
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  backgroundColor: isActive ? 'var(--bg-editor)' : 'transparent',
                  position: 'relative',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: '11px' }}>📄</span>
                <span className="truncate" style={{ maxWidth: '120px' }}>
                  {name}
                </span>
                <span
                  onClick={(e) => handleCloseTab(path, e)}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    color: 'var(--text-ghost)',
                    marginLeft: '2px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-active)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-ghost)';
                  }}
                >
                  <X size={9} />
                </span>
                {/* Active tab indicator bar */}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-1px',
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'var(--accent)',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback: center breadcrumb when no tabs (mobile or empty) */
        <div
          className="flex-1 flex items-center justify-center text-xs truncate px-4"
          style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
        >
          {activeNotePath ? (
            isMobile ? (
              <span style={{ color: 'var(--text-secondary)' }}>
                {activeNotePath.replace(/\.md$/, '').split('/').pop()}
              </span>
            ) : (
              <span style={{ color: 'var(--text-ghost)' }}>No note selected</span>
            )
          ) : (
            <span style={{ color: 'var(--text-ghost)' }}>No note selected</span>
          )}
        </div>
      )}

      {/* Right: actions */}
      <div className="flex items-center shrink-0" style={{ gap: '4px' }}>
        <button
          title="Quick Switcher (⌘P)"
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--text-tertiary)', backgroundColor: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Search size={14} />
        </button>
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
