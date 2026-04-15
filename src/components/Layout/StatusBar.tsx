import { useEditorStore } from '../../stores/editorStore';
import { useLectureMode } from '../../hooks/useLectureMode';

export function StatusBar() {
  const wordCount = useEditorStore((s) => s.wordCount);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const { lectureModeActive, getElapsedTime } = useLectureMode();

  const saveLabel = isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved';
  const dotColor = isSaving
    ? 'var(--warning)'
    : isDirty
      ? 'var(--error)'
      : 'var(--success)';

  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        height: '1.75rem',
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)',
      }}
    >
      {/* Word count */}
      <span>{wordCount} words</span>

      <div className="flex items-center gap-4">
        {/* Lecture timer */}
        {lectureModeActive && (
          <span
            className="flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {getElapsedTime()}
          </span>
        )}

        {/* Save status */}
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          {saveLabel}
        </span>
      </div>
    </div>
  );
}
