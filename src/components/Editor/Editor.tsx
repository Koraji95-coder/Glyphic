import { convertFileSrc } from '@tauri-apps/api/core';
import { EditorContent, useEditor as useTiptapEditor } from '@tiptap/react';
import { useCallback, useEffect } from 'react';
import { useEditor } from '../../hooks/useEditor';
import { events } from '../../lib/tauri/events';
import { getEditorExtensions } from '../../lib/tiptap/extensions';
import { parseMarkdownToContent } from '../../lib/tiptap/markdownParser';
import { serializeToMarkdown } from '../../lib/tiptap/markdownSerializer';
import { useEditorStore } from '../../stores/editorStore';
import { useVaultStore } from '../../stores/vaultStore';
import { AnnotationOverlay } from '../Annotation/AnnotationOverlay';
import { LectureModeToggle } from '../LectureMode/LectureModeToggle';
import { EditorToolbar } from './EditorToolbar';

export function Editor() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const lectureModeActive = useEditorStore((s) => s.lectureModeActive);
  const lectureModeStartedAt = useEditorStore((s) => s.lectureModeStartedAt);
  const { handleContentChange, loadNote } = useEditor();

  const editor = useTiptapEditor({
    extensions: getEditorExtensions(),
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none min-h-full',
      },
      handleKeyDown: (_view, event) => {
        // In lecture mode, auto-insert timestamp on Enter (new paragraph)
        if (lectureModeActive && lectureModeStartedAt && event.key === 'Enter' && !event.shiftKey) {
          // Let TipTap handle Enter first, then insert timestamp
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
      // Tauri webviews can't load raw OS paths via <img src>; route them through
      // the asset: protocol so the file actually renders in the editor.
      const src = convertFileSrc(result.path);
      editor.chain().focus().setImage({ src }).run();
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
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
        <p className="text-lg">Select or create a note to get started</p>
      </div>
    );
  }

  // Build breadcrumb parts from the note path
  const pathParts = activeNotePath.replace(/\.md$/, '').split('/').filter(Boolean);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <EditorToolbar editor={editor} />
      <LectureModeToggle />
      {/* Breadcrumb bar */}
      {pathParts.length > 1 && (
        <div
          className="flex items-center shrink-0"
          style={{
            gap: '3px',
            padding: '5px 28px',
            fontSize: '11px',
            color: 'var(--text-ghost)',
            backgroundColor: 'var(--bg-editor)',
          }}
        >
          {pathParts.map((part, i) => (
            <span key={part}>
              {i > 0 && <span style={{ margin: '0 1px' }}>/</span>}
              <span
                style={{
                  color: i === pathParts.length - 1 ? 'var(--text-tertiary)' : 'var(--text-ghost)',
                }}
              >
                {part}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg-editor)' }}>
        <EditorContent editor={editor} />
      </div>
      <AnnotationOverlay />
    </div>
  );
}

function formatElapsed(startedAt: Date): string {
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
