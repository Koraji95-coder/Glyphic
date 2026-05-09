import {
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutList,
  PinOff,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useVault } from '../../hooks/useVault';
import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { useFlashcardReviewStore } from '../../stores/flashcardReviewStore';
import { useHelpUiStore } from '../../stores/helpUiStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsUiStore } from '../../stores/settingsUiStore';
import { useVaultStore } from '../../stores/vaultStore';
import { usePromptModalStore } from '../../stores/promptModalStore';
import { ReviewSession } from '../Flashcards/ReviewSession';
import { BacklinksPanel } from './BacklinksPanel';
import { FileTree } from './FileTree';
import { SearchBar } from './SearchBar';
import { TagsPanel } from './TagsPanel';

export function Sidebar() {
  const [width, setWidth] = useState(260);
  const isResizing = useRef(false);
  const isMobile = useIsMobile();
  const {
    isSidebarOpen,
    closeSidebar,
    isFocusMode,
  } = useLayoutStore();
  const openReview = useFlashcardReviewStore((s) => s.open);
  const vaultConfig = useVaultStore((s) => s.vaultConfig);
  const fileTree = useVaultStore((s) => s.fileTree);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const refreshFileTree = useVaultStore((s) => s.refreshFileTree);
  const selectedFolderPath = useVaultStore((s) => s.selectedFolderPath);
  const pinnedNotes = useVaultStore((s) => s.pinnedNotes);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const unpinNote = useVaultStore((s) => s.unpinNote);
  const { createNote } = useVault();
  const { openPrompt } = usePromptModalStore();

  // Count notes and folders
  const { noteCount, folderCount } = countEntries(fileTree);
  const vaultName = vaultConfig?.vault?.name || 'My Vault';
  const initial = vaultName.charAt(0).toUpperCase();

  const handleNewNote = useCallback(async (name?: string) => {
    if (name) {
      // direct from event
      try { await createNote('', name); } catch (e) { reportError({ context: 'Sidebar create note', message: 'Failed to create note', error: e }); }
      return;
    }
    openPrompt({
      title: 'New Note',
      placeholder: 'Note name',
      onConfirm: async (name: string) => {
        if (!name) return;
        try { await createNote('', name); } catch (e) { reportError({ context: 'Sidebar create note', message: 'Failed to create note', error: e }); }
      },
    });
  }, [createNote, openPrompt]);

  const handleNewFolder = useCallback(() => {
    openPrompt({
      title: 'New Folder',
      placeholder: 'Folder name',
      onConfirm: async (name: string) => {
        if (!name || !vaultPath) return;
        try {
          await commands.createFolder(vaultPath, name);
          await refreshFileTree();
        } catch (e) { reportError({ context: 'Sidebar create folder', message: 'Failed to create folder', error: e }); }
      },
    });
  }, [vaultPath, refreshFileTree, openPrompt]);

  const handleTrash = useCallback(() => {
    // replace alert with toast (see step 5)
    // or temporarily: openPrompt({ title: 'Trash Info', isConfirm: true, confirmLabel: 'OK', onConfirm: () => {} });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMobile]);

  const sidebarContent = (
    <>
      {/* Vault header */}
      <div
        style={{
          padding: '10px 12px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* User / Vault info */}
        <div className="flex items-center" style={{ gap: '8px', padding: '2px 4px' }}>
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--accent-gradient)',
              boxShadow: '0 10px 24px rgba(163,116,247,0.2)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {vaultName}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {noteCount} notes · {folderCount} folders
            </div>
          </div>
        </div>

        <SearchBar />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SectionLabel>Quick actions</SectionLabel>
          <div className="flex" style={{ gap: '6px' }}>
            <SidebarActionButton primary icon={<Plus size={13} />} onClick={() => handleNewNote()}>
              New note
            </SidebarActionButton>
            <SidebarActionButton icon={<FolderOpen size={13} />} onClick={handleNewFolder}>
              Folder
            </SidebarActionButton>
          </div>
        </div>
      </div>

      {/* Pinned notes section */}
      {pinnedNotes.length > 0 && (
        <div style={{ padding: '4px 10px 6px' }}>
          <SectionLabel>Pinned</SectionLabel>
          {pinnedNotes.map((path) => {
            const name = path.replace(/\.md$/, '').split('/').pop() || path;
            return (
              <div
                key={path}
                className="flex items-center"
                style={{
                  gap: '6px',
                  padding: '4px 8px',
                  margin: '1px 2px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.12s',
                }}
                onClick={() => setActiveNote(path, path)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-hover)';
                  (e.currentTarget as HTMLDivElement).style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLDivElement).style.color = 'var(--text-secondary)';
                }}
              >
                <FileText size={11} style={{ flexShrink: 0 }} />
                <span className="flex-1 truncate">{name}</span>
                <button
                  type="button"
                  title="Unpin note"
                  onClick={(e) => {
                    e.stopPropagation();
                    unpinNote(path);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    color: 'var(--text-ghost)',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-active)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-ghost)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <PinOff size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Tag filter chips */}
      <TagsPanel />

      {/* Backlinks */}
      <BacklinksPanel />

      {/* File tree */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '4px 0' }}>
        <FileTree />
      </div>

      {/* Sidebar footer */}
      <div
        className="flex shrink-0"
        style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--glass-border)',
          gap: '4px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
        }}
      >
        <FooterButton
          icon={<Settings size={12} />}
          label="Settings"
          onClick={() => useSettingsUiStore.getState().open('general')}
        />
        <FooterButton icon={<Trash2 size={12} />} label="Trash" onClick={handleTrash} />
        <FooterButton icon={<HelpCircle size={12} />} label="Help" onClick={() => useHelpUiStore.getState().open()} />
        <FooterButton icon={<LayoutList size={12} />} label="Review" onClick={openReview} />
      </div>
      <ReviewSession />
    </>
  );

  // In focus mode on desktop, hide the sidebar entirely
  if (!isMobile && isFocusMode) {
    return null;
  }

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isSidebarOpen && (
          <div
            onClick={closeSidebar}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 40,
            }}
          />
        )}

        {/* Drawer */}
        <aside
          className="flex flex-col h-full"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            backgroundColor: 'var(--glass-surface)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            borderRight: '1px solid var(--glass-border)',
            zIndex: 50,
            transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-full relative"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderRight: '1px solid var(--glass-border)',
      }}
    >
      {sidebarContent}

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-dim)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      />
    </aside>
  );
}

