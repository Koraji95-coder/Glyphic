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
  const dotColor = isSaving ? 'var(--warning)' : isDirty ? 'var(--error)' : 'var(--green)';

  // Estimate reading time (~238 wpm average)
  const readTime = Math.max(1, Math.ceil(wordCount / 238));

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        height: isMobile ? '34px' : 'var(--statusbar-height)',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), var(--glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--glass-border)',
        paddingLeft: '14px',
        paddingRight: '14px',
        fontSize: '10px',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div className="flex items-center" style={{ gap: '8px' }}>
        <StatusPill>
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
          {saveLabel}
        </StatusPill>
        <StatusPill>{wordCount} words</StatusPill>
        {!isMobile && (
          <>
            <StatusPill>~{readTime} min read</StatusPill>
            {cursorPosition && (
              <StatusPill>
                Ln {cursorPosition.line}, Col {cursorPosition.col}
              </StatusPill>
            )}
          </>
        )}
      </div>

      <div className="flex items-center" style={{ gap: '8px' }}>
        {lectureModeActive && (
          <StatusPill style={{ color: 'var(--green)' }}>● Lecture {getElapsedTime()}</StatusPill>
        )}
        {!isMobile && <StatusPill>Glyphic v1.0</StatusPill>}
      </div>
    </div>
  );
}

function StatusPill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        borderRadius: '999px',
        border: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.03)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
