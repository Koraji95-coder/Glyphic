import { useIsMobile } from '../../hooks/useIsMobile';
import { useLectureMode } from '../../hooks/useLectureMode';
import { useEditorStore } from '../../stores/editorStore';

export function StatusBar() {
  const wordCount = useEditorStore((s) => s.wordCount);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const cursorPosition = useEditorStore((s) => s.cursorPosition);
  const { lectureModeActive, getElapsedTime } = useLectureMode();
  const isMobile = useIsMobile();

  const saveLabel = isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved';
  const dotColor = isSaving ? 'bg-amber-400' : isDirty ? 'bg-red-400' : 'bg-emerald-400';

  const readTime = Math.max(1, Math.ceil(wordCount / 238));

  return (
    <div className="flex items-center justify-between shrink-0 h-9 bg-[#050507] border-t border-zinc-800 px-4 text-xs font-mono text-zinc-400">
      {/* Left side */}
      <div className="flex items-center gap-2">
        {/* Save status */}
        <div className="flex items-center gap-1.5 px-3 h-6 bg-zinc-900 border border-zinc-700 rounded-2xl">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span>{saveLabel}</span>
        </div>

        <div className="px-3 h-6 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center">
          {wordCount} words
        </div>

        {!isMobile && (
          <>
            <div className="px-3 h-6 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center">
              ~{readTime} min read
            </div>

            {cursorPosition && (
              <div className="px-3 h-6 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center">
                Ln {cursorPosition.line}, Col {cursorPosition.col}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {lectureModeActive && (
          <div className="flex items-center gap-1.5 px-3 h-6 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-2xl text-xs">
            <span className="text-xs">●</span>
            Lecture {getElapsedTime()}
          </div>
        )}

        {!isMobile && (
          <div className="px-3 h-6 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center text-zinc-400">
            Glyphic v1.0
          </div>
        )}
      </div>
    </div>
  );
}