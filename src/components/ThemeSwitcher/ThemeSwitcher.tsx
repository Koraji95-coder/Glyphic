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
        // Settings persistence may fail outside Tauri — theme still applied in DOM
      }
    }
  };

  return (
    <div
      className="flex items-center"
      style={{
        gap: '5px',
        padding: '4px 8px',
        borderRadius: '999px',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      {THEME_OPTIONS.map((opt) => {
        // Match the current theme; default dark matches 'indigo'
        const isActive = theme === opt.value || (opt.value === 'indigo' && (theme === 'dark' || theme === 'system'));
        return (
          <button
            key={opt.value}
            onClick={() => handleThemeChange(opt.value)}
            title={opt.label}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
              background: opt.color,
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
