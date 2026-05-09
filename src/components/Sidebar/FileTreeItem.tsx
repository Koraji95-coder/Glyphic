import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  ChevronRight,
  Columns2,
  File,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVault } from '../../hooks/useVault';
import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { useSplitStore } from '../../stores/splitStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultEntry } from '../../types/vault';

interface FileTreeItemProps {
  entry: VaultEntry;
  depth: number;
}

const INITIAL_CHILDREN_BATCH = 150;
const CHILDREN_BATCH_STEP = 150;

export function FileTreeItem({ entry, depth }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(() => {
    if (depth !== 0) return false;
    const childCount = entry.children?.length ?? 0;
    return childCount > 0 && childCount <= 25;
  });
  const [visibleChildrenCount, setVisibleChildrenCount] = useState(INITIAL_CHILDREN_BATCH);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const pinnedNotes = useVaultStore((s) => s.pinnedNotes);
  const pinNote = useVaultStore((s) => s.pinNote);
  const unpinNote = useVaultStore((s) => s.unpinNote);
  const { createNote, deleteNote } = useVault();

  const isFolder = entry.entry_type === 'folder';
  const isActive = !isFolder && activeNotePath === entry.path;
  const isPinned = !isFolder && pinnedNotes.includes(entry.path);
  const title = entry.name.replace(/\.md$/, '');
  const totalChildren = entry.children?.length ?? 0;
  const visibleChildren = entry.children?.slice(0, visibleChildrenCount) ?? [];
  const remainingChildren = Math.max(0, totalChildren - visibleChildren.length);

  const handleClick = useCallback(() => {
    if (isFolder) {
      setExpanded((prev) => !prev);
    } else {
      setActiveNote(entry.path, entry.path);
    }
  }, [isFolder, entry.path, setActiveNote]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  // Reset incremental rendering window when collapsing/expanding or changing folders.
  useEffect(() => {
    if (!isFolder) return;
    if (!expanded) {
      setVisibleChildrenCount(INITIAL_CHILDREN_BATCH);
      return;
    }
    setVisibleChildrenCount(INITIAL_CHILDREN_BATCH);
  }, [expanded, isFolder]);

  const handleNewNote = async () => {
    setCtxMenu(null);
    const folder = isFolder ? entry.path : entry.path.split('/').slice(0, -1).join('/');
    const name = window.prompt('Note name:');
    if (name) {
      try {
        const note = await createNote(folder, name);
        if (note) {
          setActiveNote(note.id, note.path);
        }
      } catch (e) {
        reportError({ context: 'File tree create note', message: 'Failed to create note', error: e });
      }
    }
  };

  const handleNewFolder = async () => {
    setCtxMenu(null);
    // Folder creation handled at vault level
    const name = window.prompt('Folder name:');
    if (name) {
      try {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath) {
          const folder = isFolder ? entry.path : entry.path.split('/').slice(0, -1).join('/');
          const relativePath = folder ? `${folder}/${name}` : name;
          await commands.createFolder(vaultPath, relativePath);
          await useVaultStore.getState().refreshFileTree();
        }
      } catch (e) {
        reportError({ context: 'File tree create folder', message: 'Failed to create folder', error: e });
      }
    }
  };

  const handleRename = async () => {
    setCtxMenu(null);
    const newName = window.prompt('New name:', title);
    if (newName && newName !== title) {
      try {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath) {
          await commands.renameNote(vaultPath, entry.path, newName);
          await useVaultStore.getState().refreshFileTree();
        }
      } catch (e) {
        reportError({ context: 'File tree rename', message: 'Failed to rename', error: e });
      }
    }
  };

  const handleDelete = async () => {
    setCtxMenu(null);
    if (window.confirm(`Delete "${title}"?`)) {
      try {
        await deleteNote(entry.path);
      } catch (e) {
        reportError({ context: 'File tree delete', message: 'Failed to delete', error: e });
      }
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="flex items-center gap-1 py-0.5 px-2 rounded cursor-pointer text-sm select-none group"
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          backgroundColor: isActive ? 'rgba(163,116,247,0.18)' : 'transparent',
          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
          borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'background-color 0.12s, border-color 0.12s',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isActive ? 'rgba(163,116,247,0.18)' : 'transparent';
        }}
      >
        {/* Expand chevron or spacer */}
        {isFolder ? (
          <span className="shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        <span className="shrink-0" style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {isFolder ? expanded ? <FolderOpen size={15} /> : <Folder size={15} /> : <File size={15} />}
        </span>

        {/* Name */}
        <span className="truncate">{title}</span>
      </div>

      {/* Children */}
      {isFolder && expanded && entry.children && (
        <div>
          {visibleChildren.map((child) => (
            <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
          ))}
          {remainingChildren > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVisibleChildrenCount((prev) => Math.min(prev + CHILDREN_BATCH_STEP, totalChildren));
              }}
              style={{
                marginLeft: `${(depth + 1) * 16 + 8}px`,
                marginTop: '2px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-tertiary)',
                fontSize: '11px',
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              Show {Math.min(CHILDREN_BATCH_STEP, remainingChildren)} more ({remainingChildren} remaining)
            </button>
          )}
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 py-1 min-w-[160px] rounded"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <CtxItem icon={FilePlus} label="New Note" onClick={handleNewNote} />
          {isFolder && <CtxItem icon={FolderPlus} label="New Folder" onClick={handleNewFolder} />}
          {!isFolder && (
            <>
              <CtxItem
                icon={Columns2}
                label="Open in Split"
                onClick={() => {
                  setCtxMenu(null);
                  useSplitStore.getState().openSplit(entry.path, 'vertical');
                }}
              />
              <CtxItem
                icon={isPinned ? PinOff : Pin}
                label={isPinned ? 'Unpin note' : 'Pin note'}
                onClick={() => {
                  setCtxMenu(null);
                  if (isPinned) unpinNote(entry.path);
                  else pinNote(entry.path);
                }}
              />
              <CtxItem icon={Pencil} label="Rename" onClick={handleRename} />
              <CtxItem icon={Trash2} label="Delete" onClick={handleDelete} danger />
            </>
          )}
        </div>
      )}
    </>
  );
}

function CtxItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
      style={{ color: danger ? 'var(--error)' : 'var(--text-primary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
