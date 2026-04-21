import { create } from 'zustand';

export type SplitDirection = 'vertical' | 'horizontal';

interface SplitState {
  /** Path of the note open in the secondary pane, or null when no split. */
  secondaryNotePath: string | null;
  /** 'vertical' = side-by-side; 'horizontal' = stacked top/bottom. */
  direction: SplitDirection;
  /** Fraction (0..1) of the workspace given to the primary pane. */
  primarySize: number;
  /** Which pane is focused — affects what new notes open into. */
  activePane: 'primary' | 'secondary';
  openSplit: (notePath: string, direction?: SplitDirection) => void;
  closeSplit: () => void;
  setSecondaryNote: (path: string) => void;
  setPrimarySize: (size: number) => void;
  setActivePane: (pane: 'primary' | 'secondary') => void;
}

export const useSplitStore = create<SplitState>((set) => ({
  secondaryNotePath: null,
  direction: 'vertical',
  primarySize: 0.5,
  activePane: 'primary',

  openSplit: (notePath, direction = 'vertical') =>
    set({ secondaryNotePath: notePath, direction, activePane: 'secondary' }),
  closeSplit: () => set({ secondaryNotePath: null, activePane: 'primary' }),
  setSecondaryNote: (path) => set({ secondaryNotePath: path }),
  setPrimarySize: (size) => set({ primarySize: Math.max(0.15, Math.min(0.85, size)) }),
  setActivePane: (pane) => set({ activePane: pane }),
}));
