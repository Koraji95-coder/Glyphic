import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SlashCommandItem } from '../../../lib/tiptap/slashCommand';

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export function SlashCommandMenu({ items, command }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

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
    [items, selectedIndex, command]
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
      className="w-72 max-h-80 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl backdrop-blur-2xl py-2 z-50"
    >
      {items.map((item, index) => (
        <button
          key={item.title}
          onClick={() => command(item)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={`flex items-center gap-3 w-full px-5 py-3 text-left transition-all ${
            index === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
          }`}
        >
          <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-2xl text-violet-300">
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-white truncate">{item.title}</div>
            <div className="text-xs text-zinc-400 truncate">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}