import type { Flashcard } from '../../types/ai';
import { MathBlock } from '../common/Math';

interface ReviewCardProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
}

export function ReviewCard({ card, isFlipped, onFlip }: ReviewCardProps) {
  return (
    <div
      onClick={onFlip}
      className={`relative w-full max-w-2xl mx-auto cursor-pointer transition-all duration-700 preserve-3d ${
        isFlipped ? 'rotate-y-180' : ''
      }`}
      style={{ perspective: '1000px', height: '420px' }}
    >
      {/* Card container */}
      <div
        className={`absolute inset-0 rounded-lg border border-zinc-700 shadow-2xl overflow-hidden transition-all ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
      >
        {/* Front - Question */}
        <div className="absolute inset-0 bg-zinc-900 flex flex-col p-8">
          <div className="text-xs font-medium tracking-widest text-blue-300 mb-2">QUESTION</div>
          <div className="flex-1 flex items-center justify-center text-center text-xl leading-relaxed text-white">
            {card.front}
          </div>
          <div className="text-center text-zinc-400 text-sm mt-8">
            Click or press <span className="font-mono bg-zinc-800 px-2 py-px rounded">Space</span> to reveal
          </div>
        </div>

        {/* Back - Answer */}
        <div
          className="absolute inset-0 bg-zinc-900 flex flex-col p-8 rotate-y-180"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="text-xs font-medium tracking-widest text-emerald-300 mb-2">ANSWER</div>
          <div className="flex-1 flex items-center justify-center text-center text-xl leading-relaxed text-white">
            {card.back}
          </div>
          {card.explanation && (
            <div className="mt-8 pt-8 border-t border-zinc-700 text-sm text-zinc-400">
              {card.explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}