import { THEME_OPTIONS, useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { useVaultStore } from '../../stores/vaultStore';

export function ThemeSwitcher() {
  const { theme, applyTheme } = useTheme();
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const handleThemeChange = async (value: string) => {
    applyTheme(value as Parameters<typeof applyTheme>[0]);

    if (vaultPath && settings) {
      try {
        await updateSettings(vaultPath, {
          ...settings,
          appearance: { ...settings.appearance, theme: value as typeof settings.appearance.theme },
        });
      } catch {
        // Settings persistence may fail outside Tauri — theme is still applied in DOM
      }
    }
  };

  return (
    <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-3xl p-1 gap-1">
      {THEME_OPTIONS.map((opt) => {
        const isActive =
          theme === opt.value || (opt.value === 'indigo' && (theme === 'dark' || theme === 'system'));

        return (
          <button
            key={opt.value}
            onClick={() => handleThemeChange(opt.value)}
            title={opt.label}
            className={`w-7 h-7 rounded-2xl flex items-center justify-center transition-all hover:scale-110 ${
              isActive ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-zinc-900' : ''
            }`}
            style={{ background: opt.color }}
          />
        );
      })}
    </div>
  );
}