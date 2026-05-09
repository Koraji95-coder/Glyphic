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

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is a prop that causes refetches when changed
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
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%), var(--bg-editor)',
      }}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center"
          style={{
            gap: '2px',
            padding: '3px 9px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--accent)',
            background: 'linear-gradient(135deg, rgba(163,116,247,0.16), rgba(244,114,182,0.08))',
            border: '1px solid rgba(163,116,247,0.2)',
            boxShadow: '0 10px 24px rgba(163,116,247,0.12)',
          }}
        >
          <Hash size={11} />
          {t}
        </span>
      ))}
    </div>
  );
}
