import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CaptureOverlay } from './components/Capture/CaptureOverlay';
import { ChatPanel } from './components/Chat/ChatPanel';
import { Editor } from './components/Editor/Editor';
import { StatusBar } from './components/Layout/StatusBar';
import { TitleBar } from './components/Layout/TitleBar';
import { QuickSwitcher } from './components/QuickSwitcher/QuickSwitcher';
import { Sidebar } from './components/Sidebar/Sidebar';
import { useTheme } from './hooks/useTheme';
import { useVault } from './hooks/useVault';
import { commands } from './lib/tauri/commands';
import { useChatStore } from './stores/chatStore';
import { useSettingsStore } from './stores/settingsStore';
import { useVaultStore } from './stores/vaultStore';

function MainLayout() {
  const toggleChatPanel = useChatStore((s) => s.togglePanel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        toggleChatPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleChatPanel]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-app)' }}>
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 flex min-w-0 overflow-hidden">
          <Editor />
          <ChatPanel />
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
  const vaultPath = useVaultStore((s) => s.vaultPath);

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

  // Reindex vault for FTS5 search on vault open
  useEffect(() => {
    if (!vaultPath) return;
    commands.reindexVault(vaultPath).catch((e) => {
      console.warn('Reindex failed (non-critical):', e);
    });
  }, [vaultPath]);

  useEffect(() => {
    const theme = settings?.appearance?.theme ?? 'system';
    applyTheme(theme as Parameters<typeof applyTheme>[0]);
  }, [settings?.appearance?.theme, applyTheme]);

  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/capture" element={<CaptureOverlay />} />
    </Routes>
  );
}
