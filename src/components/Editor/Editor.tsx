import { convertFileSrc } from '@tauri-apps/api/core';
import { EditorContent, useEditor as useTiptapEditor } from '@tiptap/react';
import { lazy, Suspense, useCallback, useEffect } from 'react';
import { useEditor } from '../../hooks/useEditor';
import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { events } from '../../lib/tauri/events';
import { getEditorExtensions } from '../../lib/tiptap/extensions';
import { parseMarkdownToContent } from '../../lib/tiptap/markdownParser';
import { serializeToMarkdown } from '../../lib/tiptap/markdownSerializer';
import { useAnnotationStore } from '../../stores/annotationStore';
import { useEditorActionStore } from '../../stores/editorActionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useVaultStore } from '../../stores/vaultStore';
import { LectureModeToggle } from '../LectureMode/LectureModeToggle';
import { EditorToolbar } from './EditorToolbar';
import { NoteTagChips } from './NoteTagChips';

// Fabric.js (~330 kB min) is only needed when the user actually opens an
// annotation overlay, so split it into its own chunk and load on demand.
const AnnotationOverlay = lazy(() =>
  import('../Annotation/AnnotationOverlay').then((m) => ({ default: m.AnnotationOverlay })),
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
        class: 'ProseMirror focus:outline-none min-h-full',
      },
      handleKeyDown: (_view, event) => {
        // In lecture mode, auto-insert timestamp on Enter (new paragraph)
        if (!readOnly && lectureModeActive && lectureModeStartedAt && event.key === 'Enter' && !event.shiftKey) {
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
      if (readOnly) return;
      const markdown = serializeToMarkdown(ed.getJSON());
      handleContentChange(markdown);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (readOnly) return;
      const { from } = ed.state.selection;
      // Compute line/col by counting newlines in the text before the cursor.
      // textBetween(0, pos, '\n') inserts a '\n' between every block boundary,
      // giving an accurate position for a markdown (flat-ish) document.
      const textBefore = ed.state.doc.textBetween(0, from, '\n');
      const lines = textBefore.split('\n');
      const line = lines.length;
      const col = (lines[lines.length - 1]?.length ?? 0) + 1;
      setCursorPosition({ line, col });
    },
  });

  // Keep `editable` in sync if the prop changes after mount.
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Register editor action callbacks used by keyboard shortcuts and modals.
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

  // Load active note content
  useEffect(() => {
    if (!editor || !activeNotePath) return;

    let cancelled = false;
    const load = async () => {
      try {
        // In read-only mode, bypass `loadNote`'s save-flushing side effects so
        // we don't disturb the primary editor's pending-save state.
        let raw: string;
        if (readOnly) {
          const vp = useVaultStore.getState().vaultPath;
          if (!vp) return; // No vault open yet — nothing to load.
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

  // Listen for captured screenshots to insert images
  const insertImage = useCallback(
    (result: { path: string }) => {
      if (!editor || readOnly) return;
      // Tauri webviews can't load raw OS paths via <img src>; route them through
      // the asset: protocol so the file actually renders in the editor.
      const src = convertFileSrc(result.path);
      editor.chain().focus().setImage({ src }).run();
    },
    [editor, readOnly],
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

  // Listen for force-save requests dispatched by Ctrl+S handler in App.tsx
  useEffect(() => {
    if (readOnly) return;
    const handler = () => {
      void forceSave();
    };
    window.addEventListener('glyphic:force-save', handler);
    return () => window.removeEventListener('glyphic:force-save', handler);
  }, [readOnly, forceSave]);

  if (!activeNotePath) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ padding: '40px 20px' }}>
        <div
          style={{
            width: 'min(420px, 100%)',
            borderRadius: '24px',
            padding: '28px 26px',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), var(--glass-surface)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: '0 28px 80px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,255,255,0.03) inset',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '22px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              boxShadow: '0 0 44px rgba(163,116,247,0.3)',
            }}
          >
            ✦
          </div>
          <div>
            <p
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                marginBottom: '8px',
              }}
            >
              Open a note and start writing
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '280px' }}>
              Select a note from the sidebar or press{' '}
              <kbd
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent)',
                }}
              >
                ⌘P
              </kbd>{' '}
              to quick-switch into your vault.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span
              style={{
                padding: '5px 10px',
                borderRadius: '999px',
                fontSize: '10px',
                color: 'var(--accent)',
                background: 'rgba(163,116,247,0.14)',
                border: '1px solid rgba(163,116,247,0.22)',
              }}
            >
              Aurora glass workspace
            </span>
            <span
              style={{
                padding: '5px 10px',
                borderRadius: '999px',
                fontSize: '10px',
                color: 'var(--accent-warm)',
                background: 'rgba(249,118,85,0.12)',
                border: '1px solid rgba(249,118,85,0.18)',
              }}
            >
              Sunset neon accents
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Build breadcrumb parts from the note path
  const pathParts = activeNotePath.replace(/\.md$/, '').split('/').filter(Boolean);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {!readOnly && <EditorToolbar editor={editor} />}
      {!readOnly && <LectureModeToggle />}
      <NoteTagChips notePath={activeNotePath} />
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
      <div
        className="flex-1 overflow-y-auto"
        style={{
          background:
            'radial-gradient(circle at top center, rgba(163,116,247,0.06), transparent 32%), radial-gradient(circle at bottom right, rgba(249,118,85,0.05), transparent 24%), rgba(13,11,22,0.45)',
        }}
      >
        <EditorContent editor={editor} />
      </div>
      {!readOnly && <AnnotationOverlayLazy />}
    </div>
  );
}

/**
 * Only mount the lazy-loaded `AnnotationOverlay` when the annotation overlay is
 * actually open. This way Fabric.js stays out of the runtime cost when notes
 * are merely being read or edited.
 */
function AnnotationOverlayLazy() {
  const isOpen = useAnnotationStore((s) => s.isOpen);
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <AnnotationOverlay />
    </Suspense>
  );
}

function formatElapsed(startedAt: Date): string {
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
