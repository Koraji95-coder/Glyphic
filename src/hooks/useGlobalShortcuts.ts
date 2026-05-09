import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useEffect } from 'react';
import { commands, isTauri } from '../lib/tauri/commands';
import { useShortcutsRuntimeStore } from '../stores/shortcutsRuntimeStore';

function warnShortcutIssue(message: string, error?: unknown) {
  if (error !== undefined) {
    console.warn(`[Global shortcuts] ${message}`, error);
    return;
  }
  console.warn(`[Global shortcuts] ${message}`);
}

interface ShortcutBinding {
  name: string;
  keys: string[];
  displayCombos: string[];
  handler: () => Promise<unknown>;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    if (!isTauri) return;

    const shortcuts: ShortcutBinding[] = [
      {
        name: 'capture overlay',
        keys: ['CmdOrCtrl+Shift+S', 'CmdOrCtrl+Alt+S'],
        displayCombos: ['Ctrl+Shift+S', 'Ctrl+Alt+S'],
        handler: () => commands.startCapture(),
      },
      {
        // CmdOrCtrl+Shift+F also opens the capture overlay; the overlay's
        // fullscreen-mode logic immediately captures the whole screen without
        // requiring the user to draw a region.
        name: 'fullscreen capture',
        keys: ['CmdOrCtrl+Shift+F', 'CmdOrCtrl+Alt+F'],
        displayCombos: ['Ctrl+Shift+F', 'Ctrl+Alt+F'],
        handler: () => commands.startCapture(),
      },
      {
        name: 'repeat last capture',
        keys: ['CmdOrCtrl+Shift+R', 'CmdOrCtrl+Alt+R'],
        displayCombos: ['Ctrl+Shift+R', 'Ctrl+Alt+R'],
        handler: () => commands.repeatLastCapture(),
      },
    ];

    let cancelled = false;
    const registered: string[] = [];
    const failed: string[] = [];
    const setOverride = useShortcutsRuntimeStore.getState().setGlobalShortcutOverride;
    const clearOverrides = useShortcutsRuntimeStore.getState().clearGlobalShortcutOverrides;

    clearOverrides();

    (async () => {
      for (const shortcut of shortcuts) {
        if (cancelled) break;
        let registeredKey: string | null = null;

        for (const key of shortcut.keys) {
          try {
            await register(key, shortcut.handler);
            registeredKey = key;
            break;
          } catch {
            // Try next fallback combo.
          }
        }

        if (!registeredKey) {
          failed.push(`${shortcut.name} (${shortcut.displayCombos.join(' or ')})`);
          continue;
        }

        // Track first so cleanup can unregister it regardless of timing.
        registered.push(registeredKey);

        if (registeredKey !== shortcut.keys[0]) {
          const idx = shortcut.keys.indexOf(registeredKey);
          if (idx >= 0 && shortcut.displayCombos[idx]) {
            setOverride(shortcut.displayCombos[0], shortcut.displayCombos[idx]);
          }
          warnShortcutIssue(
            `Primary shortcut unavailable for ${shortcut.name}; using fallback ${shortcut.displayCombos[idx] ?? registeredKey} instead of ${shortcut.displayCombos[0]}`,
          );
        }

        // If cleanup ran while we were awaiting, unregister immediately.
        if (cancelled) {
          unregister(registeredKey).catch((e) => {
            // Non-fatal on shutdown; do not surface user-facing errors.
            warnShortcutIssue(`Failed to unregister ${registeredKey}`, e);
          });
        }
      }

      if (failed.length > 0) {
        warnShortcutIssue(`Some global shortcuts are unavailable: ${failed.join('; ')}`);
      }
    })();

    return () => {
      cancelled = true;
      clearOverrides();
      for (const key of registered) {
        unregister(key).catch((e) => {
          // Non-fatal on shutdown; do not surface user-facing errors.
          warnShortcutIssue(`Failed to unregister ${key}`, e);
        });
      }
    };
  }, []);
}
