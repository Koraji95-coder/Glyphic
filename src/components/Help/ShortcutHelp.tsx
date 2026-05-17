import { Keyboard, X } from 'lucide-react';
import { useEffect } from 'react';

import { useHelpUiStore } from '../../stores/helpUiStore';
import { ShortcutsList } from './ShortcutsList';

export function ShortcutHelp() {
  const { isOpen, close } = useHelpUiStore();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      onClick={close}
      className="fixed inset-0 bg-black/70 z-[220] flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Keyboard size={20} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={close}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        <div className="p-6 max-h-[520px] overflow-y-auto">
          <ShortcutsList />
        </div>
      </div>
    </div>
  );
}