import { useEffect, useCallback } from 'react';
import { useEditor as useTiptapEditor, EditorContent } from '@tiptap/react';
import { getEditorExtensions } from '../../lib/tiptap/extensions';
import { serializeToMarkdown } from '../../lib/tiptap/markdownSerializer';
import { parseMarkdownToContent } from '../../lib/tiptap/markdownParser';
import { useEditor } from '../../hooks/useEditor';
import { useVaultStore } from '../../stores/vaultStore';
import { events } from '../../lib/tauri/events';
import { EditorToolbar } from './EditorToolbar';

export function Editor() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const { handleContentChange, loadNote } = useEditor();

  const editor = useTiptapEditor({
    extensions: getEditorExtensions(),
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none min-h-full',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const markdown = serializeToMarkdown(ed.getJSON());
      handleContentChange(markdown);
    },
  });

  // Load active note content
  useEffect(() => {
    if (!editor || !activeNotePath) return;

    let cancelled = false;
    const load = async () => {
      try {
        const raw = await loadNote(activeNotePath);
        if (cancelled) return;
        const content = parseMarkdownToContent(raw);
        editor.commands.setContent(content);
      } catch (e) {
        console.error('Failed to load note:', e);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [editor, activeNotePath]);

  // Listen for captured screenshots to insert images
  const insertImage = useCallback(
    (result: { path: string }) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .setImage({ src: result.path })
        .run();
    },
    [editor],
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const result = events.onScreenshotCaptured(insertImage);
    if (result && typeof (result as Promise<() => void>).then === 'function') {
      (result as Promise<() => void>).then((fn) => {
        cleanup = fn;
      });
    } else if (typeof result === 'function') {
      cleanup = result as () => void;
    }
    return () => cleanup?.();
  }, [insertImage]);

  if (!activeNotePath) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <p className="text-lg">Select or create a note to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <EditorToolbar editor={editor} />
      <div
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
