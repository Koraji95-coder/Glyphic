import { create } from 'zustand';

interface LayoutState {
  isSidebarOpen: boolean;
  isInkMode: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  toggleInkMode: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSidebarOpen: false,
  isInkMode: false,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleInkMode: () => set((s) => ({ isInkMode: !s.isInkMode })),
}));
