import Fuse from 'fuse.js';
import { Link2, Search, X } from 'lucide-react';
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { reportError } from '../../lib/errorReporter';
import { useEditorActionStore } from '../../stores/editorActionStore';
import { type ReferenceMode, useEditorModalStore } from '../../stores/editorModalStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultEntry } from '../../types/vault';

interface NoteOption {
  title: string;
  path: string;
}

function flattenEntries(entries: VaultEntry[]): NoteOption[] {
  const notes: NoteOption[] = [];
  for (const entry of entries) {
    if (entry.entry_type === 'file') {
      notes.push({
        title: entry.name.replace(/\.md$/, ''),
        path: entry.path,
      });
    }
    if (entry.children) {
      notes.push(...flattenEntries(entry.children));
    }
  }
  return notes;
}

export function ReferenceModal() {
  const { referenceModalOpen, referenceMode, closeReferenceModal, setReferenceMode } = useEditorModalStore();
  const onInsertLink = useEditorActionStore((s) => s.onInsertLink);
  const onInsertBacklink = useEditorActionStore((s) => s.onInsertBacklink);

  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fileTree = useVaultStore((s) => s.fileTree);
  const allNotes = useMemo(() => flattenEntries(fileTree), [fileTree]);

  const fuse = useMemo(
    () =>
      new Fuse(allNotes, {
        keys: ['title'],
        threshold: 0.4,
        includeScore: true,
      }),
    [allNotes]
  );

  const results = useMemo(() => {
    if (!query.trim()) return allNotes.slice(0, 20);
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, allNotes]);

  const focusPrimaryInput = useCallback(() => {
    setTimeout(() => primaryInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (referenceModalOpen) focusPrimaryInput();
  }, [referenceModalOpen, focusPrimaryInput]);

  useEffect(() => {
    if (!listRef.current || referenceMode !== 'backlink') return;
    const items = listRef.current.querySelectorAll<HTMLButtonElement>('button[role="option"]');
    const item = items[selectedIndex];
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, referenceMode]);

  const trapFocus = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !modalRef.current) return;

    const focusables = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('hidden'));

    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  };

  const insertLink = () => {
    if (!url.trim()) return;
    try {
      onInsertLink(url.trim(), text.trim() || undefined);
      closeReferenceModal();
    } catch (error) {
      reportError({ context: 'Insert reference', message: 'Unable to insert link', error });
    }
  };

  const insertBacklink = (title: string) => {
    try {
      onInsertBacklink(title);
      closeReferenceModal();
    } catch (error) {
      reportError({ context: 'Insert reference', message: 'Unable to insert backlink', error });
    }
  };

  const onModeChange = (mode: ReferenceMode) => {
    setReferenceMode(mode);
    setQuery('');
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    trapFocus(e);

    if (e.key === 'Escape') {
      e.preventDefault();
      closeReferenceModal();
      return;
    }

    if (referenceMode === 'link') {
      if (e.key === 'Enter') {
        e.preventDefault();
        insertLink();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < results.length) insertBacklink(results[selectedIndex].title);
    }
  };

  if (!referenceModalOpen) return null;

  return (
    <div
      onClick={closeReferenceModal}
      className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Insert reference"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-[460px] mx-4 bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between bg-zinc-900">
          <div className="flex items-center gap-3">
            <Link2 className="text-blue-400" size={18} />
            <h2 className="text-lg font-semibold text-white">Insert Reference</h2>
          </div>
          <button
            onClick={closeReferenceModal}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 px-6 pt-4 pb-2 border-b border-zinc-700">
          {(['link', 'backlink'] as ReferenceMode[]).map((mode) => {
            const active = referenceMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {mode === 'link' ? 'External Link' : 'Vault Backlink'}
              </button>
            );
          })}
        </div>

        {/* Link mode */}
        {referenceMode === 'link' ? (
          <div className="p-6 space-y-6">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">URL</label>
              <input
                ref={primaryInputRef}
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-md px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Link text (optional)</label>
              <input
                type="text"
                placeholder="Leave empty to use URL"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-md px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeReferenceModal}
                className="px-6 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={insertLink}
                disabled={!url.trim()}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-300 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
              >
                Insert Link
              </button>
            </div>
          </div>
        ) : (
          /* Backlink mode */
          <>
            <div className="px-6 pt-4 pb-3 border-b border-zinc-700">
              <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg px-4">
                <Search size={16} className="text-zinc-400" />
                <input
                  ref={primaryInputRef}
                  type="text"
                  placeholder="Search notes..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  className="flex-1 bg-transparent border-none px-3 py-3 text-white outline-none text-sm"
                />
              </div>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto max-h-[380px]">
              {results.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-zinc-400 mb-4">No notes found</p>
                  <button
                    onClick={() => onModeChange('link')}
                    className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-sm"
                  >
                    Insert External Link Instead
                  </button>
                </div>
              ) : (
                <div role="listbox" className="divide-y divide-zinc-700">
                  {results.map((note, idx) => (
                    <button
                      key={note.path}
                      role="option"
                      aria-selected={idx === selectedIndex}
                      onClick={() => insertBacklink(note.title)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full px-6 py-4 text-left transition-colors ${
                        idx === selectedIndex ? 'bg-blue-500/10 text-blue-300' : 'hover:bg-zinc-800'
                      }`}
                    >
                      {note.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer hint */}
        <div className="px-6 py-3 text-xs text-zinc-400 border-t border-zinc-700 flex justify-between items-center">
          <span>
            {referenceMode === 'link'
              ? 'Enter to insert • Esc to close'
              : '↑↓ to navigate • Enter to insert • Esc to close'}
          </span>
        </div>
      </div>
    </div>
  );
}