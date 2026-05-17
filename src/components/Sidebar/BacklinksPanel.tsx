import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { useVaultStore } from '../../stores/vaultStore';
import type { Backlink } from '../../types/editor';

export function BacklinksPanel() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);

  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!activeNotePath) {
      setBacklinks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    commands
      .getBacklinks(activeNotePath)
      .then((results) => {
        if (cancelled) return;
        setBacklinks(results);
      })
      .catch((error) => {
        reportError({ context: 'Backlinks load', message: 'Failed to load backlinks', error });
        if (cancelled) return;
        setBacklinks([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeNotePath]);

  return (
    <div className="px-4 py-3 border-b border-zinc-800">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center w-full text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="ml-2">Backlinks</span>
        {backlinks.length > 0 && (
          <span className="ml-auto text-zinc-500">{backlinks.length}</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 mt-3">
          {isLoading ? (
            <div className="px-3 py-6 text-xs text-zinc-400 text-center">Loading backlinks...</div>
          ) : backlinks.length === 0 ? (
            <div className="px-3 py-6 text-xs text-zinc-400 text-center">No backlinks yet</div>
          ) : (
            backlinks.map((backlink) => (
              <button
                key={`${backlink.source_id}:${backlink.source_path}`}
                onClick={() => setActiveNote(backlink.source_path, backlink.source_path)}
                className="flex items-start gap-3 w-full px-4 py-3 text-left rounded-lg hover:bg-zinc-800/70 transition-all group"
              >
                <Link2 size={16} className="text-zinc-400 group-hover:text-cyan-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{backlink.source_title}</div>
                  {backlink.context && (
                    <div className="text-xs text-zinc-400 line-clamp-2 mt-1">{backlink.context}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}