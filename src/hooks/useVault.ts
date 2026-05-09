import { useCallback } from 'react';
import { commands } from '../lib/tauri/commands';
import { useVaultStore } from '../stores/vaultStore';

export function useVault() {
  const openVault = useCallback(async (path: string) => {
    const config = await commands.openVault(path);
    const store = useVaultStore.getState();
    store.setVaultPath(path);
    store.setVaultConfig(config);
    await store.refreshFileTree();
  }, []);

  const createVault = useCallback(async (path: string, name: string) => {
    const config = await commands.createVault(path, name);
    const store = useVaultStore.getState();
    store.setVaultPath(path);
    store.setVaultConfig(config);
    await store.refreshFileTree();
  }, []);

  const createNote = useCallback(async (folder: string, title: string) => {
    const store = useVaultStore.getState();
    if (!store.vaultPath) return;
    const note = await commands.createNote(store.vaultPath, folder, title);
    await store.refreshFileTree();
    store.setActiveNote(note.id, note.path);
    return note;
  }, []);

  const deleteNote = useCallback(async (notePath: string) => {
    const store = useVaultStore.getState();
    if (!store.vaultPath) return;
    await commands.deleteNote(store.vaultPath, notePath);
    await store.refreshFileTree();
  }, []);

  const deleteFolder = useCallback(async (relativePath: string) => {
    const store = useVaultStore.getState();
    if (!store.vaultPath) return;
    await commands.deleteFolder(store.vaultPath, relativePath);
    await store.refreshFileTree();
  }, []);

  return { openVault, createVault, createNote, deleteNote, deleteFolder };
}
