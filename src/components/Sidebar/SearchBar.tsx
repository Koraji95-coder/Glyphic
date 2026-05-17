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
    [setActiveNote, clearSearch]
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
    [query, results, selectedIndex, clearSearch, handleOpenResult]
  );

  return (
    <div className="relative px-4 py-3 border-b border-zinc-800">
      {/* Search Input */}
      <div className="flex items-center gap-3 bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 backdrop-blur-xl rounded-3xl px-4 py-2 transition-all">
        <Search size={17} className="text-zinc-400" />
        <input
          ref={inputRef}
          id="sidebar-search-input"
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search notes..."
          className="flex-1 bg-transparent text-sm outline-none text-white placeholder-zinc-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              clearSearch();
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {query && (
        <div className="absolute left-4 right-4 mt-2 bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 rounded-3xl shadow-2xl z-50 max-h-72 overflow-y-auto py-2">
          {isSearching ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-400">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-400">No results found</div>
          ) : (
            results.map((result, i) => {
              const folder = result.path.split('/').slice(0, -1).join('/');
              return (
                <button
                  key={result.id}
                  onClick={() => handleOpenResult(result.id, result.path)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full px-6 py-3 text-left transition-all ${
                    i === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="text-sm font-medium text-white truncate">{result.title}</div>
                  {result.snippet && (
                    <div
                      className="text-xs text-zinc-400 mt-1 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }}
                    />
                  )}
                  {folder && <div className="text-xs text-zinc-500 mt-1">{folder}</div>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Sanitize FTS5 snippet HTML */
function sanitizeSnippet(html: string): string {
  const stripped = html.replace(/<(?!\/?mark\b)[^>]*>/gi, '');
  return stripped.replace(/&(?!(?:amp|lt|gt|quot|#\d{1,5}|#x[\da-fA-F]{1,4}|[a-zA-Z]{2,8});)/g, '&amp;');
}