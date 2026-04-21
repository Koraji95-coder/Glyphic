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
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVault } from '../../hooks/useVault';
import { commands } from '../../lib/tauri/commands';
import { useSplitStore } from '../../stores/splitStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultEntry } from '../../types/vault';

interface FileTreeItemProps {
  entry: VaultEntry;
  depth: number;
}

export function FileTreeItem({ entry, depth }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const { createNote, deleteNote } = useVault();

  const isFolder = entry.entry_type === 'folder';
  const isActive = !isFolder && activeNotePath === entry.path;
  const title = entry.name.replace(/\.md$/, '');

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
        console.error('Failed to create note:', e);
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
        console.error('Failed to create folder:', e);
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
        console.error('Failed to rename:', e);
      }
    }
  };

  const handleDelete = async () => {
    setCtxMenu(null);
    if (window.confirm(`Delete "${title}"?`)) {
      try {
        await deleteNote(entry.path);
      } catch (e) {
        console.error('Failed to delete:', e);
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
          backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isActive ? 'var(--accent-muted)' : 'transparent';
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
          {entry.children.map((child) => (
            <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
          ))}
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
