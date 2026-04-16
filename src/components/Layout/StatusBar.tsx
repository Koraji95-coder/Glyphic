import { useIsMobile } from '../../hooks/useIsMobile';
import { useLectureMode } from '../../hooks/useLectureMode';
import { useEditorStore } from '../../stores/editorStore';

export function StatusBar() {
  const wordCount = useEditorStore((s) => s.wordCount);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const { lectureModeActive, getElapsedTime } = useLectureMode();
  const isMobile = useIsMobile();

  const saveLabel = isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved';
  const dotColor = isSaving ? 'var(--warning)' : isDirty ? 'var(--error)' : 'var(--green)';

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        height: isMobile ? '38px' : 'var(--statusbar-height)',
        backgroundColor: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border)',
        paddingLeft: '16px',
        paddingRight: '16px',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Save status */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor, display: 'inline-block' }} />
          <span>{saveLabel}</span>
        </div>
        <span style={{ color: 'var(--text-ghost)' }}>|</span>
        <span>{wordCount} words</span>
      </div>

      <div className="flex items-center gap-3">
        {lectureModeActive && <span style={{ color: 'var(--green)' }}>● Lecture — {getElapsedTime()}</span>}
      </div>
    </div>
  );
}
