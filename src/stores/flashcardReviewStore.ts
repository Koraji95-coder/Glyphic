import { create } from 'zustand';
import { commands } from '../lib/tauri/commands';
import type { Flashcard } from '../types/ai';
import type { CardRating, ReviewSession } from '../types/flashcardReview';

interface FlashcardReviewActions {
  open: () => void;
  close: () => void;
  /** Generate and load flashcards from the given note content via the AI command. */
  loadCards: (noteContent: string) => Promise<void>;
  /** Replace cards directly (e.g. from a previous generation stored elsewhere). */
  setCards: (cards: Flashcard[]) => void;
  flipCard: () => void;
  rateCard: (rating: CardRating) => void;
  resetSession: () => void;
}

type FlashcardReviewStore = ReviewSession & FlashcardReviewActions;

export const useFlashcardReviewStore = create<FlashcardReviewStore>((set, get) => ({
  cards: [],
  currentIndex: 0,
  isFlipped: false,
  ratings: {},
  sessionComplete: false,
  isOpen: false,
  isLoading: false,
  error: null,

  open: () => set({ isOpen: true }),

  close: () => set({ isOpen: false }),

  loadCards: async (noteContent: string) => {
    set({ isLoading: true, error: null });
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

  rateCard: (rating: CardRating) => {
    const { currentIndex, cards, ratings } = get();
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
