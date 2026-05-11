import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useVault } from '../../hooks/useVault';
import { reportError } from '../../lib/errorReporter';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultEntry } from '../../types/vault';

interface NoteOption {
  title: string;
  path: string;
  modified_at?: string;
}

function flattenEntries(entries: VaultEntry[]): NoteOption[] {
  const notes: NoteOption[] = [];
  for (const entry of entries) {
    if (entry.entry_type === 'file') {
      notes.push({
        title: entry.name.replace(/\.md$/, ''),
        path: entry.path,
        modified_at: entry.modified_at,
      });
    }
    if (entry.children) {
      notes.push(...flattenEntries(entry.children));
    }
  }
  return notes;
}

export function QuickSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fileTree = useVaultStore((s) => s.fileTree);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const { createNote } = useVault();

  const allNotes = useMemo(() => flattenEntries(fileTree), [fileTree]);

  const fuse = useMemo(
    () =>
      new Fuse(allNotes, {
        keys: ['title'],
        threshold: 0.4,
      }),
    [allNotes]
  );

  const results = useMemo(() => {
    if (!query.trim()) return allNotes.slice(0, 15);
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, allNotes]);

  const canCreateNew = query.trim().length > 0 && results.length === 0;
  const totalItems = results.length + (canCreateNew ? 1 : 0);

  // Keyboard shortcut Ctrl/Cmd + P
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Custom event from TitleBar
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('glyphic:open-quick-switcher', handler);
    return () => window.removeEventListener('glyphic:open-quick-switcher', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (note: NoteOption) => {
      setActiveNote(note.path, note.path);
      setOpen(false);
    },
    [setActiveNote]
  );

  const handleCreateNew = useCallback(async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const note = await createNote('', name);
      if (note) setActiveNote(note.path, note.path);
    } catch (e) {
      reportError({ context: 'Quick switcher create note', message: 'Failed to create note', error: e });
    }
    setOpen(false);
  }, [query, createNote, setActiveNote]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (canCreateNew && selectedIndex === results.length) {
            void handleCreateNew();
          } else if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [results, selectedIndex, totalItems, canCreateNew, handleSelect, handleCreateNew]
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setOpen(false)} />

      <div className="fixed top-[18%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-700">
          <Search size={18} className="text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search notes or create new…"
            className="flex-1 bg-transparent text-base outline-none text-white placeholder-zinc-400"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-2">
          {results.length === 0 && !canCreateNew ? (
            <div className="px-6 py-8 text-sm text-zinc-400 text-center">No notes found</div>
          ) : (
            <>
              {results.map((note, i) => {
                const folder = note.path.split('/').slice(0, -1).join('/');
                return (
                  <button
                    key={note.path}
                    onClick={() => handleSelect(note)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full px-6 py-3 text-left flex items-center justify-between transition-colors ${
                      i === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                    }`}
                  >
                    <span className="font-medium text-white truncate">{note.title}</span>
                    {folder && <span className="text-xs text-zinc-500">{folder}</span>}
                  </button>
                );
              })}

              {canCreateNew && (
                <button
                  onClick={handleCreateNew}
                  onMouseEnter={() => setSelectedIndex(results.length)}
                  className={`w-full px-6 py-3 text-left flex items-center gap-3 transition-colors ${
                    selectedIndex === results.length ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="text-violet-400">✚</span>
                  <span className="text-violet-300">Create &quot;{query.trim()}&quot;</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-zinc-700 text-xs text-zinc-400 font-mono flex items-center justify-between">
          <span>
            ↑↓ navigate • Enter select • Esc close
          </span>
          <span>{results.length} results</span>
        </div>
      </div>
    </>
  );
}