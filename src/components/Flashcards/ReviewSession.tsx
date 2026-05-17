import { ArrowLeft, BookOpen, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect } from 'react';

import { useEditorStore } from '../../stores/editorStore';
import { useFlashcardReviewStore } from '../../stores/flashcardReviewStore';
import { useVaultStore } from '../../stores/vaultStore';
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
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const hasNote = noteContent.trim().length > 0;

  // Keyboard shortcuts
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

      const target = e.target as HTMLElement;
      const isInteractive = target instanceof HTMLButtonElement || target instanceof HTMLInputElement;

      if (e.key === ' ') {
        if (isInteractive) return;
        e.preventDefault();
        if (!isFlipped) flipCard();
        return;
      }

      if (isFlipped) {
        if (e.key === '1') rateCard('again', activeNotePath ?? '');
        else if (e.key === '2') rateCard('good', activeNotePath ?? '');
        else if (e.key === '3') rateCard('easy', activeNotePath ?? '');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, sessionComplete, cards, currentIndex, isFlipped, flipCard, rateCard, close, activeNotePath]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;

  const againCount = Object.values(ratings).filter((r) => r === 'again').length;
  const goodCount = Object.values(ratings).filter((r) => r === 'good').length;
  const easyCount = Object.values(ratings).filter((r) => r === 'easy').length;

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 bg-zinc-900 shrink-0">
        <button
          onClick={close}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="flex items-center gap-3">
          <BookOpen className="text-blue-400" size={20} />
          <span className="font-semibold text-white">Review Session</span>
        </div>

        {totalCards > 0 && !sessionComplete && (
          <div className="px-4 py-1 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg">
            {currentIndex + 1} / {totalCards}
          </div>
        )}

        {(totalCards === 0 || sessionComplete) && (
          <div className="px-4 py-1 bg-emerald-500/10 text-emerald-300 text-sm font-medium rounded-lg">
            Complete
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-0">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 text-zinc-400">
            <RefreshCw className="animate-spin" size={32} />
            <p>Generating flashcards…</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="max-w-md text-center">
            <p className="text-red-400 mb-6">{error}</p>
            {hasNote && (
              <button
                onClick={() => loadCards(noteContent, activeNotePath ?? '')}
                className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={16} />
                Try again
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && totalCards === 0 && (
          <div className="text-center max-w-md">
            <div className="mx-auto w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center mb-6">
              🃏
            </div>
            <p className="text-xl font-medium text-white mb-2">No cards due</p>
            <p className="text-zinc-400 mb-8">
              {hasNote
                ? 'Generate flashcards from the current note to start reviewing.'
                : 'Open a note and generate flashcards from it first.'}
            </p>
            {hasNote && (
              <button
                onClick={() => loadCards(noteContent, activeNotePath ?? '')}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-300 text-white rounded-lg flex items-center gap-2 mx-auto"
              >
                <Sparkles size={18} />
                Generate flashcards
              </button>
            )}
          </div>
        )}

        {/* Session complete */}
        {!isLoading && !error && sessionComplete && (
          <div className="text-center max-w-md">
            <div className="mx-auto w-16 h-16 bg-emerald-500/10 text-emerald-300 rounded-lg flex items-center justify-center text-4xl mb-6">
              🎉
            </div>
            <p className="text-2xl font-semibold text-white mb-2">Session complete!</p>
            <p className="text-zinc-400 mb-8">
              You reviewed {totalCards} card{totalCards !== 1 ? 's' : ''}
            </p>

            <div className="flex justify-center gap-8 mb-10">
              <SummaryPill label="Again" count={againCount} color="red" />
              <SummaryPill label="Good" count={goodCount} color="amber" />
              <SummaryPill label="Easy" count={easyCount} color="emerald" />
            </div>

            <button
              onClick={() => {
                resetSession();
                if (hasNote) loadCards(noteContent, activeNotePath ?? '');
              }}
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg flex items-center gap-2 mx-auto"
            >
              Review again
            </button>
          </div>
        )}

        {/* Active card */}
        {!isLoading && !error && !sessionComplete && currentCard && (
          <div className="w-full max-w-2xl">
            <ReviewCard
              card={currentCard}
              isFlipped={isFlipped}
              onFlip={flipCard}
            />

            {/* Rating buttons (only after flip) */}
            {isFlipped && (
              <div className="flex justify-center gap-4 mt-12">
                <RatingButton
                  label="Again"
                  sublabel="Hard"
                  color="#f87171"
                  onClick={() => rateCard('again', activeNotePath ?? '')}
                />
                <RatingButton
                  label="Good"
                  sublabel="Medium"
                  color="#fbbf24"
                  onClick={() => rateCard('good', activeNotePath ?? '')}
                />
                <RatingButton
                  label="Easy"
                  sublabel="Easy"
                  color="#10b981"
                  onClick={() => rateCard('easy', activeNotePath ?? '')}
                />
              </div>
            )}

            {!isFlipped && (
              <p className="text-center text-zinc-400 text-sm mt-8">
                Press <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded">Space</span> or click to reveal
              </p>
            )}
          </div>
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
      onClick={onClick}
      className="px-8 py-4 rounded-lg flex flex-col items-center transition-all hover:scale-105 active:scale-95"
      style={{
        backgroundColor: `${color}15`,
        border: `2px solid ${color}40`,
      }}
    >
      <span className="font-semibold text-lg" style={{ color }}>
        {label}
      </span>
      <span className="text-xs text-zinc-400 mt-1">{sublabel}</span>
    </button>
  );
}

function SummaryPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center">
      <div
        className="text-3xl font-semibold"
        style={{ color: color === 'red' ? '#f87171' : color === 'amber' ? '#fbbf24' : '#10b981' }}
      >
        {count}
      </div>
      <div className="text-xs text-zinc-400 tracking-widest mt-1">{label}</div>
    </div>
  );
}