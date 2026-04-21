import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useEffect } from 'react';
import { commands } from '../lib/tauri/commands';

export function useGlobalShortcuts() {
  useEffect(() => {
    const shortcuts: Array<[string, () => Promise<unknown>]> = [
      ['CmdOrCtrl+Shift+S', () => commands.startCapture()],
      ['CmdOrCtrl+Shift+F', () => commands.startCapture()],
      ['CmdOrCtrl+Shift+R', () => commands.repeatLastCapture()],
    ];
    const registered: string[] = [];
    (async () => {
      for (const [key, handler] of shortcuts) {
        try {
          await register(key, handler);
          registered.push(key);
        } catch (e) {
          // Non-fatal: the OS may have the combo bound to something else,
          // or we're not running inside Tauri (dev browser).
          console.warn(`Failed to register ${key}:`, e);
        }
      }
    })();

    return () => {
      for (const key of registered) {
        unregister(key).catch(() => {});
      }
    };
  }, []);
}
