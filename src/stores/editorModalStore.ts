import { create } from 'zustand';

export type ReferenceMode = 'link' | 'backlink';

interface EditorModalState {
  referenceModalOpen: boolean;
  referenceMode: ReferenceMode;

  openReferenceModal: (mode?: ReferenceMode) => void;
  closeReferenceModal: () => void;
  setReferenceMode: (mode: ReferenceMode) => void;
}

export const useEditorModalStore = create<EditorModalState>((set) => ({
  referenceModalOpen: false,
  referenceMode: 'link',

  openReferenceModal: (mode = 'link') =>
    set({
      referenceModalOpen: true,
      referenceMode: mode,
    }),
  closeReferenceModal: () =>
    set({
      referenceModalOpen: false,
    }),
  setReferenceMode: (mode) => set({ referenceMode: mode }),
}));
