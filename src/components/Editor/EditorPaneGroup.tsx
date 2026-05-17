import { Columns2, Rows2, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

import { useSplitStore } from '../../stores/splitStore';
import { useVaultStore } from '../../stores/vaultStore';
import { Editor } from './Editor';

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
    [direction]
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
      {/* Primary Pane */}
      <div
        className="flex flex-col min-h-0 min-w-0"
        style={isVertical ? { width: primaryPct } : { height: primaryPct }}
      >
        <Editor />
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        className={`flex-shrink-0 bg-zinc-700 hover:bg-violet-500 transition-colors ${
          isVertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
        }`}
      />

      {/* Secondary Pane */}
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
    <div className="flex items-center shrink-0 h-10 bg-zinc-900 border-b border-zinc-700 px-4 text-xs text-zinc-400">
      {direction === 'vertical' ? (
        <Columns2 size={16} className="mr-3 text-zinc-500" />
      ) : (
        <Rows2 size={16} className="mr-3 text-zinc-500" />
      )}
      <span className="flex-1 truncate font-medium text-white">{title}</span>

      <span className="px-3 py-1 text-[10px] bg-zinc-800 border border-zinc-600 rounded-3xl text-zinc-400">Read-only</span>

      <button
        onClick={onSwapInActive}
        title="Swap current note into this pane"
        className="ml-4 px-3 py-1 hover:bg-zinc-800 rounded-2xl transition-colors text-zinc-400 hover:text-white"
      >
        ⇆
      </button>

      <button
        onClick={onClose}
        title="Close split pane"
        className="ml-2 px-3 py-1 hover:bg-zinc-800 rounded-2xl transition-colors text-zinc-400 hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  );
}