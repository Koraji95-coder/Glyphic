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
    <div className="relative">
      {/* Input container */}
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded-md transition-all"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), rgba(255,255,255,0.04)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          transition: 'all 0.2s',
          cursor: 'text',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%), rgba(255,255,255,0.06)';
          e.currentTarget.style.borderColor = 'rgba(163,116,247,0.35)';
          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(163,116,247,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background =
            'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), rgba(255,255,255,0.04)';
          e.currentTarget.style.borderColor = 'var(--glass-border)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
        }}
      >
        <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          id="sidebar-search-input"
          name="sidebarSearch"
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search notes..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)', border: 'none', boxShadow: 'none' }}
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
            backgroundColor: 'rgba(14,11,26,0.88)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            padding: '4px',
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
                    background:
                      i === selectedIndex
                        ? 'linear-gradient(135deg, rgba(163,116,247,0.14), rgba(249,118,85,0.06))'
                        : 'transparent',
                    borderRadius: '10px',
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
