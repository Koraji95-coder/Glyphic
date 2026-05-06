import { create } from 'zustand';

interface LayoutState {
  isSidebarOpen: boolean;
  isInkMode: boolean;
  isFePrepMode: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  toggleInkMode: () => void;
  openFePrep: () => void;
  closeFePrep: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSidebarOpen: false,
  isInkMode: false,
  isFePrepMode: false,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleInkMode: () => set((s) => ({ isInkMode: !s.isInkMode })),
  openFePrep: () => set({ isFePrepMode: true }),
  closeFePrep: () => set({ isFePrepMode: false }),
}));
