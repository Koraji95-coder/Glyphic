import { ChevronDown, ChevronRight, Hash, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTagsStore } from '../../stores/tagsStore';

export function TagsPanel() {
  const { tags, selectedTag, isLoading, refreshTags, selectTag } = useTagsStore();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  const handleClick = (name: string) => {
    if (selectedTag === name) {
      selectTag(null);
    } else {
      selectTag(name);
    }
  };

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
        <span>Tags</span>
        {tags.length > 0 && (
          <span style={{ marginLeft: 'auto', color: 'var(--text-ghost)' }}>{tags.length}</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-wrap" style={{ gap: '4px', padding: '4px 4px 0' }}>
          {selectedTag && (
            <button
              type="button"
              onClick={() => selectTag(null)}
              className="flex items-center"
              style={{
                gap: '3px',
                padding: '2px 6px',
                borderRadius: '999px',
                fontSize: '10px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-tertiary)',
              }}
              title="Clear filter"
            >
              <X size={10} />
              clear
            </button>
          )}
          {tags.length === 0 && !isLoading && (
            <span style={{ fontSize: '10px', color: 'var(--text-ghost)', padding: '2px 4px' }}>
              No tags yet
            </span>
          )}
          {tags.map((t) => {
            const active = selectedTag === t.name;
            return (
              <button
                type="button"
                key={t.name}
                onClick={() => handleClick(t.name)}
                className="flex items-center"
                style={{
                  gap: '2px',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: active ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
                title={`${t.count} note${t.count === 1 ? '' : 's'} tagged #${t.name}`}
              >
                <Hash size={10} />
                {t.name}
                <span style={{ color: 'var(--text-ghost)', marginLeft: '2px' }}>{t.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
