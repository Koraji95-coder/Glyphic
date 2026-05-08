import { create } from 'zustand';

interface LayoutState {
  isSidebarOpen: boolean;
  isInkMode: boolean;
  isFePrepMode: boolean;
  isVaultMode: boolean;
  isDiagramMode: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  toggleInkMode: () => void;
  openFePrep: () => void;
  closeFePrep: () => void;
  openVaultMode: () => void;
  closeVaultMode: () => void;
  openDiagramMode: () => void;
  closeDiagramMode: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSidebarOpen: false,
  isInkMode: false,
  isFePrepMode: false,
  isVaultMode: false,
  isDiagramMode: false,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleInkMode: () => set((s) => ({ isInkMode: !s.isInkMode })),
  openFePrep: () => set({ isFePrepMode: true, isVaultMode: false, isDiagramMode: false }),
  closeFePrep: () => set({ isFePrepMode: false }),
  openVaultMode: () => set({ isVaultMode: true, isFePrepMode: false, isDiagramMode: false }),
  closeVaultMode: () => set({ isVaultMode: false }),
  openDiagramMode: () => set({ isDiagramMode: true, isFePrepMode: false, isVaultMode: false }),
  closeDiagramMode: () => set({ isDiagramMode: false }),
}));
