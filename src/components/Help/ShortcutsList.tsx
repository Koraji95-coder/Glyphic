import { shortcutsByCategory } from '../../lib/shortcuts';
import { useShortcutsRuntimeStore } from '../../stores/shortcutsRuntimeStore';

export function ShortcutsList() {
  const groups = shortcutsByCategory();
  const globalOverrides = useShortcutsRuntimeStore((s) => s.globalOverrides);

  return (
    <div className="space-y-8">
      {(Object.keys(groups) as Array<keyof typeof groups>).map((category) => {
        const entries = groups[category];
        if (entries.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
              {category}
            </h3>
            <div className="space-y-1">
              {entries.map((shortcut) => {
                const activeCombo = globalOverrides[shortcut.combo] ?? shortcut.combo;
                const isFallback = activeCombo !== shortcut.combo;

                return (
                  <div
                    key={`${shortcut.combo}-${activeCombo}`}
                    className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-md transition-colors"
                  >
                    <span className="text-zinc-300">{shortcut.description}</span>
                    <div className="flex items-center gap-2">
                      {isFallback && (
                        <span className="text-[10px] text-zinc-500">fallback</span>
                      )}
                      <kbd className="px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-mono text-white">
                        {activeCombo}
                      </kbd>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}