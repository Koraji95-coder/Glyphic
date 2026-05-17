// StatusBar -- thin bottom info bar.
//
// Restyled for Phase 2 of the deep-dive UI rewrite. Same statuses (save
// state, word count, read time, cursor position, lecture timer, version)
// but flatter -- no rounded-2xl pills, just slim mono labels separated
// by a vertical divider character, matching deep-dive's "engineering-feel"
// status bars.

import { useIsMobile } from '../../hooks/useIsMobile';
import { useLectureMode } from '../../hooks/useLectureMode';
import { cn } from '../../lib/cn';
import { useEditorStore } from '../../stores/editorStore';

export function StatusBar() {
  const wordCount = useEditorStore((s) => s.wordCount);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const cursorPosition = useEditorStore((s) => s.cursorPosition);
  const { lectureModeActive, getElapsedTime } = useLectureMode();
  const isMobile = useIsMobile();

  const saveLabel = isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved';
  const dotColor = isSaving
    ? 'bg-amber-400'
    : isDirty
      ? 'bg-red-400'
      : 'bg-emerald-400';

  const readTime = Math.max(1, Math.ceil(wordCount / 238));

  return (
    <div
      className={cn(
        'flex h-7 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4',
        'font-mono text-[11px] text-zinc-500',
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} aria-hidden />
          <span className="text-zinc-400">{saveLabel}</span>
        </span>

        <span className="text-zinc-700" aria-hidden>·</span>
        <span>{wordCount} words</span>

        {!isMobile && (
          <>
            <span className="text-zinc-700" aria-hidden>·</span>
            <span>~{readTime} min read</span>

            {cursorPosition && (
              <>
                <span className="text-zinc-700" aria-hidden>·</span>
                <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
              </>
            )}
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {lectureModeActive && (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            <span>Lecture {getElapsedTime()}</span>
          </span>
        )}

        {!isMobile && (
          <span className="text-zinc-600">Glyphic v1.0</span>
        )}
      </div>
    </div>
  );
}