import { FileText, FolderOpen, HelpCircle, LayoutList, PinOff, Plus, Settings, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsMobile } from '../../hooks/useIsMobile';
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
      {/* Vault Header */}
      <div className="px-5 py-6 border-b border-zinc-800 bg-zinc-900/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-linear-to-br from-violet-500 via-fuchsia-500 to-cyan-400 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-inner">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-lg tracking-tight truncate text-white">{vaultName}</div>
            <div className="text-xs text-zinc-400">
              {noteCount} notes • {folderCount} folders
            </div>
          </div>
        </div>
      </div>

      <SearchBar />

      {/* Quick Actions */}
      <div className="px-4 py-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3 px-2">Quick Actions</div>
        <div className="flex gap-2">
          <button
            onClick={() => handleNewNote()}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors text-white font-medium py-3 px-4 rounded-2xl text-sm shadow-inner"
          >
            <Plus size={16} />
            New Note
          </button>
          <button
            onClick={handleNewFolder}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 transition-colors font-medium py-3 px-4 rounded-2xl text-sm text-zinc-200"
          >
            <FolderOpen size={16} />
            Folder
          </button>
        </div>
      </div>

      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2 px-2">Pinned</div>
          {pinnedNotes.map((path) => {
            const name = path.replace(/\.md$/, '').split('/').pop() || path;
            return (
              <div
                key={path}
                onClick={() => setActiveNote(path, path)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded-xl cursor-pointer group"
              >
                <FileText size={15} className="text-zinc-400" />
                <span className="flex-1 truncate text-sm text-white">{name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unpinNote(path);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400 transition-all"
                >
                  <PinOff size={14} />
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

      {/* Footer Actions */}
      <div className="border-t border-zinc-800 p-3 grid grid-cols-2 gap-2 bg-zinc-900/70 backdrop-blur-xl">
        <button
          onClick={() => useSettingsUiStore.getState().open('general')}
          className="flex items-center justify-center gap-2 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl transition-all text-sm"
        >
          <Settings size={16} />
          Settings
        </button>
        <button
          onClick={handleTrash}
          className="flex items-center justify-center gap-2 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl transition-all text-sm"
        >
          <Trash2 size={16} />
          Trash
        </button>
        <button
          onClick={() => useHelpUiStore.getState().open()}
          className="flex items-center justify-center gap-2 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl transition-all text-sm"
        >
          <HelpCircle size={16} />
          Help
        </button>
        <button
          onClick={openReview}
          className="flex items-center justify-center gap-2 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl transition-all text-sm"
        >
          <LayoutList size={16} />
          Review
        </button>
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
          className="fixed top-0 bottom-0 left-0 w-72 bg-[#050507] border-r border-zinc-800 z-50 flex flex-col transition-transform duration-300"
          style={{ transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className="flex flex-col h-full relative border-r border-zinc-800 bg-[#050507]"
      style={{ width: `${width}px` }}
    >
      {sidebarContent}

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-violet-500/30 transition-colors z-10"
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