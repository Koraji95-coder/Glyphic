import { create } from 'zustand';

type InsertLinkHandler = (url: string, text?: string) => void;
type InsertBacklinkHandler = (noteTitle: string) => void;
type ToggleCodeBlockHandler = () => void;

function createUnboundHandler(actionName: string) {
  return () => {
    throw new Error(`Editor action is not wired: ${actionName}`);
  };
}

interface EditorActionState {
  // Callbacks that the Editor component registers to handle insertions
  onInsertLink: InsertLinkHandler;
  onInsertBacklink: InsertBacklinkHandler;
  onToggleCodeBlock: ToggleCodeBlockHandler;

  setOnInsertLink: (callback: InsertLinkHandler) => void;
  setOnInsertBacklink: (callback: InsertBacklinkHandler) => void;
  setOnToggleCodeBlock: (callback: ToggleCodeBlockHandler) => void;
  resetOnInsertLink: () => void;
  resetOnInsertBacklink: () => void;
  resetOnToggleCodeBlock: () => void;
}

export const useEditorActionStore = create<EditorActionState>((set) => ({
  onInsertLink: createUnboundHandler('insert link') as InsertLinkHandler,
  onInsertBacklink: createUnboundHandler('insert backlink') as InsertBacklinkHandler,
  onToggleCodeBlock: createUnboundHandler('toggle code block') as ToggleCodeBlockHandler,

  setOnInsertLink: (callback) => set({ onInsertLink: callback }),
  setOnInsertBacklink: (callback) => set({ onInsertBacklink: callback }),
  setOnToggleCodeBlock: (callback) => set({ onToggleCodeBlock: callback }),
  resetOnInsertLink: () => set({ onInsertLink: createUnboundHandler('insert link') as InsertLinkHandler }),
  resetOnInsertBacklink: () =>
    set({ onInsertBacklink: createUnboundHandler('insert backlink') as InsertBacklinkHandler }),
  resetOnToggleCodeBlock: () =>
    set({ onToggleCodeBlock: createUnboundHandler('toggle code block') as ToggleCodeBlockHandler }),
}));
