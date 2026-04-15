import { create } from 'zustand';
import { VaultConfig } from '../types/vault';
import { invoke } from '@tauri-apps/api/core';

interface SettingsState {
  settings: VaultConfig | null;
  loadSettings: (vaultPath: string) => Promise<void>;
  updateSettings: (vaultPath: string, settings: VaultConfig) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,

  loadSettings: async (vaultPath) => {
    const settings = await invoke<VaultConfig>('get_settings', { vaultPath });
    set({ settings });
  },

  updateSettings: async (vaultPath, settings) => {
    await invoke<void>('update_settings', { vaultPath, settings });
    set({ settings });
  },
}));
