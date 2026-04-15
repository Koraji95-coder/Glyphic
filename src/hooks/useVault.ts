import { useCallback } from 'react';
import { useVaultStore } from '../stores/vaultStore';
import { commands } from '../lib/tauri/commands';

export function useVault() {
  const store = useVaultStore();

  const openVault = useCallback(async (path: string) => {
    const config = await commands.openVault(path);
    store.setVaultPath(path);
    store.setVaultConfig(config);
    await store.refreshFileTree();
  }, [store]);

  const createVault = useCallback(async (path: string, name: string) => {
    const config = await commands.createVault(path, name);
    store.setVaultPath(path);
    store.setVaultConfig(config);
    await store.refreshFileTree();
  }, [store]);

  const createNote = useCallback(async (folder: string, title: string) => {
    if (!store.vaultPath) return;
    const note = await commands.createNote(store.vaultPath, folder, title);
    await store.refreshFileTree();
    store.setActiveNote(note.id, note.path);
    return note;
  }, [store]);

  const deleteNote = useCallback(async (notePath: string) => {
    if (!store.vaultPath) return;
    await commands.deleteNote(store.vaultPath, notePath);
    await store.refreshFileTree();
  }, [store]);

  return { ...store, openVault, createVault, createNote, deleteNote };
}
