import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useEffect } from 'react';
import { commands } from '../lib/tauri/commands';

export function useGlobalShortcuts() {
  useEffect(() => {
    const shortcuts: Array<[string, () => Promise<unknown>]> = [
      ['CmdOrCtrl+Shift+S', () => commands.startCapture()],
      // CmdOrCtrl+Shift+F also opens the capture overlay; the overlay's
      // fullscreen-mode logic immediately captures the whole screen without
      // requiring the user to draw a region.
      ['CmdOrCtrl+Shift+F', () => commands.startCapture()],
      ['CmdOrCtrl+Shift+R', () => commands.repeatLastCapture()],
    ];

    let cancelled = false;
    const registered: string[] = [];

    (async () => {
      for (const [key, handler] of shortcuts) {
        if (cancelled) break;
        try {
          await register(key, handler);
          if (cancelled) {
            // Cleanup already ran — unregister the shortcut we just registered.
            unregister(key).catch(() => {});
          } else {
            registered.push(key);
          }
        } catch (e) {
          // Non-fatal: the OS may have the combo bound to something else,
          // or we're not running inside Tauri (dev browser).
          console.warn(`Failed to register ${key}:`, e);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const key of registered) {
        unregister(key).catch(() => {});
      }
    };
  }, []);
}
