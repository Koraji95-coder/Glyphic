import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useVault } from './hooks/useVault';
import { useTheme } from './hooks/useTheme';
import { useSettingsStore } from './stores/settingsStore';
import { TitleBar } from './components/Layout/TitleBar';
import { StatusBar } from './components/Layout/StatusBar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Editor } from './components/Editor/Editor';
import { CaptureOverlay } from './components/Capture/CaptureOverlay';
import { QuickSwitcher } from './components/QuickSwitcher/QuickSwitcher';

function MainLayout() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Editor />
        </main>
      </div>
      <StatusBar />
      <QuickSwitcher />
    </div>
  );
}

export default function App() {
  const { openVault, createVault } = useVault();
  const { applyTheme } = useTheme();
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    const init = async () => {
      try {
        const { homeDir } = await import('@tauri-apps/api/path');
        const home = await homeDir();
        const defaultPath = `${home}Glyphic`;
        try {
          await openVault(defaultPath);
        } catch {
          try {
            await createVault(defaultPath, 'Glyphic');
          } catch (e) {
            console.error('Failed to initialize vault:', e);
          }
        }
      } catch (e) {
        // Not running in Tauri (e.g., dev browser) — skip vault init
        console.warn('Vault init skipped (not in Tauri):', e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const theme = settings?.appearance?.theme ?? 'system';
    applyTheme(theme);
  }, [settings?.appearance?.theme, applyTheme]);

  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/capture" element={<CaptureOverlay />} />
    </Routes>
  );
}
