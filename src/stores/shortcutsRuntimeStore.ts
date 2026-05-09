import { create } from 'zustand';

interface ShortcutsRuntimeState {
  globalOverrides: Record<string, string>;
  setGlobalShortcutOverride: (defaultCombo: string, activeCombo: string) => void;
  clearGlobalShortcutOverrides: () => void;
}

export const useShortcutsRuntimeStore = create<ShortcutsRuntimeState>((set) => ({
  globalOverrides: {},
  setGlobalShortcutOverride: (defaultCombo, activeCombo) =>
    set((state) => ({
      globalOverrides: {
        ...state.globalOverrides,
        [defaultCombo]: activeCombo,
      },
    })),
  clearGlobalShortcutOverrides: () => set({ globalOverrides: {} }),
}));
