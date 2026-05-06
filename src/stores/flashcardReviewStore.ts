import { create } from 'zustand';
import { commands } from '../lib/tauri/commands';
import type { Flashcard } from '../types/ai';
import type { CardRating, ReviewSession } from '../types/flashcardReview';

interface FlashcardReviewActions {
  open: () => void;
  close: () => void;
  /** Generate and load flashcards from the given note content via the AI command. */
  loadCards: (noteContent: string, notePath?: string) => Promise<void>;
  /** Replace cards directly (e.g. from a previous generation stored elsewhere). */
  setCards: (cards: Flashcard[]) => void;
  flipCard: () => void;
  rateCard: (rating: CardRating, notePath?: string) => void;
  resetSession: () => void;
}

type FlashcardReviewStore = ReviewSession & FlashcardReviewActions & { activNotePath: string };

export const useFlashcardReviewStore = create<FlashcardReviewStore>((set, get) => ({
  cards: [],
  currentIndex: 0,
  isFlipped: false,
  ratings: {},
  sessionComplete: false,
  isOpen: false,
  isLoading: false,
  error: null,
  activNotePath: '',

  open: () => set({ isOpen: true }),

  close: () => set({ isOpen: false }),

  loadCards: async (noteContent: string, notePath?: string) => {
    set({ isLoading: true, error: null, activNotePath: notePath ?? '' });
    try {
      const cards = await commands.aiFlashcards(noteContent);
      set({
        cards,
        currentIndex: 0,
        isFlipped: false,
        ratings: {},
        sessionComplete: false,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: typeof err === 'string' ? err : 'Failed to generate flashcards.',
      });
    }
  },

  setCards: (cards: Flashcard[]) => {
    set({
      cards,
      currentIndex: 0,
      isFlipped: false,
      ratings: {},
      sessionComplete: false,
      error: null,
    });
  },

  flipCard: () => set((s) => ({ isFlipped: !s.isFlipped })),

  rateCard: (rating: CardRating, notePath?: string) => {
    const { currentIndex, cards, ratings, activNotePath } = get();
    const currentCard = cards[currentIndex];
    const np = notePath ?? activNotePath;

    // Persist rating to SQLite (fire-and-forget — do not block UI).
    // cardId is built from note path + index + first 40 chars of question.
    // The '::' separator is safe because we only split on the last occurrence.
    if (currentCard) {
      const sanitizedNote = np.replace(/::/g, '__');
      const cardId = `${sanitizedNote}::${currentIndex}::${currentCard.question.slice(0, 40)}`;
      commands
        .recordFlashcardReview(cardId, np, currentCard.question, currentCard.answer, rating)
        .catch((e) => console.warn('Failed to persist flashcard rating:', e));
    }

    const nextRatings = { ...ratings, [currentIndex]: rating };
    const nextIndex = currentIndex + 1;
    if (nextIndex >= cards.length) {
      set({ ratings: nextRatings, sessionComplete: true });
    } else {
      set({ ratings: nextRatings, currentIndex: nextIndex, isFlipped: false });
    }
  },

  resetSession: () => {
    set({ currentIndex: 0, isFlipped: false, ratings: {}, sessionComplete: false, error: null });
  },
}));
