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
import { usePromptModalStore } from '../../stores/promptModalStore';
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
  const setSelectedFolderPath = useVaultStore((s) => s.setSelectedFolderPath);
  const pinnedNotes = useVaultStore((s) => s.pinnedNotes);
  const pinNote = useVaultStore((s) => s.pinNote);
  const unpinNote = useVaultStore((s) => s.unpinNote);

  const { openPrompt } = usePromptModalStore();
  const { createNote, deleteNote, deleteFolder } = useVault();

  const isFolder = entry.entry_type === 'folder';
  const isActive = !isFolder && activeNotePath === entry.path;
  const isPinned = !isFolder && pinnedNotes.includes(entry.path);
  const title = entry.name.replace(/\.md$/, '');

  const totalChildren = entry.children?.length ?? 0;
  const visibleChildren = entry.children?.slice(0, visibleChildrenCount) ?? [];
  const remainingChildren = Math.max(0, totalChildren - visibleChildren.length);

  const handleClick = useCallback(() => {
    if (isFolder) {
      setSelectedFolderPath(entry.path);
      setExpanded((prev) => !prev);
    } else {
      const parentFolder = entry.path.split('/').slice(0, -1).join('/');
      setSelectedFolderPath(parentFolder);
      setActiveNote(entry.path, entry.path);
    }
  }, [isFolder, entry.path, setActiveNote, setSelectedFolderPath]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Close context menu when clicking outside
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

  // Reset incremental loading when collapsing/expanding
  useEffect(() => {
    if (!isFolder) return;
    setVisibleChildrenCount(INITIAL_CHILDREN_BATCH);
  }, [expanded, isFolder]);

  const handleNewNote = () => {
    setCtxMenu(null);
    const folder = isFolder ? entry.path : entry.path.split('/').slice(0, -1).join('/');
    openPrompt({
      title: 'New Note',
      placeholder: 'Note name',
      onConfirm: async (result) => {
        const name = typeof result === 'string' ? result.trim() : '';
        if (!name) return;
        try {
          const note = await createNote(folder, name);
          if (note) setActiveNote(note.id, note.path);
        } catch (e) {
          reportError({ context: 'File tree create note', message: 'Failed to create note', error: e });
        }
      },
    });
  };

  const handleNewFolder = () => {
    setCtxMenu(null);
    openPrompt({
      title: 'New Folder',
      placeholder: 'Folder name',
      onConfirm: async (result) => {
        const name = typeof result === 'string' ? result.trim() : '';
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!name || !vaultPath) return;
        try {
          const folder = isFolder ? entry.path : entry.path.split('/').slice(0, -1).join('/');
          const relativePath = folder ? `${folder}/${name}` : name;
          await commands.createFolder(vaultPath, relativePath);
          await useVaultStore.getState().refreshFileTree();
        } catch (e) {
          reportError({ context: 'File tree create folder', message: 'Failed to create folder', error: e });
        }
      },
    });
  };

  const handleRename = () => {
    setCtxMenu(null);
    openPrompt({
      title: 'Rename',
      defaultValue: title,
      onConfirm: async (result) => {
        const newName = typeof result === 'string' ? result.trim() : '';
        if (!newName || newName === title) return;
        try {
          const vaultPath = useVaultStore.getState().vaultPath;
          if (vaultPath) {
            await commands.renameNote(vaultPath, entry.path, newName);
            await useVaultStore.getState().refreshFileTree();
          }
        } catch (e) {
          reportError({ context: 'File tree rename', message: 'Failed to rename', error: e });
        }
      },
    });
  };

  const handleDelete = () => {
    setCtxMenu(null);
    openPrompt({
      title: `Delete "${title}"?`,
      isConfirm: true,
      confirmLabel: 'Delete',
      onConfirm: async (result) => {
        if (result !== true) return;
        try {
          if (isFolder) {
            await deleteFolder(entry.path);
          } else {
            await deleteNote(entry.path);
          }
        } catch (e) {
          reportError({ context: 'File tree delete', message: 'Failed to delete', error: e });
        }
      },
    });
  };

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`flex items-center gap-1 py-1 px-2 rounded-xl cursor-pointer text-sm select-none group transition-all ${
          isActive ? 'bg-violet-500/10 text-white' : 'hover:bg-zinc-800/70 text-zinc-300'
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {/* Chevron / Spacer */}
        {isFolder ? (
          <span className="shrink-0 text-zinc-400 group-hover:text-zinc-200">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        <span className="shrink-0">
          {isFolder
            ? expanded
              ? <FolderOpen size={16} className="text-amber-300" />
              : <Folder size={16} className="text-amber-300" />
            : <File size={16} className={isActive ? 'text-violet-300' : 'text-zinc-400'} />}
        </span>

        {/* Name */}
        <span className="truncate flex-1">{title}</span>

        {/* Pin indicator */}
        {!isFolder && isPinned && (
          <Pin size={13} className="text-violet-400 shrink-0" />
        )}
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
              className="ml-[calc((depth+1)*16px+12px)] mt-1 text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1 rounded-2xl hover:bg-zinc-800 transition-colors"
            >
              Show {Math.min(CHILDREN_BATCH_STEP, remainingChildren)} more ({remainingChildren} remaining)
            </button>
          )}
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 py-1 min-w-[180px] bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl backdrop-blur-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
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
            </>
          )}
          <CtxItem icon={Trash2} label="Delete" onClick={handleDelete} danger />
        </div>
      )}
    </>
  );
}

function CtxItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-zinc-800 rounded-3xl mx-1 ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-200'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}