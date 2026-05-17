import { FileText, FolderOpen, HelpCircle, LayoutList, PinOff, Plus, Settings, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/cn';
import { useVault } from '../../hooks/useVault';
import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { useFlashcardReviewStore } from '../../stores/flashcardReviewStore';
import { useHelpUiStore } from '../../stores/helpUiStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { usePromptModalStore } from '../../stores/promptModalStore';
import { useSettingsUiStore } from '../../stores/settingsUiStore';
import { useVaultStore } from '../../stores/vaultStore';

import { ReviewSession } from '../Flashcards/ReviewSession';
import { BacklinksPanel } from './BacklinksPanel';
import { FileTree } from './FileTree';
import { SearchBar } from './SearchBar';
import { TagsPanel } from './TagsPanel';

export function Sidebar() {
  const [width, setWidth] = useState(288);
  const isResizing = useRef(false);
  const isMobile = useIsMobile();

  const { isSidebarOpen, closeSidebar, isFocusMode } = useLayoutStore();
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

  const { noteCount, folderCount } = countEntries(fileTree);
  const vaultName = vaultConfig?.vault?.name || 'My Vault';
  const initial = vaultName.charAt(0).toUpperCase();

  const handleNewNote = useCallback(async (name?: string) => {
    if (name) {
      try {
        await createNote(selectedFolderPath, name);
      } catch (e) {
        reportError({ context: 'Sidebar create note', message: 'Failed to create note', error: e });
      }
      return;
    }

    openPrompt({
      title: 'New Note',
      placeholder: 'Note name',
      onConfirm: async (result) => {
        const noteName = typeof result === 'string' ? result.trim() : '';
        if (!noteName) return;
        try {
          await createNote(selectedFolderPath, noteName);
        } catch (e) {
          reportError({ context: 'Sidebar create note', message: 'Failed to create note', error: e });
        }
      },
    });
  }, [createNote, openPrompt, selectedFolderPath]);

  const handleNewFolder = useCallback(() => {
    openPrompt({
      title: 'New Folder',
      placeholder: 'Folder name',
      onConfirm: async (result) => {
        const folderName = typeof result === 'string' ? result.trim() : '';
        if (!folderName || !vaultPath) return;
        try {
          const base = selectedFolderPath ? `${selectedFolderPath}/${folderName}` : folderName;
          await commands.createFolder(vaultPath, base);
          await refreshFileTree();
        } catch (e) {
          reportError({ context: 'Sidebar create folder', message: 'Failed to create folder', error: e });
        }
      },
    });
  }, [vaultPath, refreshFileTree, openPrompt, selectedFolderPath]);

  const handleTrash = useCallback(() => {
    // TODO: Implement trash functionality later
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Resize logic
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(220, Math.min(420, e.clientX));
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
      {/* Vault header -- monospace wordmark + small emerald presence dot */}
      <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 font-mono text-sm font-semibold text-zinc-100">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tracking-tight text-zinc-100">
            {vaultName}
          </div>
          <div className="font-mono text-[10px] text-zinc-500">
            {noteCount} notes · {folderCount} folders
          </div>
        </div>
      </div>

      <SearchBar />

      {/* Quick actions -- primary new-note in accent blue, secondary in zinc */}
      <div className="px-3 py-3">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Quick actions
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => handleNewNote()}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-500 px-3 text-xs font-medium text-white transition-colors hover:bg-blue-400"
          >
            <Plus size={13} />
            New note
          </button>
          <button
            type="button"
            onClick={handleNewFolder}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-800 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <FolderOpen size={13} />
            Folder
          </button>
        </div>
      </div>

      {/* Pinned -- amber layer dot + flatter rows */}
      {pinnedNotes.length > 0 && (
        <div className="px-3 pb-3">
          <div className="mb-1 flex items-center gap-1.5 px-2 pb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Pinned
            </span>
          </div>
          {pinnedNotes.map((path) => {
            const name = path.replace(/\.md$/, '').split('/').pop() || path;
            return (
              <div
                key={path}
                onClick={() => setActiveNote(path, path)}
                className="group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors hover:bg-zinc-800/60"
              >
                <FileText size={13} className="text-zinc-500" />
                <span className="flex-1 truncate text-sm text-zinc-300">{name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    unpinNote(path);
                  }}
                  className="text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  aria-label={"Unpin ${name}"}
                >
                  <PinOff size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <TagsPanel />
      <BacklinksPanel />

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        <FileTree />
      </div>

      {/* Footer actions -- 2x2 grid of slim icon-label buttons */}
      <div className="grid grid-cols-2 gap-1 border-t border-zinc-800 bg-zinc-950 p-2">
        {[
          { label: 'Settings', icon: Settings, onClick: () => useSettingsUiStore.getState().open('general') },
          { label: 'Trash', icon: Trash2, onClick: handleTrash },
          { label: 'Help', icon: HelpCircle, onClick: () => useHelpUiStore.getState().open() },
          { label: 'Review', icon: LayoutList, onClick: openReview },
        ].map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <ReviewSession />
    </>
  );

  if (!isMobile && isFocusMode) return null;

  if (isMobile) {
    return (
      <>
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40" onClick={closeSidebar} />
        )}
        <aside
          className="fixed top-0 bottom-0 left-0 w-72 z-50 flex flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-300"
          style={{ transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className="relative flex h-full flex-col border-r border-zinc-800 bg-zinc-950"
      style={{ width: `${width}px` }}
    >
      {sidebarContent}

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-blue-500/30"
      />
    </aside>
  );
}

/** Count notes and folders recursively */
function countEntries(entries: any[]): { noteCount: number; folderCount: number } {
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