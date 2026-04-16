import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SlashCommandItem } from '../../../lib/tiptap/slashCommand';

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export function SlashCommandMenu({ items, command }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Scroll selected item into view
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const selected = menu.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          command(items[selectedIndex]);
        }
        return true;
      }
      return false;
    },
    [items, selectedIndex, command],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onKeyDown]);

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="rounded-lg overflow-hidden overflow-y-auto"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        maxHeight: '320px',
        width: '280px',
      }}
    >
      {items.map((item, index) => (
        <button
          key={item.title}
          onClick={() => command(item)}
          className="flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors"
          style={{
            backgroundColor: index === selectedIndex ? 'var(--bg-hover)' : 'transparent',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span
            className="w-8 h-8 flex items-center justify-center rounded text-sm font-medium shrink-0"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="font-medium truncate">{item.title}</div>
            <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
