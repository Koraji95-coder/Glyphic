import { Search, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useSearch } from '../../hooks/useSearch';
import { useVaultStore } from '../../stores/vaultStore';

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, results, isSearching, handleQueryChange, clearSearch } = useSearch();
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleOpenResult = useCallback(
    (id: string, path: string) => {
      setActiveNote(id, path);
      clearSearch();
      setSelectedIndex(-1);
      inputRef.current?.blur();
    },
    [setActiveNote, clearSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!query || results.length === 0) return;

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
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleOpenResult(results[selectedIndex].id, results[selectedIndex].path);
          }
          break;
        case 'Escape':
          e.preventDefault();
          clearSearch();
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [query, results, selectedIndex, clearSearch, handleOpenResult],
  );

  return (
    <div className="relative px-3 pt-3 pb-2">
      {/* Input container */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
        }}
      >
        <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search notes..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              clearSearch();
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            className="shrink-0 p-0.5 rounded transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {query && (
        <div
          className="absolute left-3 right-3 mt-1 rounded-md max-h-72 overflow-y-auto z-40"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {isSearching ? (
            <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
              No results found
            </div>
          ) : (
            results.map((result, i) => {
              const folder = result.path.split('/').slice(0, -1).join('/');
              return (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => handleOpenResult(result.id, result.path)}
                  className="flex flex-col w-full px-3 py-2 text-left transition-colors"
                  style={{
                    backgroundColor: i === selectedIndex ? 'var(--accent-muted)' : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {result.title}
                  </span>
                  {result.snippet && (
                    <span
                      className="text-xs truncate mt-0.5 search-snippet"
                      style={{ color: 'var(--text-tertiary)' }}
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: FTS5 snippets contain <mark> highlights; sanitizeSnippet strips all other tags
                      dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }}
                    />
                  )}
                  {folder && (
                    <span className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {folder}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sanitize FTS5 snippet HTML — only allow <mark> tags for highlighting.
 * Strips all other HTML tags to prevent XSS, and escapes raw ampersands
 * that are not already part of valid HTML entities.
 */
function sanitizeSnippet(html: string): string {
  // Strip all tags except <mark> and </mark>
  const stripped = html.replace(/<(?!\/?mark\b)[^>]*>/gi, '');
  // Escape ampersands that aren't part of valid HTML entities (named or numeric)
  return stripped.replace(/&(?!(?:amp|lt|gt|quot|#\d{1,5}|#x[\da-fA-F]{1,4}|[a-zA-Z]{2,8});)/g, '&amp;');
}
