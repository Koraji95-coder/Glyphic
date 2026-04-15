import { useState, useCallback } from 'react';
import { commands } from '../lib/tauri/commands';
import { SearchResult } from '../types/editor';
import { debounce } from '../lib/utils/debounce';

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await commands.searchAll(q);
        setResults(res);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300) as (q: string) => void,
    []
  );

  const handleQueryChange = (q: string) => {
    setQuery(q);
    search(q);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  return { query, results, isSearching, handleQueryChange, clearSearch };
}
