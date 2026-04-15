import { create } from 'zustand';
import { VaultConfig, VaultEntry } from '../types/vault';
import { invoke } from '@tauri-apps/api/core';

interface VaultState {
  vaultPath: string | null;
  vaultConfig: VaultConfig | null;
  fileTree: VaultEntry[];
  activeNoteId: string | null;
  activeNotePath: string | null;
  openNotes: string[];
  setVaultPath: (path: string) => void;
  setVaultConfig: (config: VaultConfig) => void;
  setFileTree: (tree: VaultEntry[]) => void;
  setActiveNote: (id: string, path: string) => void;
  addOpenNote: (path: string) => void;
  removeOpenNote: (path: string) => void;
  refreshFileTree: () => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  vaultConfig: null,
  fileTree: [],
  activeNoteId: null,
  activeNotePath: null,
  openNotes: [],

  setVaultPath: (path) => set({ vaultPath: path }),
  setVaultConfig: (config) => set({ vaultConfig: config }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setActiveNote: (id, path) => set({ activeNoteId: id, activeNotePath: path }),
  addOpenNote: (path) =>
    set((state) => ({
      openNotes: state.openNotes.includes(path)
        ? state.openNotes
        : [...state.openNotes, path],
    })),
  removeOpenNote: (path) =>
    set((state) => ({
      openNotes: state.openNotes.filter((p) => p !== path),
    })),
  refreshFileTree: async () => {
    const vaultPath = get().vaultPath;
    if (!vaultPath) return;
    const tree = await invoke<VaultEntry[]>('list_vault_contents', { vaultPath });
    set({ fileTree: tree });
  },
}));
