import { create } from 'zustand';

export type ActiveMode = 'editor' | 'fePrep' | 'vault' | 'diagram';

interface LayoutState {
  isSidebarOpen: boolean;
  isInkMode: boolean;
  /** Distraction-free writing mode — hides sidebar and toolbar */
  isFocusMode: boolean;
  activeMode: ActiveMode;
  /** Derived convenience getters */
  isFePrepMode: boolean;
  isVaultMode: boolean;
  isDiagramMode: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  toggleInkMode: () => void;
  toggleFocusMode: () => void;
  openFePrep: () => void;
  closeFePrep: () => void;
  openVaultMode: () => void;
  closeVaultMode: () => void;
  openDiagramMode: () => void;
  closeDiagramMode: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => {
  const setMode = (mode: ActiveMode) =>
    set({
      activeMode: mode,
      isFePrepMode: mode === 'fePrep',
      isVaultMode: mode === 'vault',
      isDiagramMode: mode === 'diagram',
    });

  return {
    isSidebarOpen: false,
    isInkMode: false,
    isFocusMode: false,
    activeMode: 'editor',
    isFePrepMode: false,
    isVaultMode: false,
    isDiagramMode: false,
    toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
    closeSidebar: () => set({ isSidebarOpen: false }),
    toggleInkMode: () => set((s) => ({ isInkMode: !s.isInkMode })),
    toggleFocusMode: () => set((s) => ({ isFocusMode: !s.isFocusMode })),
    openFePrep: () => setMode('fePrep'),
    closeFePrep: () => setMode('editor'),
    openVaultMode: () => setMode('vault'),
    closeVaultMode: () => setMode('editor'),
    openDiagramMode: () => setMode('diagram'),
    closeDiagramMode: () => setMode('editor'),
  };
});
