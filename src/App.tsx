import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ChatPanel } from './components/Chat/ChatPanel';
import { EditorPaneGroup } from './components/Editor/EditorPaneGroup';
import { ShortcutHelp } from './components/Help/ShortcutHelp';
import { StatusBar } from './components/Layout/StatusBar';
import { TitleBar } from './components/Layout/TitleBar';
import { Lightbox } from './components/Lightbox/Lightbox';
import { Onboarding } from './components/Onboarding/Onboarding';
import { QuickSwitcher } from './components/QuickSwitcher/QuickSwitcher';
import { SettingsModal } from './components/Settings/SettingsModal';
import { Sidebar } from './components/Sidebar/Sidebar';

// Aux routes that only run inside their own webview windows are lazy-loaded
// so they don't bloat the main bundle.
const CaptureOverlay = lazy(() =>
  import('./components/Capture/CaptureOverlay').then((m) => ({ default: m.CaptureOverlay })),
);
const PrintPreview = lazy(() =>
  import('./components/PrintPreview/PrintPreview').then((m) => ({ default: m.PrintPreview })),
);

import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTheme } from './hooks/useTheme';
import { useVault } from './hooks/useVault';
import { commands } from './lib/tauri/commands';
import { events } from './lib/tauri/events';
import { useChatStore } from './stores/chatStore';
import { useHelpUiStore } from './stores/helpUiStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { useSettingsStore } from './stores/settingsStore';
import { useSettingsUiStore } from './stores/settingsUiStore';
import { useSplitStore } from './stores/splitStore';
import { useTagsStore } from './stores/tagsStore';
import { useVaultStore } from './stores/vaultStore';

function MainLayout() {
  const toggleChatPanel = useChatStore((s) => s.togglePanel);

  useGlobalShortcuts();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        toggleChatPanel();
        return;
      }
      // Split pane: Ctrl+\ → split right, Ctrl+Shift+\ → split down, Ctrl+W → close
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        const activePath = useVaultStore.getState().activeNotePath;
        if (!activePath) return;
        e.preventDefault();
        useSplitStore.getState().openSplit(activePath, e.shiftKey ? 'horizontal' : 'vertical');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'w' || e.key === 'W')) {
        // Only intercept Ctrl+W when there's actually a split open. With no
        // split, fall through to the platform default (close window/tab) so we
        // don't surprise users with a no-op shortcut.
        if (useSplitStore.getState().secondaryNotePath) {
          e.preventDefault();
          useSplitStore.getState().closeSplit();
        }
      }
      // Settings (Ctrl+,)
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        useSettingsUiStore.getState().open('general');
      }
      // Help overlay: Ctrl+? (Shift+/) or Ctrl+/
      if ((e.ctrlKey || e.metaKey) && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        useHelpUiStore.getState().toggle();
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
          <EditorPaneGroup />
          <ChatPanel />
        </main>
      </div>
      <StatusBar />
      <QuickSwitcher />
      <SettingsModal />
      <ShortcutHelp />
      <Lightbox />
      <Onboarding />
    </div>
  );
}

export default function App() {
  const { openVault } = useVault();
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
        // Decide first-launch vs returning user from the user-level state file.
        let recents: string[] = [];
        try {
          recents = await commands.getRecentVaults();
        } catch {
          // Backend unavailable (e.g., dev browser) — treat as first launch.
        }

        const lastVault = recents[0];
        if (lastVault) {
          try {
            await openVault(lastVault);
            useOnboardingStore.setState({ isOpen: false });
            // Bump it back to the front of the recents list.
            try {
              await commands.addRecentVault(lastVault);
            } catch {
              // Non-fatal.
            }
            return;
          } catch (e) {
            // Stored vault is gone or unreadable — fall through to onboarding.
            console.warn('Stored vault could not be opened, showing onboarding:', e);
          }
        }
        // No vault chosen yet (or last one missing): show first-run UX.
        useOnboardingStore.getState().open();
      } catch (e) {
        // Not running in Tauri (e.g., dev browser) — skip vault init.
        console.warn('Vault init skipped (not in Tauri):', e);
        useOnboardingStore.setState({ isOpen: false });
      }
    };
    init();
  }, [isAuxRoute, openVault]);

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
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<MainLayout />} />
        <Route path="/capture" element={<CaptureOverlay />} />
        <Route path="/print-preview" element={<PrintPreview />} />
      </Routes>
    </Suspense>
  );
}
