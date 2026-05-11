import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  FileText,
  GraduationCap,
  Grid2X2,
  Maximize2,
  Menu,
  MessageSquare,
  Minimize2,
  Plus,
  Search,
  Workflow,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { reportError } from '../../lib/errorReporter';
import { frontmatterRegistry } from '../../lib/frontmatterRegistry';
import { commands } from '../../lib/tauri/commands';
import { composeNote } from '../../lib/tiptap/markdownParser';
import { useChatStore } from '../../stores/chatStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { usePromptModalStore } from '../../stores/promptModalStore';
import { useVaultStore } from '../../stores/vaultStore';

export function TitleBar() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const openNotes = useVaultStore((s) => s.openNotes);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const addOpenNote = useVaultStore((s) => s.addOpenNote);
  const removeOpenNote = useVaultStore((s) => s.removeOpenNote);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const { openPrompt } = usePromptModalStore();
  const content = useEditorStore((s) => s.content);
  const isDirty = useEditorStore((s) => s.isDirty);
  const setSaving = useEditorStore((s) => s.setSaving);
  const markSaved = useEditorStore((s) => s.markSaved);
  const { isOpen: chatOpen, togglePanel } = useChatStore();
  const {
    toggleSidebar,
    isFocusMode,
    toggleFocusMode,
    isFePrepMode,
    isVaultMode,
    isDiagramMode,
    openFePrep,
    openVaultMode,
    openDiagramMode,
    closeFePrep,
  } = useLayoutStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const isMobile = useIsMobile();

  let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
  try {
    appWindow = getCurrentWindow();
  } catch {
    appWindow = null;
  }

  useEffect(() => {
    if (activeNotePath && !openNotes.includes(activeNotePath)) {
      addOpenNote(activeNotePath);
    }
  }, [activeNotePath, openNotes, addOpenNote]);

  useEffect(() => {
    if (isMobile || !appWindow) return;

    const checkMaximized = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
      } catch {
        // noop outside Tauri
      }
    };

    void checkMaximized();

    let unlisten: (() => void) | undefined;
    appWindow
      .onResized(async () => {
        try {
          setIsMaximized(await appWindow.isMaximized());
        } catch {
          // noop outside Tauri
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, [appWindow, isMobile]);

  const handleMinimize = useCallback(async () => {
    if (!appWindow) return;
    try {
      await appWindow.minimize();
    } catch (error) {
      reportError({ context: 'Title bar minimize', message: 'Unable to minimize window', error });
    }
  }, [appWindow]);

  const handleToggleMaximize = useCallback(async () => {
    if (!appWindow) return;
    try {
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } catch (error) {
      reportError({ context: 'Title bar maximize', message: 'Unable to toggle maximize', error });
    }
  }, [appWindow]);

  const handleClose = useCallback(async () => {
    if (!appWindow) return;
    try {
      await appWindow.close();
    } catch (error) {
      reportError({ context: 'Title bar close', message: 'Unable to close window', error });
    }
  }, [appWindow]);

  const saveActiveNoteNow = useCallback(async () => {
    if (!vaultPath || !activeNotePath || !isDirty) return;
    try {
      setSaving(true);
      await commands.saveNote(
        vaultPath,
        activeNotePath,
        composeNote({
          body: content,
          frontmatter: frontmatterRegistry.get(activeNotePath),
        }),
      );
      markSaved();
    } catch (error) {
      reportError({ context: 'Title bar close tab save', message: 'Failed to save before closing tab', error });
    } finally {
      setSaving(false);
    }
  }, [activeNotePath, content, isDirty, markSaved, setSaving, vaultPath]);

  const closeTab = useCallback(
    async (path: string) => {
      if (path === activeNotePath) {
        await saveActiveNoteNow();
      }
      removeOpenNote(path);
      if (path === activeNotePath) {
        const remaining = openNotes.filter((item) => item !== path);
        if (remaining.length > 0) {
          setActiveNote(remaining[remaining.length - 1], remaining[remaining.length - 1]);
        }
      }
    },
    [activeNotePath, openNotes, removeOpenNote, saveActiveNoteNow, setActiveNote],
  );

  const handleCloseTab = useCallback(
    (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      void closeTab(path);
    },
    [closeTab],
  );

  const handleTabClick = useCallback(
    (path: string) => {
      setActiveNote(path, path);
    },
    [setActiveNote],
  );

  const openEditorMode = useCallback(() => {
    closeFePrep();
  }, [closeFePrep]);

  const activeWorkspace: 'dashboard' | 'vault' | 'diagram' | 'study' = isVaultMode
    ? 'vault'
    : isDiagramMode
      ? 'diagram'
      : isFePrepMode
        ? 'study'
        : 'dashboard';

  const workspaceItems = useMemo(
    () => [
      { key: 'dashboard' as const, label: 'Dashboard', icon: Grid2X2, onClick: openEditorMode },
      { key: 'vault' as const, label: 'Vault', icon: FileText, onClick: openVaultMode },
      { key: 'diagram' as const, label: 'Diagrams', icon: Workflow, onClick: openDiagramMode },
      { key: 'study' as const, label: 'FE Prep', icon: GraduationCap, onClick: openFePrep },
    ],
    [openDiagramMode, openEditorMode, openFePrep, openVaultMode],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      const index = workspaceItems.findIndex((item) => item.key === activeWorkspace);
      if (index < 0) return;

      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + delta + workspaceItems.length) % workspaceItems.length;
      workspaceItems[nextIndex].onClick();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeWorkspace, workspaceItems]);

  return (
    <div
      data-tauri-drag-region
      className="flex flex-col select-none shrink-0"
      style={{
        height: '72px',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), var(--glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: '0 10px 32px rgba(0,0,0,0.22)',
        padding: '8px 12px 10px',
        gap: '8px',
      }}
    >
      <div className="flex items-center" style={{ gap: '10px', minHeight: '28px' }}>
        <div className="flex items-center shrink-0" style={{ gap: '8px', minWidth: isMobile ? 'auto' : '170px' }}>
          {isMobile ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Open sidebar"
              className="touch-target p-2 rounded transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Menu size={18} />
            </button>
          ) : appWindow ? (
            <>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleMinimize}
                  aria-label="Minimize"
                  className="rounded transition-colors"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Minimize2 size={12} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleMaximize}
                  aria-label={isMaximized ? 'Restore' : 'Maximize'}
                  className="rounded transition-colors"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Maximize2 size={12} />
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="rounded transition-colors"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '1px solid rgba(248,113,113,0.25)',
                    background: 'rgba(248,113,113,0.08)',
                    color: 'var(--error)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
              <div className="w-px h-4" style={{ backgroundColor: 'var(--border)' }} />
            </>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>Browser Preview</div>
          )}

          {!isMobile && (
            <div className="flex items-center" style={{ gap: '8px' }}>
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '8px',
                  background: 'var(--accent-gradient)',
                  color: '#fff',
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  boxShadow: '0 10px 24px rgba(163,116,247,0.2)',
                }}
              >
                G
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Glyphic</div>
                <div
                  style={{
                    fontSize: '9px',
                    color: 'var(--text-ghost)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Knowledge Workspace
                </div>
              </div>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('glyphic:open-quick-switcher'))}
            className="flex items-center flex-1 min-w-0"
            style={{
              gap: '10px',
              height: '34px',
              padding: '0 14px',
              borderRadius: '999px',
              border: '1px solid var(--glass-border)',
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), rgba(255,255,255,0.03)',
              color: 'var(--text-secondary)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              cursor: 'pointer',
            }}
          >
            <Search size={14} />
            <span className="truncate" style={{ flex: 1, textAlign: 'left', fontSize: '12px' }}>
              Ask anything, search notes, or run commands
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '999px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-ghost)',
              }}
            >
              Ctrl+P
            </span>
          </button>
        )}

        <div className="flex items-center shrink-0" style={{ gap: '6px' }}>
          {!isMobile && (
            <button
              type="button"
              onClick={toggleFocusMode}
              title={isFocusMode ? 'Exit focus mode (F11)' : 'Focus mode — hide sidebar (F11)'}
              aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
              className="rounded transition-colors"
              style={{
                padding: '6px 10px',
                background: isFocusMode
                  ? 'linear-gradient(135deg, rgba(163,116,247,0.18), rgba(244,114,182,0.08))'
                  : 'rgba(255,255,255,0.03)',
                color: isFocusMode ? 'var(--accent)' : 'var(--text-secondary)',
                border: isFocusMode ? '1px solid var(--accent-dim)' : '1px solid var(--border-subtle)',
                boxShadow: isFocusMode ? '0 10px 24px rgba(163,116,247,0.16)' : 'none',
                cursor: 'pointer',
              }}
            >
              {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          <button
            type="button"
            onClick={togglePanel}
            title="ScribeAI Chat (Ctrl+Shift+A)"
            className="rounded transition-colors"
            style={{
              padding: '6px 10px',
              background: chatOpen
                ? 'linear-gradient(135deg, rgba(163,116,247,0.18), rgba(249,118,85,0.08))'
                : 'rgba(255,255,255,0.03)',
              color: chatOpen ? 'var(--accent)' : 'var(--text-secondary)',
              border: chatOpen ? '1px solid var(--accent-dim)' : '1px solid var(--border-subtle)',
              boxShadow: chatOpen ? '0 10px 24px rgba(163,116,247,0.16)' : 'none',
              cursor: 'pointer',
            }}
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center min-w-0" style={{ gap: '10px' }}>
        {!isMobile && (
          <div className="flex items-center shrink-0" style={{ gap: '6px' }}>
            {workspaceItems.map((item) => {
              const Icon = item.icon;
              const active = activeWorkspace === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center rounded transition-colors"
                  style={{
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: active ? '1px solid rgba(163,116,247,0.22)' : '1px solid transparent',
                    background: active
                      ? 'linear-gradient(135deg, rgba(163,116,247,0.18), rgba(249,118,85,0.08))'
                      : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {!isMobile && openNotes.length > 0 ? (
          <div className="flex items-center flex-1 min-w-0 overflow-x-auto" style={{ gap: '4px', paddingRight: '4px' }}>
            {openNotes.map((path) => {
              const name = path.replace(/\.md$/, '').split('/').pop() || path;
              const isActive = path === activeNotePath;
              return (
                <div
                  key={path}
                  onClick={() => handleTabClick(path)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      void closeTab(path);
                    }
                  }}
                  className="flex items-center shrink-0 cursor-pointer"
                  style={{
                    gap: '5px',
                    padding: '6px 10px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(163,116,247,0.18), rgba(249,118,85,0.08))'
                      : 'rgba(255,255,255,0.02)',
                    border: isActive ? '1px solid rgba(163,116,247,0.22)' : '1px solid var(--border-subtle)',
                    boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.2)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <FileText size={12} />
                  <span className="truncate" style={{ maxWidth: '120px' }}>
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(path, e)}
                    aria-label={`Close ${name}`}
                    title="Close tab"
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      color: 'var(--text-ghost)',
                      marginLeft: '2px',
                      cursor: 'pointer',
                      border: 'none',
                      background: 'transparent',
                    }}
                  >
                    <X size={9} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              title="New note (prompts for name)"
              aria-label="New note"
              onClick={() => {
                openPrompt({
                  title: 'New Note',
                  placeholder: 'Note name',
                  onConfirm: (result) => {
                    const name = typeof result === 'string' ? result.trim() : '';
                    if (name) {
                      window.dispatchEvent(new CustomEvent('glyphic:new-note', { detail: { name } }));
                    }
                  },
                });
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-ghost)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.12s',
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
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
      </div>
    </div>
  );
}
