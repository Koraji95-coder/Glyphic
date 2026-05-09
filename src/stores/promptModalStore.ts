import { create } from 'zustand';

interface PromptConfig {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  isConfirm?: boolean;           // true = confirmation dialog (no input)
  confirmLabel?: string;
  onConfirm: (result: string | boolean) => void;
  onCancel?: () => void;
}

interface PromptModalState {
  isOpen: boolean;
  config: PromptConfig | null;

  openPrompt: (config: PromptConfig) => void;
  closePrompt: () => void;
}

export const usePromptModalStore = create<PromptModalState>((set) => ({
  isOpen: false,
  config: null,

  openPrompt: (config) => set({ isOpen: true, config }),
  closePrompt: () => set({ isOpen: false, config: null }),
}));