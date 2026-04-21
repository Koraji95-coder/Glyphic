import Image from '@tiptap/extension-image';
import { NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { Maximize2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useLightboxStore } from '../../stores/lightboxStore';

/**
 * Extends TipTap's stock `Image` extension with a React `NodeView` that:
 *   - Renders an explicit drag-handle so block-level reorder works reliably
 *     (ProseMirror's stock image-block DnD is flaky across browsers).
 *   - Exposes a hover toolbar with Open Full / Delete actions.
 *   - Opens the global `Lightbox` on click for full-resolution viewing.
 *
 * The schema (markdown ![alt](path) → image node with `src`/`alt`) is
 * unchanged, so existing notes parse through the new node without migration.
 */
export const ScreenshotNode = Image.extend({
  name: 'image',
  draggable: true,
  selectable: true,

  addNodeView() {
    return ReactNodeViewRenderer(ScreenshotNodeView);
  },
});

function ScreenshotNodeView({ node, deleteNode, editor }: ReactNodeViewProps) {
  const src = (node.attrs.src as string) ?? '';
  const alt = (node.attrs.alt as string) ?? '';
  const [hover, setHover] = useState(false);
  const open = useLightboxStore((s) => s.open);
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="div"
      className="screenshot-node"
      style={{
        position: 'relative',
        display: 'block',
        margin: '8px 0',
        // The drag handle is the wrapper itself (see data-drag-handle).
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={() => src && open(src)}
        title="Open full size"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'zoom-in',
          display: 'block',
          width: '100%',
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="note-image"
          style={{
            maxWidth: '100%',
            display: 'block',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}
        />
      </button>

      {/* Drag handle — ProseMirror picks up `data-drag-handle` as the source for block DnD. */}
      {editable && (
        <span
          data-drag-handle=""
          contentEditable={false}
          title="Drag to reorder"
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            width: '18px',
            height: '18px',
            display: hover ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            background: 'rgba(20,20,28,0.85)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            userSelect: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          ⋮⋮
        </span>
      )}

      {/* Hover toolbar */}
      {editable && hover && (
        <div
          contentEditable={false}
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            display: 'flex',
            gap: '2px',
            padding: '3px',
            background: 'rgba(20,20,28,0.85)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <ToolbarBtn label="Open full size" onClick={() => src && open(src)}>
            <Maximize2 size={12} />
          </ToolbarBtn>
          <ToolbarBtn label="Delete image" onClick={deleteNode}>
            <Trash2 size={12} />
          </ToolbarBtn>
        </div>
      )}
    </NodeViewWrapper>
  );
}

function ToolbarBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        padding: '4px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
    >
      {children}
    </button>
  );
}
