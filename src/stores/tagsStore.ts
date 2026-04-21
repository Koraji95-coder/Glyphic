import { create } from 'zustand';
import { commands } from '../lib/tauri/commands';
import type { TagInfo } from '../types/tags';

interface TagsState {
  tags: TagInfo[];
  selectedTag: string | null;
  filteredPaths: Set<string> | null;
  isLoading: boolean;
  refreshTags: () => Promise<void>;
  selectTag: (tag: string | null) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  selectedTag: null,
  filteredPaths: null,
  isLoading: false,

  refreshTags: async () => {
    try {
      set({ isLoading: true });
      const tags = await commands.listAllTags();
      set({ tags, isLoading: false });
      // If a tag is currently selected, refresh its filtered path set too.
      const current = get().selectedTag;
      if (current) {
        await get().selectTag(current);
      }
    } catch (e) {
      console.warn('refreshTags failed:', e);
      set({ isLoading: false });
    }
  },

  selectTag: async (tag) => {
    if (!tag) {
      set({ selectedTag: null, filteredPaths: null });
      return;
    }
    try {
      const paths = await commands.notesWithTag(tag);
      set({ selectedTag: tag, filteredPaths: new Set(paths) });
    } catch (e) {
      console.warn('selectTag failed:', e);
      set({ selectedTag: null, filteredPaths: null });
    }
  },
}));
