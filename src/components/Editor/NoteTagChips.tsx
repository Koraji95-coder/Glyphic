import { Hash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { commands } from '../../lib/tauri/commands';

interface NoteTagChipsProps {
  notePath: string | null;
  /** A monotonically-increasing token used to refetch tags after the note saves. */
  refreshKey?: number;
}

/** Read-only frontmatter tag chips rendered above the editor surface. */
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
    <div
      className="flex items-center flex-wrap shrink-0"
      style={{
        gap: '4px',
        padding: '4px 28px 6px',
        backgroundColor: 'var(--bg-editor)',
      }}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center"
          style={{
            gap: '2px',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--accent)',
            backgroundColor: 'var(--accent-dim)',
            border: '1px solid var(--border)',
          }}
        >
          <Hash size={11} />
          {t}
        </span>
      ))}
    </div>
  );
}