/** Count notes and folders recursively */
function countEntries(entries: ReturnType<typeof useVaultStore.getState>['fileTree']): {
  noteCount: number;
  folderCount: number;
} {
  let noteCount = 0;
  let folderCount = 0;
  for (const e of entries) {
    if (e.entry_type === 'file') noteCount++;
    else folderCount++;
    if (e.children) {
      const sub = countEntries(e.children);
      noteCount += sub.noteCount;
      folderCount += sub.folderCount;
    }
  }
  return { noteCount, folderCount };
}

function SidebarActionButton({
  children,
  icon,
  primary,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        flex: 1,
        gap: '6px',
        padding: '8px 0',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        border: primary ? '1px solid transparent' : '1px solid var(--glass-border)',
        background: primary
          ? 'linear-gradient(135deg, #ff8b5e, #fb923c)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
        color: primary ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.15s',
        boxShadow: primary ? '0 12px 28px rgba(249,118,85,0.26)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onMouseEnter={(e) => {
        if (primary) {
          e.currentTarget.style.filter = 'brightness(1.12)';
        } else {
          e.currentTarget.style.background =
            'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (primary) {
          e.currentTarget.style.filter = '';
        } else {
          e.currentTarget.style.background =
            'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '9px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-ghost)',
        padding: '2px 4px 0',
      }}
    >
      {children}
    </div>
  );
}

function FooterButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        flex: 1,
        gap: '5px',
        padding: '7px 0',
        borderRadius: '8px',
        fontSize: '10px',
        color: 'var(--text-ghost)',
        cursor: 'pointer',
        border: '1px solid transparent',
        background: 'transparent',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(45,212,191,0.12)';
        e.currentTarget.style.borderColor = 'rgba(45,212,191,0.18)';
        e.currentTarget.style.color = 'var(--accent-teal)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.color = 'var(--text-ghost)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
