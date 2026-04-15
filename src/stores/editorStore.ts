import { create } from 'zustand';

interface EditorState {
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  wordCount: number;
  lectureModeActive: boolean;
  lectureModeStartedAt: Date | null;
  setContent: (content: string) => void;
  markDirty: () => void;
  markSaved: () => void;
  setWordCount: (count: number) => void;
  setSaving: (saving: boolean) => void;
  toggleLectureMode: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '',
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  wordCount: 0,
  lectureModeActive: false,
  lectureModeStartedAt: null,

  setContent: (content) => set({ content }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, lastSavedAt: new Date() }),
  setWordCount: (count) => set({ wordCount: count }),
  setSaving: (saving) => set({ isSaving: saving }),
  toggleLectureMode: () =>
    set((state) => ({
      lectureModeActive: !state.lectureModeActive,
      lectureModeStartedAt: !state.lectureModeActive ? new Date() : null,
    })),
}));
