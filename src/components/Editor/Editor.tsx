import { convertFileSrc } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { EditorContent, useEditor as useTiptapEditor } from '@tiptap/react';
import { lazy, Suspense, useCallback, useEffect } from 'react';

import { useEditor } from '../../hooks/useEditor';
import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { events } from '../../lib/tauri/events';
import { getEditorExtensions } from '../../lib/tiptap/extensions';
import { parseMarkdownToContent } from '../../lib/tiptap/markdownParser';
import { serializeToMarkdown } from '../../lib/tiptap/markdownSerializer';
import { Dashboard } from '../../modes/dashboard/Dashboard';
import { useAnnotationStore } from '../../stores/annotationStore';
import { useEditorActionStore } from '../../stores/editorActionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useVaultStore } from '../../stores/vaultStore';

import { LectureModeToggle } from '../LectureMode/LectureModeToggle';
import { EditorToolbar } from './EditorToolbar';
import { NoteTagChips } from './NoteTagChips';

const AnnotationOverlay = lazy(() =>
  import('../Annotation/AnnotationOverlay').then((m) => ({ default: m.AnnotationOverlay }))
);

export function Editor({
  notePath: notePathProp,
  readOnly = false,
}: {
  notePath?: string | null;
  readOnly?: boolean;
} = {}) {
  const globalActivePath = useVaultStore((s) => s.activeNotePath);
  const activeNotePath = notePathProp !== undefined ? notePathProp : globalActivePath;

  const lectureModeActive = useEditorStore((s) => s.lectureModeActive);
  const lectureModeStartedAt = useEditorStore((s) => s.lectureModeStartedAt);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);

  const { handleContentChange, loadNote, forceSave } = useEditor();

  const editor = useTiptapEditor({
    extensions: getEditorExtensions(),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none min-h-full px-8 py-6',
      },
      handleKeyDown: (_view, event) => {
        if (!readOnly && lectureModeActive && lectureModeStartedAt && event.key === 'Enter' && !event.shiftKey) {
          setTimeout(() => {
            if (!editor) return;
            const elapsed = formatElapsed(lectureModeStartedAt);
            const now = new Date();
            const hours = now.getHours();
            const mins = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const h = hours % 12 || 12;
            const absolute = `${h}:${String(mins).padStart(2, '0')} ${ampm}`;
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'timestamp',
                attrs: { elapsed, absolute },
              })
              .insertContent(' ')
              .run();
          }, 10);
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (readOnly) return;
      const markdown = serializeToMarkdown(ed.getJSON());
      handleContentChange(markdown);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (readOnly) return;
      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(0, from, '\n');
      const lines = textBefore.split('\n');
      const line = lines.length;
      const col = (lines[lines.length - 1]?.length ?? 0) + 1;
      setCursorPosition({ line, col });
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    const actionStore = useEditorActionStore.getState();
    if (!editor || readOnly) return;

    actionStore.setOnInsertLink((url: string, text?: string) => {
      const linkText = text?.trim() || url;
      editor.chain().focus().insertContent(`[${linkText}](${url})`).run();
    });

    actionStore.setOnInsertBacklink((noteTitle: string) => {
      editor.chain().focus().insertContent(`[[${noteTitle}]]`).run();
    });

    actionStore.setOnToggleCodeBlock(() => {
      editor.chain().focus().toggleCodeBlock().run();
    });

    return () => {
      const cleanupStore = useEditorActionStore.getState();
      cleanupStore.resetOnInsertLink();
      cleanupStore.resetOnInsertBacklink();
      cleanupStore.resetOnToggleCodeBlock();
    };
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || !activeNotePath) return;

    let cancelled = false;
    const load = async () => {
      try {
        let raw: string;
        if (readOnly) {
          const vp = useVaultStore.getState().vaultPath;
          if (!vp) return;
          raw = await commands.readNote(vp, activeNotePath);
        } else {
          raw = await loadNote(activeNotePath);
        }
        if (cancelled) return;
        const content = parseMarkdownToContent(raw);
        editor.commands.setContent(content);
      } catch (e) {
        reportError({ context: 'Editor note load', message: 'Failed to load note', error: e });
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [editor, activeNotePath, readOnly, loadNote]);

  const insertImage = useCallback(
    (result: { path: string }) => {
      if (!editor || readOnly) return;
      const src = convertFileSrc(result.path);
      editor.chain().focus().setImage({ src }).run();
    },
    [editor, readOnly]
  );

  useEffect(() => {
    let unsubscribe: UnlistenFn | null = null;

    void (async () => {
      unsubscribe = await events.onScreenshotCaptured(insertImage);
    })();

    return () => {
      if (unsubscribe) void unsubscribe();
    };
  }, [insertImage]);

  useEffect(() => {
    if (readOnly) return;
    const handler = () => void forceSave();
    window.addEventListener('glyphic:force-save', handler);
    return () => window.removeEventListener('glyphic:force-save', handler);
  }, [readOnly, forceSave]);

  if (!activeNotePath) {
    return <Dashboard />;
  }

  const pathParts = activeNotePath.replace(/\.md$/, '').split('/').filter(Boolean);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
      {!readOnly && <EditorToolbar editor={editor} />}
      {!readOnly && <LectureModeToggle />}
      <NoteTagChips notePath={activeNotePath} />

      {pathParts.length > 1 && (
        <div className="flex items-center px-8 py-2 text-xs text-zinc-400 border-b border-zinc-800 bg-zinc-900/50">
          {pathParts.map((part, i) => (
            <span key={part} className="flex items-center">
              {i > 0 && <span className="mx-1 text-zinc-600">/</span>}
              <span className={i === pathParts.length - 1 ? 'text-zinc-200' : ''}>{part}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 bg-zinc-950">
        <EditorContent editor={editor} />
      </div>

      {!readOnly && (
        <Suspense fallback={null}>
          <AnnotationOverlay />
        </Suspense>
      )}
    </div>
  );
}

function formatElapsed(startedAt: Date): string {
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}