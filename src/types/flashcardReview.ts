import type { Flashcard } from './ai';

export type CardRating = 'again' | 'good' | 'easy';

export interface ReviewSession {
  cards: Flashcard[];
  currentIndex: number;
  isFlipped: boolean;
  ratings: Record<number, CardRating>;
  sessionComplete: boolean;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}
