import { Columns2, Rows2, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useSplitStore } from '../../stores/splitStore';
import { useVaultStore } from '../../stores/vaultStore';
import { Editor } from './Editor';

/**
 * Renders the primary `<Editor />` and, when a split is active, a read-only
 * secondary `<Editor />` separated by a draggable divider. The split layout
 * is intentionally minimal (one extra pane, not recursive) — the primary
 * editor remains the single writer to disk to avoid save-race complexity.
 */
export function EditorPaneGroup() {
  const { secondaryNotePath, direction, primarySize, setPrimarySize, closeSplit, setSecondaryNote } = useSplitStore();
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fraction =
        direction === 'vertical' ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height;
      setPrimarySize(fraction);
    };
    const onUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [direction, setPrimarySize]);

  // If the user opens a different note, swap it into the active pane.
  // We always treat the primary pane as the editing target, so
  // `activeNotePath` is already wired correctly to it.

  if (!secondaryNotePath) {
    return (
      <div className="flex-1 flex min-h-0 min-w-0">
        <Editor />
      </div>
    );
  }

  const isVertical = direction === 'vertical';
  const primaryPct = `${(primarySize * 100).toFixed(2)}%`;
  const secondaryPct = `${((1 - primarySize) * 100).toFixed(2)}%`;

  return (
    <div
      ref={containerRef}
      className="flex-1 flex min-h-0 min-w-0"
      style={{ flexDirection: isVertical ? 'row' : 'column' }}
    >
      <div
        className="flex flex-col min-h-0 min-w-0"
        style={isVertical ? { width: primaryPct } : { height: primaryPct }}
      >
        <Editor />
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        style={{
          flexShrink: 0,
          width: isVertical ? '4px' : '100%',
          height: isVertical ? '100%' : '4px',
          cursor: isVertical ? 'col-resize' : 'row-resize',
          backgroundColor: 'var(--border)',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-dim)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
      />

      {/* Secondary pane */}
      <div
        className="flex flex-col min-h-0 min-w-0"
        style={isVertical ? { width: secondaryPct } : { height: secondaryPct }}
      >
        <SecondaryPaneHeader
          notePath={secondaryNotePath}
          direction={direction}
          onSwapInActive={() => {
            if (activeNotePath && activeNotePath !== secondaryNotePath) {
              setSecondaryNote(activeNotePath);
            }
          }}
          onClose={closeSplit}
        />
        <div className="flex-1 min-h-0">
          <Editor notePath={secondaryNotePath} readOnly />
        </div>
      </div>
    </div>
  );
}

function SecondaryPaneHeader({
  notePath,
  direction,
  onSwapInActive,
  onClose,
}: {
  notePath: string;
  direction: 'vertical' | 'horizontal';
  onSwapInActive: () => void;
  onClose: () => void;
}) {
  const title = notePath.replace(/\.md$/, '').split('/').pop() ?? notePath;
  return (
    <div
      className="flex items-center shrink-0"
      style={{
        gap: '6px',
        padding: '4px 10px',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {direction === 'vertical' ? (
        <Columns2 size={11} style={{ color: 'var(--text-ghost)' }} />
      ) : (
        <Rows2 size={11} style={{ color: 'var(--text-ghost)' }} />
      )}
      <span style={{ flex: 1 }} className="truncate" title={notePath}>
        {title}
      </span>
      <span
        style={{
          fontSize: '9px',
          padding: '1px 5px',
          borderRadius: '3px',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-ghost)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Read-only
      </span>
      <button
        type="button"
        onClick={onSwapInActive}
        title="Show current note in this pane"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '10px',
          color: 'var(--text-ghost)',
          padding: '2px 6px',
          borderRadius: '4px',
        }}
      >
        ⇆
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Close split (Ctrl+W)"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-ghost)',
          padding: '2px',
          borderRadius: '4px',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
