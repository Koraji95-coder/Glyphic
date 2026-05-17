import { ChevronDown, ChevronRight, Hash, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTagsStore } from '../../stores/tagsStore';
import { useVaultStore } from '../../stores/vaultStore';

export function TagsPanel() {
  const { tags, selectedTag, isLoading, refreshTags, selectTag } = useTagsStore();
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!vaultPath) return;
    refreshTags();
  }, [refreshTags, vaultPath]);

  const handleClick = (name: string) => {
    if (selectedTag === name) {
      selectTag(null);
    } else {
      selectTag(name);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-zinc-800">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center w-full text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="ml-2">Tags</span>
        {tags.length > 0 && (
          <span className="ml-auto text-zinc-500">{tags.length}</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Clear filter pill */}
          {selectedTag && (
            <button
              type="button"
              onClick={() => selectTag(null)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-3xl text-zinc-300 transition-all"
              title="Clear filter"
            >
              <X size={12} />
              Clear
            </button>
          )}

          {tags.length === 0 && !isLoading && (
            <span className="text-xs text-zinc-500 px-3 py-1">No tags yet</span>
          )}

          {tags.map((tag) => {
            const isActive = selectedTag === tag.name;
            return (
              <button
                key={tag.name}
                type="button"
                onClick={() => handleClick(tag.name)}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-3xl border transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                }`}
                title={`${tag.count} note${tag.count === 1 ? '' : 's'}`}
              >
                <Hash size={13} />
                {tag.name}
                <span className="text-zinc-400 text-[10px]">{tag.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}