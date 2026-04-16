import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  const fileTree = useVaultStore((s) => s.fileTree);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);

  const allNotes = useMemo(() => flattenEntries(fileTree), [fileTree]);

  const fuse = useMemo(
    () =>
      new Fuse(allNotes, {
        keys: ['title'],
        threshold: 0.4,
        includeScore: true,
      }),
    [allNotes],
  );

  const results = useMemo(() => {
    if (!query.trim()) return allNotes.slice(0, 15);
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, allNotes]);

  // Keyboard shortcut to open (Ctrl+P / Cmd+P)
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

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback(
    (note: NoteOption) => {
      setActiveNote(note.path, note.path);
      setOpen(false);
    },
    [setActiveNote],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [results, selectedIndex, handleSelect],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div
        className="fixed z-50 top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg rounded-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search notes..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
              No notes found
            </div>
          ) : (
            results.map((note, i) => {
              const folder = note.path.split('/').slice(0, -1).join('/');
              const modifiedLabel = note.modified_at ? formatRelativeDate(note.modified_at) : '';
              return (
                <button
                  type="button"
                  key={note.path}
                  onClick={() => handleSelect(note)}
                  className="flex items-center justify-between w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{
                    backgroundColor: i === selectedIndex ? 'var(--accent-muted)' : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className="truncate font-medium">{note.title}</span>
                  <span className="flex items-center gap-2 ml-2 shrink-0">
                    {modifiedLabel && (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {modifiedLabel}
                      </span>
                    )}
                    {folder && (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {folder}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/** Format an ISO date string to a concise relative or short date label. */
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
  });
}
