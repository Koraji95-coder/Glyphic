import { useCallback, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/** Accent theme names that only swap the accent color (dark background). */
export type AccentTheme = 'indigo' | 'emerald' | 'amber' | 'rose';

/** All possible theme values stored in settings. */
export type ThemeValue = 'light' | 'dark' | 'system' | AccentTheme;

/** Ordered list of selectable themes for the theme switcher UI. */
export const THEME_OPTIONS: { value: ThemeValue; label: string; color: string }[] = [
  { value: 'indigo', label: 'Indigo', color: '#7c6df0' },
  { value: 'emerald', label: 'Emerald', color: '#3dd68c' },
  { value: 'amber', label: 'Amber', color: '#e0a050' },
  { value: 'rose', label: 'Rose', color: '#e06088' },
  { value: 'light', label: 'Light', color: 'linear-gradient(135deg, #fff 50%, #ddd 50%)' },
];

export function useTheme() {
  const settings = useSettingsStore((s) => s.settings);
  const theme = (settings?.appearance?.theme as ThemeValue) || 'system';

  const applyTheme = useCallback((t: ThemeValue) => {
    const root = document.documentElement;

    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      // System maps to default indigo dark or light
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else if (t === 'dark' || t === 'indigo') {
      // Default dark theme = indigo accent, no data-theme needed (uses :root)
      root.removeAttribute('data-theme');
    } else {
      // 'light', 'emerald', 'amber', 'rose'
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
