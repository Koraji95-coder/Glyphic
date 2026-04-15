import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useSearch } from '../../hooks/useSearch';
import { useVaultStore } from '../../stores/vaultStore';

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, results, isSearching, handleQueryChange, clearSearch } = useSearch();
  const setActiveNote = useVaultStore((s) => s.setActiveNote);

  const handleOpenResult = (id: string, path: string) => {
    setActiveNote(id, path);
    clearSearch();
    inputRef.current?.blur();
  };

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
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search notes..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        {query && (
          <button
            onClick={() => {
              clearSearch();
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
            <div
              className="px-3 py-4 text-sm text-center"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div
              className="px-3 py-4 text-sm text-center"
              style={{ color: 'var(--text-tertiary)' }}
            >
              No results found
            </div>
          ) : (
            results.map((result) => {
              const folder = result.path.split('/').slice(0, -1).join('/');
              return (
                <button
                  key={result.id}
                  onClick={() => handleOpenResult(result.id, result.path)}
                  className="flex flex-col w-full px-3 py-2 text-left transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {result.title}
                  </span>
                  {result.snippet && (
                    <span
                      className="text-xs truncate mt-0.5"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {result.snippet}
                    </span>
                  )}
                  {folder && (
                    <span
                      className="text-xs truncate mt-0.5"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
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
