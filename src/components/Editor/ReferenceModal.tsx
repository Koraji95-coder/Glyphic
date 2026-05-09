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

  const focusPrimaryInput = useCallback(() => {
    setTimeout(() => primaryInputRef.current?.focus(), 50);
  }, []);

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
    if (!query.trim()) return allNotes.slice(0, 20);
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, allNotes]);

  useEffect(() => {
    focusPrimaryInput();
  }, [focusPrimaryInput]);

  useEffect(() => {
    if (!listRef.current || referenceMode !== 'backlink') return;
    const items = listRef.current.querySelectorAll<HTMLButtonElement>('button[role="option"]');
    const item = items[selectedIndex];
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, referenceMode]);

  const trapFocus = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !modalRef.current) return;

    const focusables = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
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
      reportError({
        context: 'Insert reference',
        message: 'Unable to insert link. Try reopening the editor.',
        error,
      });
    }
  };

  const insertBacklink = (title: string) => {
    try {
      onInsertBacklink(title);
      closeReferenceModal();
    } catch (error) {
      reportError({
        context: 'Insert reference',
        message: 'Unable to insert backlink. Try reopening the editor.',
        error,
      });
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

  const activeTint = referenceMode === 'link' ? '#3b82f6' : '#8b5cf6';

  return (
    <div
      onClick={closeReferenceModal}
      onKeyDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Insert reference"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="document"
        style={{
          width: 'min(460px, 92vw)',
          maxHeight: '76vh',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid color-mix(in oklab, var(--border) 75%, ${activeTint} 25%)`,
            background: `color-mix(in oklab, var(--bg-sidebar) 86%, ${activeTint} 14%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={14} style={{ color: 'var(--text-primary)' }} />
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Insert Reference
            </h2>
          </div>
          <button
            type="button"
            onClick={closeReferenceModal}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
          {(['link', 'backlink'] as ReferenceMode[]).map((mode) => {
            const active = referenceMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                aria-pressed={active}
                style={{
                  padding: '5px 10px',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  backgroundColor: active ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {mode === 'link' ? 'External Link' : 'Vault Backlink'}
              </button>
            );
          })}
        </div>

        {referenceMode === 'link' ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                htmlFor="reference-url-input"
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}
              >
                URL *
              </label>
              <input
                id="reference-url-input"
                ref={primaryInputRef}
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  padding: '6px 10px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                htmlFor="reference-text-input"
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}
              >
                Link text (optional)
              </label>
              <input
                id="reference-text-input"
                type="text"
                placeholder="Leave empty to use URL"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  padding: '6px 10px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={closeReferenceModal}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertLink}
                disabled={!url.trim()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--accent)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: url.trim() ? 'pointer' : 'not-allowed',
                  opacity: url.trim() ? 1 : 0.5,
                }}
              >
                Insert
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  paddingLeft: '8px',
                  gap: '6px',
                }}
              >
                <Search size={14} style={{ color: 'var(--text-ghost)' }} />
                <input
                  ref={primaryInputRef}
                  type="text"
                  placeholder="Search notes..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    padding: '6px 8px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(76vh - 140px)' }}>
              {results.length === 0 ? (
                <div
                  style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '13px' }}
                >
                  <div style={{ marginBottom: '10px' }}>No notes found</div>
                  <button
                    type="button"
                    onClick={() => onModeChange('link')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Insert External Link Instead
                  </button>
                </div>
              ) : (
                <div role="listbox" aria-label="Backlink search results">
                  {results.map((note, idx) => (
                    <button
                      key={note.path}
                      type="button"
                      role="option"
                      aria-selected={idx === selectedIndex}
                      onClick={() => insertBacklink(note.title)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: idx === selectedIndex ? 'var(--accent-dim)' : 'transparent',
                        color: idx === selectedIndex ? 'var(--accent)' : 'var(--text-primary)',
                        fontSize: '13px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s',
                      }}
                    >
                      {note.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            color: 'var(--text-ghost)',
            fontSize: '11px',
          }}
        >
          {referenceMode === 'link'
            ? 'Enter to insert, Esc to close.'
            : 'Arrow keys to move, Enter to insert, Esc to close.'}
        </div>
      </div>
    </div>
  );
}
