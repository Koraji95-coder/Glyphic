import { create } from 'zustand';

type SettingsSection = 'general' | 'editor' | 'capture' | 'lecture' | 'ai' | 'shortcuts';

interface SettingsUiState {
  isOpen: boolean;
  section: SettingsSection;
  open: (section?: SettingsSection) => void;
  close: () => void;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  isOpen: false,
  section: 'general',
  open: (section = 'general') => set({ isOpen: true, section }),
  close: () => set({ isOpen: false }),
  setSection: (section) => set({ section }),
}));

export type { SettingsSection };
