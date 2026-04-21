import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CaptureOverlay } from './components/Capture/CaptureOverlay';
import { ChatPanel } from './components/Chat/ChatPanel';
import { Editor } from './components/Editor/Editor';
import { StatusBar } from './components/Layout/StatusBar';
import { TitleBar } from './components/Layout/TitleBar';
import { PrintPreview } from './components/PrintPreview/PrintPreview';
import { QuickSwitcher } from './components/QuickSwitcher/QuickSwitcher';
import { Sidebar } from './components/Sidebar/Sidebar';
import { useTheme } from './hooks/useTheme';
import { useVault } from './hooks/useVault';
import { commands } from './lib/tauri/commands';
import { events } from './lib/tauri/events';
import { useChatStore } from './stores/chatStore';
import { useSettingsStore } from './stores/settingsStore';
import { useTagsStore } from './stores/tagsStore';
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

  // Skip the heavy vault init/reindex/watcher work when this webview is
  // serving a transient route (capture overlay, print preview) — those
  // windows just need their route component to mount.
  const isAuxRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/capture') || window.location.pathname.startsWith('/print-preview'));

  useEffect(() => {
    if (isAuxRoute) return;
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
  }, [isAuxRoute]);

  // Reindex vault for FTS5 search on vault open
  useEffect(() => {
    if (isAuxRoute) return;
    if (!vaultPath) return;
    commands
      .reindexVault(vaultPath)
      .then(() => {
        // Tags table is derived from the indexed `notes` rows, so refresh
        // after every reindex to surface tags from existing notes on launch.
        void useTagsStore.getState().refreshTags();
      })
      .catch((e) => {
        console.warn('Reindex failed (non-critical):', e);
      });
  }, [vaultPath, isAuxRoute]);

  // Refresh the sidebar tree when files change on disk (external editors,
  // sync clients, capture saves, etc.).
  useEffect(() => {
    if (isAuxRoute) return;
    if (!vaultPath) return;
    let cleanup: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = useVaultStore.getState().refreshFileTree;
    events
      .onVaultChanged(() => {
        // Coalesce bursts of FS events into a single tree refresh.
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          refresh().catch((e) => console.warn('refreshFileTree failed:', e));
          // Tags may have changed too (frontmatter edits, new files, etc.).
          void useTagsStore.getState().refreshTags();
        }, 250);
      })
      .then((unlisten) => {
        cleanup = unlisten;
      })
      .catch(() => {
        // Not running in Tauri (e.g., dev browser) — listener is unavailable.
      });
    return () => {
      if (timer) clearTimeout(timer);
      cleanup?.();
    };
  }, [vaultPath, isAuxRoute]);

  useEffect(() => {
    const theme = settings?.appearance?.theme ?? 'system';
    applyTheme(theme as Parameters<typeof applyTheme>[0]);
  }, [settings?.appearance?.theme, applyTheme]);

  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/capture" element={<CaptureOverlay />} />
      <Route path="/print-preview" element={<PrintPreview />} />
    </Routes>
  );
}
