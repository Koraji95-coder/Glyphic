import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
        console.error('Failed to load backlinks:', error);
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
    <div style={{ padding: '4px 10px 6px' }}>
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center w-full"
        style={{
          gap: '4px',
          padding: '4px 4px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-ghost)',
        }}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span>Backlinks</span>
        {backlinks.length > 0 && (
          <span style={{ marginLeft: 'auto', color: 'var(--text-ghost)' }}>{backlinks.length}</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col" style={{ gap: '4px', padding: '4px 4px 0' }}>
          {isLoading ? (
            <span style={{ fontSize: '10px', color: 'var(--text-ghost)', padding: '2px 4px' }}>Loading...</span>
          ) : backlinks.length === 0 ? (
            <span style={{ fontSize: '10px', color: 'var(--text-ghost)', padding: '2px 4px' }}>No backlinks yet</span>
          ) : (
            backlinks.map((backlink) => (
              <button
                type="button"
                key={`${backlink.source_id}:${backlink.source_path}:${backlink.context}`}
                onClick={() => setActiveNote(backlink.source_path, backlink.source_path)}
                className="flex items-start"
                style={{
                  gap: '6px',
                  width: '100%',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.12s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <Link2 size={10} style={{ marginTop: '1px', flexShrink: 0 }} />
                <span className="flex flex-col" style={{ minWidth: 0, gap: '1px' }}>
                  <span className="truncate" style={{ fontSize: '11px', fontWeight: 600 }}>
                    {backlink.source_title}
                  </span>
                  <span className="truncate" style={{ fontSize: '10px', color: 'var(--text-ghost)' }}>
                    {backlink.context}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
