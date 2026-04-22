import { ArrowLeft, BookOpen, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useFlashcardReviewStore } from '../../stores/flashcardReviewStore';
import { ReviewCard } from './ReviewCard';

export function ReviewSession() {
  const {
    cards,
    currentIndex,
    isFlipped,
    ratings,
    sessionComplete,
    isOpen,
    isLoading,
    error,
    close,
    loadCards,
    flipCard,
    rateCard,
    resetSession,
  } = useFlashcardReviewStore();

  const noteContent = useEditorStore((s) => s.content);
  const hasNote = noteContent.trim().length > 0;

  // Keyboard: Space/Enter to flip, 1=Again, 2=Good, 3=Easy, Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (sessionComplete || cards.length === 0) return;
      const current = cards[currentIndex];
      if (!current) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (!isFlipped) flipCard();
        return;
      }
      if (isFlipped) {
        if (e.key === '1') rateCard('again');
        else if (e.key === '2') rateCard('good');
        else if (e.key === '3') rateCard('easy');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, sessionComplete, cards, currentIndex, isFlipped, flipCard, rateCard, close]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const againCount = Object.values(ratings).filter((r) => r === 'again').length;
  const goodCount = Object.values(ratings).filter((r) => r === 'good').length;
  const easyCount = Object.values(ratings).filter((r) => r === 'easy').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Flashcard Review Session"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close review session"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ArrowLeft size={13} />
          Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Review Session</span>
        </div>

        {/* Progress pill */}
        {totalCards > 0 && !sessionComplete && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '3px 10px',
            }}
          >
            {currentIndex + 1} / {totalCards}
          </span>
        )}
        {(totalCards === 0 || sessionComplete) && <div style={{ width: '60px' }} />}
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          gap: '32px',
        }}
      >
        {/* Loading state */}
        {isLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ fontSize: '14px' }}>Generating flashcards…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(224,112,112,0.3)',
              backgroundColor: 'rgba(224,112,112,0.05)',
              maxWidth: '400px',
            }}
          >
            <p style={{ fontSize: '14px', color: 'var(--error)', marginBottom: '12px' }}>{error}</p>
            {hasNote && (
              <button type="button" onClick={() => loadCards(noteContent)} style={secondaryBtnStyle}>
                <RefreshCw size={12} />
                Try again
              </button>
            )}
          </div>
        )}

        {/* Empty state — no cards and not loading */}
        {!isLoading && !error && totalCards === 0 && (
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🃏</div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              No cards due
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {hasNote
                ? 'Generate flashcards from the current note to start reviewing.'
                : 'Open a note and generate flashcards from it first.'}
            </p>
            {hasNote && (
              <button type="button" onClick={() => loadCards(noteContent)} style={primaryBtnStyle}>
                <Sparkles size={13} />
                Generate flashcards
              </button>
            )}
          </div>
        )}

        {/* Session complete */}
        {!isLoading && !error && sessionComplete && (
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Session complete!
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              You reviewed {totalCards} card{totalCards !== 1 ? 's' : ''}.
            </p>

            {/* Summary */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                marginBottom: '28px',
              }}
            >
              <SummaryPill label="Again" count={againCount} color="var(--red)" />
              <SummaryPill label="Good" count={goodCount} color="var(--accent)" />
              <SummaryPill label="Easy" count={easyCount} color="var(--green)" />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={resetSession} style={primaryBtnStyle}>
                <RefreshCw size={13} />
                Review again
              </button>
              {hasNote && (
                <button type="button" onClick={() => loadCards(noteContent)} style={secondaryBtnStyle}>
                  <Sparkles size={13} />
                  Regenerate
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active card */}
        {!isLoading && !error && !sessionComplete && currentCard && (
          <>
            <ReviewCard card={currentCard} isFlipped={isFlipped} onFlip={flipCard} />

            {/* Rating buttons — only show after flip */}
            {isFlipped && (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <RatingButton label="Again" sublabel="1 min" color="var(--red)" onClick={() => rateCard('again')} />
                <RatingButton
                  label="Good"
                  sublabel="Next session"
                  color="var(--accent)"
                  onClick={() => rateCard('good')}
                />
                <RatingButton label="Easy" sublabel="Skip" color="var(--green)" onClick={() => rateCard('easy')} />
              </div>
            )}

            {!isFlipped && (
              <p style={{ fontSize: '12px', color: 'var(--text-ghost)' }}>
                Space / click to reveal · Esc to close
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function RatingButton({
  label,
  sublabel,
  color,
  onClick,
}: {
  label: string;
  sublabel: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        padding: '10px 22px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${color}44`,
        backgroundColor: `${color}11`,
        color,
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        minWidth: '90px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${color}22`)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${color}11`)}
    >
      {label}
      <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>{sublabel}</span>
    </button>
  );
}

function SummaryPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '10px 20px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '20px', fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 18px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid transparent',
  backgroundColor: 'var(--accent-dim)',
  color: 'var(--accent)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 18px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};
