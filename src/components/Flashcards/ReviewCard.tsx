import type { Flashcard } from '../../types/ai';

interface ReviewCardProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
}

export function ReviewCard({ card, isFlipped, onFlip }: ReviewCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? 'Card answer — click to flip back' : 'Card question — click to reveal answer'}
      onClick={onFlip}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onFlip();
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '560px',
        minHeight: '220px',
        cursor: 'pointer',
        perspective: '1200px',
        outline: 'none',
      }}
    >
      {/* Inner container that flips */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '220px',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front (question) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 32px',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-ghost)',
            }}
          >
            Question
          </span>
          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              textAlign: 'center',
            }}
          >
            {card.question}
          </p>
          <span style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '8px' }}>
            Click or press Space to reveal
          </span>
        </div>

        {/* Back (answer) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--accent-dim)',
            border: '1px solid var(--accent-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 32px',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            Answer
          </span>
          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              textAlign: 'center',
            }}
          >
            {card.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
