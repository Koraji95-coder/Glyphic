import { create } from 'zustand';

type OnboardingStep = 'welcome' | 'ai' | 'quickstart' | 'done';

interface OnboardingState {
  /** When `null`, the app hasn't finished checking recent-vaults state yet. */
  isOpen: boolean | null;
  step: OnboardingStep;
  open: () => void;
  setStep: (step: OnboardingStep) => void;
  finish: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isOpen: null,
  step: 'welcome',
  open: () => set({ isOpen: true, step: 'welcome' }),
  setStep: (step) => set({ step }),
  finish: () => set({ isOpen: false, step: 'done' }),
}));
