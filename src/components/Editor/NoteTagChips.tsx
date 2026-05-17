import { Hash } from 'lucide-react';
import { useEffect, useState } from 'react';

import { commands } from '../../lib/tauri/commands';

interface NoteTagChipsProps {
  notePath: string | null;
  refreshKey?: number;
}

export function NoteTagChips({ notePath, refreshKey }: NoteTagChipsProps) {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!notePath) {
      setTags([]);
      return;
    }

    let cancelled = false;

    commands
      .tagsForNote(notePath)
      .then((t) => {
        if (!cancelled) setTags(t);
      })
      .catch(() => {
        if (!cancelled) setTags([]);
      });

    return () => {
      cancelled = true;
    };
  }, [notePath, refreshKey]);

  if (tags.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-2 px-8 py-3 bg-[#050507] border-b border-zinc-800">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-gradient-to-r from-violet-500/10 to-cyan-400/10 border border-violet-500/30 text-violet-300 rounded-3xl"
        >
          <Hash size={13} />
          {tag}
        </span>
      ))}
    </div>
  );
}