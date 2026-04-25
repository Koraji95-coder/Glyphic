import { HelpCircle, LayoutList, Settings, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useFlashcardReviewStore } from '../../stores/flashcardReviewStore';
import { useHelpUiStore } from '../../stores/helpUiStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsUiStore } from '../../stores/settingsUiStore';
import { useVaultStore } from '../../stores/vaultStore';
import { ReviewSession } from '../Flashcards/ReviewSession';
import { FileTree } from './FileTree';
import { SearchBar } from './SearchBar';
import { TagsPanel } from './TagsPanel';

export function Sidebar() {
  const [width, setWidth] = useState(260);
  const isResizing = useRef(false);
  const isMobile = useIsMobile();
  const { isSidebarOpen, closeSidebar } = useLayoutStore();
  const openReview = useFlashcardReviewStore((s) => s.open);
  const vaultConfig = useVaultStore((s) => s.vaultConfig);
  const fileTree = useVaultStore((s) => s.fileTree);

  // Count notes and folders
  const { noteCount, folderCount } = countEntries(fileTree);
  const vaultName = vaultConfig?.vault?.name || 'My Vault';
  const initial = vaultName.charAt(0).toUpperCase();

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
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'var(--accent-gradient)',
              fontSize: '10px',
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
            <div style={{ fontSize: '10px', color: 'var(--text-ghost)' }}>
              {noteCount} notes · {folderCount} folders
            </div>
          </div>
        </div>

        <SearchBar />

        {/* Action buttons */}
        <div className="flex" style={{ gap: '4px' }}>
          <SidebarActionButton primary onClick={() => {}}>
            ✚ Note
          </SidebarActionButton>
          <SidebarActionButton onClick={() => {}}>📁 Folder</SidebarActionButton>
        </div>
      </div>

      {/* Tag filter chips */}
      <TagsPanel />

      {/* File tree */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '4px 0' }}>
        <FileTree />
      </div>

      {/* Sidebar footer */}
      <div
        className="flex shrink-0"
        style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--border)',
          gap: '4px',
        }}
      >
        <FooterButton
          icon={<Settings size={12} />}
          label="Settings"
          onClick={() => useSettingsUiStore.getState().open('general')}
        />
        <FooterButton icon={<Trash2 size={12} />} label="Trash" />
        <FooterButton icon={<LayoutList size={12} />} label="Review" onClick={openReview} />
        <FooterButton icon={<HelpCircle size={12} />} label="Help" onClick={() => useHelpUiStore.getState().open()} />
      </div>
      <ReviewSession />
    </>
  );

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
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border)',
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
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
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
  primary,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        flex: 1,
        gap: '4px',
        padding: '5px 0',
        borderRadius: '7px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        border: primary ? '1px solid transparent' : '1px solid var(--border)',
        backgroundColor: primary ? 'var(--accent-dim)' : 'var(--bg-card)',
        color: primary ? 'var(--accent)' : 'var(--text-secondary)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = primary ? 'var(--accent-muted)' : 'var(--bg-hover)';
        if (!primary) e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = primary ? 'var(--accent-dim)' : 'var(--bg-card)';
        e.currentTarget.style.color = primary ? 'var(--accent)' : 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
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
        padding: '5px 0',
        borderRadius: '6px',
        fontSize: '10px',
        color: 'var(--text-ghost)',
        cursor: 'pointer',
        border: 'none',
        backgroundColor: 'transparent',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = 'var(--text-ghost)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
