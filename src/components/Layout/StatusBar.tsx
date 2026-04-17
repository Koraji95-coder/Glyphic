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

  // Estimate reading time (~238 wpm average)
  const readTime = Math.max(1, Math.ceil(wordCount / 238));

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        height: isMobile ? '34px' : 'var(--statusbar-height)',
        backgroundColor: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border)',
        paddingLeft: '14px',
        paddingRight: '14px',
        fontSize: '10px',
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div className="flex items-center" style={{ gap: '8px' }}>
        {/* Save status */}
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span>{saveLabel}</span>
        <span style={{ color: 'var(--text-ghost)' }}>|</span>
        <span>{wordCount} words</span>
        {!isMobile && (
          <>
            <span style={{ color: 'var(--text-ghost)' }}>|</span>
            <span>~{readTime} min read</span>
          </>
        )}
      </div>

      <div className="flex items-center" style={{ gap: '8px' }}>
        {lectureModeActive && (
          <>
            <span style={{ color: 'var(--green)' }}>● Lecture {getElapsedTime()}</span>
            <span style={{ color: 'var(--text-ghost)' }}>|</span>
          </>
        )}
        {!isMobile && <span>Glyphic v1.0</span>}
      </div>
    </div>
  );
}
