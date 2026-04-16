import { useCallback, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useTheme() {
  const settings = useSettingsStore((s) => s.settings);
  const theme = settings?.appearance?.theme || 'system';

  const applyTheme = useCallback((t: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', t);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, applyTheme]);

  return { theme, applyTheme };
}
