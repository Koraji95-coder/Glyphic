import { useCallback, useEffect, useRef } from 'react';
import { frontmatterRegistry } from '../lib/frontmatterRegistry';
import { commands } from '../lib/tauri/commands';
import { composeNote, extractFrontmatter, splitFrontmatter } from '../lib/tiptap/markdownParser';
import { useEditorStore } from '../stores/editorStore';
import { useVaultStore } from '../stores/vaultStore';

interface PendingSave {
  vaultPath: string;
  notePath: string;
  body: string;
  frontmatter: string;
}

export function useEditor() {
  const editorStore = useEditorStore();
  const { vaultPath, activeNotePath } = useVaultStore();

  // Hold the latest pending content + the current note's frontmatter so the
  // debounced save always writes to the *current* note (not whichever one was
  // active when the hook first mounted) and never drops the YAML header.
  const pendingRef = useRef<PendingSave | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writeNow = useCallback(
    async (pending: PendingSave) => {
      editorStore.setSaving(true);
      try {
        await commands.saveNote(pending.vaultPath, pending.notePath, composeNote(pending));
        editorStore.markSaved();
      } catch (e) {
        console.error('Save error:', e);
      } finally {
        editorStore.setSaving(false);
      }
    },
    [editorStore],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    await writeNow(pending);
  }, [writeNow]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      void writeNow(pending);
    }, 2000);
  }, [writeNow]);

  const handleContentChange = useCallback(
    (content: string) => {
      editorStore.setContent(content);
      editorStore.markDirty();
      const words = content.trim().split(/\s+/).filter(Boolean).length;
      editorStore.setWordCount(words);

      if (!vaultPath || !activeNotePath) return;
      pendingRef.current = {
        vaultPath,
        notePath: activeNotePath,
        body: content,
        frontmatter: frontmatterRegistry.get(activeNotePath),
      };
      scheduleSave();
    },
    [editorStore, vaultPath, activeNotePath, scheduleSave],
  );

  const loadNote = useCallback(
    async (notePath: string) => {
      if (!vaultPath) return '';
      // Persist any pending edits to the previously-active note before we load
      // a different file (otherwise the debounce timer would race the load).
      await flush();

      const raw = await commands.readNote(vaultPath, notePath);
      const { frontmatter, body } = splitFrontmatter(raw);
      frontmatterRegistry.set(notePath, frontmatter);
      // Expose the per-note ai_model so ChatPanel can use it without re-parsing.
      const fm = extractFrontmatter(raw);
      editorStore.setActiveNoteAiModel(typeof fm?.ai_model === 'string' ? fm.ai_model : null);
      editorStore.setContent(body);
      editorStore.markSaved();
      return body;
    },
    [vaultPath, editorStore, flush],
  );

  const forceSave = useCallback(async () => {
    await flush();
  }, [flush]);

  // Flush on tab close / app quit so the user never loses the last 2 s of edits.
  useEffect(() => {
    const handler = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      // Best-effort: fire-and-forget; the page is unloading.
      void commands.saveNote(pending.vaultPath, pending.notePath, composeNote(pending));
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return { ...editorStore, handleContentChange, loadNote, forceSave };
}
