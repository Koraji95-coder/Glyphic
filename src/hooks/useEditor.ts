import { useCallback, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useVaultStore } from '../stores/vaultStore';
import { commands } from '../lib/tauri/commands';
import { debounce } from '../lib/utils/debounce';

export function useEditor() {
  const editorStore = useEditorStore();
  const { vaultPath, activeNotePath } = useVaultStore();

  const debouncedSave = useRef(
    debounce(async (content: string) => {
      if (!vaultPath || !activeNotePath) return;
      editorStore.setSaving(true);
      try {
        await commands.saveNote(vaultPath, activeNotePath, content);
        editorStore.markSaved();
      } catch (e) {
        console.error('Save error:', e);
      } finally {
        editorStore.setSaving(false);
      }
    }, 2000) as (content: string) => void
  ).current;

  const handleContentChange = useCallback((content: string) => {
    editorStore.setContent(content);
    editorStore.markDirty();
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    editorStore.setWordCount(words);
    debouncedSave(content);
  }, [editorStore, debouncedSave]);

  const loadNote = useCallback(async (notePath: string) => {
    if (!vaultPath) return '';
    const content = await commands.readNote(vaultPath, notePath);
    editorStore.setContent(content);
    editorStore.markSaved();
    return content;
  }, [vaultPath, editorStore]);

  const forceSave = useCallback(async () => {
    if (!vaultPath || !activeNotePath) return;
    editorStore.setSaving(true);
    try {
      await commands.saveNote(vaultPath, activeNotePath, editorStore.content);
      editorStore.markSaved();
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      editorStore.setSaving(false);
    }
  }, [vaultPath, activeNotePath, editorStore]);

  return { ...editorStore, handleContentChange, loadNote, forceSave };
}
