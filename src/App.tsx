import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AiDrawer } from './components/Chat/AiDrawer';
import { ErrorToast } from './components/common/ErrorToast';
import { PromptModal } from './components/common/PromptModal';
import { DiagramMode } from './components/diagrams/DiagramMode';
import { EditorPaneGroup } from './components/Editor/EditorPaneGroup';
import { ReferenceModal } from './components/Editor/ReferenceModal';
import { FePrepMode } from './components/fe-prep/FePrepMode';
import { ShortcutHelp } from './components/Help/ShortcutHelp';
import { OcrBanner } from './components/Layout/OcrBanner';
import { StatusBar } from './components/Layout/StatusBar';
import { TitleBar } from './components/Layout/TitleBar';
import { Lightbox } from './components/Lightbox/Lightbox';
import { Onboarding } from './components/Onboarding/Onboarding';
import { QuickSwitcher } from './components/QuickSwitcher/QuickSwitcher';
import { SettingsModal } from './components/Settings/SettingsModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { VaultMode } from './components/vault/VaultMode';

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
import { reportError } from './lib/errorReporter';
import { commands } from './lib/tauri/commands';
import { events } from './lib/tauri/events';
import { useChatStore } from './stores/chatStore';
import { useEditorActionStore } from './stores/editorActionStore';
import { useEditorModalStore } from './stores/editorModalStore';
import { useEditorStore } from './stores/editorStore';
import { useHelpUiStore } from './stores/helpUiStore';
import { useLayoutStore } from './stores/layoutStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { useSettingsStore } from './stores/settingsStore';
import { useSettingsUiStore } from './stores/settingsUiStore';
import { useSplitStore } from './stores/splitStore';
import { useTagsStore } from './stores/tagsStore';
import { useVaultStore } from './stores/vaultStore';

function MainLayout() {
  const isFePrepMode = useLayoutStore((s) => s.isFePrepMode);
  const isVaultMode = useLayoutStore((s) => s.isVaultMode);
  const isDiagramMode = useLayoutStore((s) => s.isDiagramMode);
  const referenceModalOpen = useEditorModalStore((s) => s.referenceModalOpen);

  // True when any full-screen mode is active (hides editor + chat)
  const isFullScreenMode = isFePrepMode || isVaultMode || isDiagramMode;

  useGlobalShortcuts();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        useChatStore.getState().togglePanel();
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
      // Focus mode: F11
      if (e.key === 'F11') {
        e.preventDefault();
        useLayoutStore.getState().toggleFocusMode();
        return;
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
      // New note in current folder (Ctrl+N)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('glyphic:new-note'));
        return;
      }
      // New folder (Ctrl+Shift+N)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('glyphic:new-folder'));
        return;
      }
      // Force-save current note (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('glyphic:force-save'));
        return;
      }
      // Toggle lecture mode (Ctrl+Shift+L)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        useEditorStore.getState().toggleLectureMode();
        return;
      }
      // Insert link (Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        useEditorModalStore.getState().openReferenceModal('link');
        return;
      }
      // Insert backlink (Ctrl+Shift+K)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        useEditorModalStore.getState().openReferenceModal('backlink');
        return;
      }
      // Toggle code block (Ctrl+Shift+E)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        try {
          useEditorActionStore.getState().onToggleCodeBlock();
        } catch (error) {
          reportError({ context: 'Editor code block shortcut', message: 'Unable to toggle code block', error });
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'transparent' }}>
      <TitleBar />
      <OcrBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex min-w-0 overflow-hidden relative">
          {isFePrepMode && <FePrepMode />}
          {isVaultMode && <VaultMode />}
          {isDiagramMode && <DiagramMode />}
          {!isFullScreenMode && <EditorPaneGroup />}
          {!isFullScreenMode && <AiDrawer />}
        </div>
      </div>
      <StatusBar />
      <QuickSwitcher />
      <SettingsModal />
      <ShortcutHelp />
      <Lightbox />
      <Onboarding />
      {referenceModalOpen && <ReferenceModal />}
      <ErrorToast />
      <PromptModal />
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
            reportError({
              context: 'Vault initialization',
              message: 'Stored vault could not be opened; showing onboarding instead',
              error: e,
            });
          }
        }
        // No vault chosen yet (or last one missing): show first-run UX.
        useOnboardingStore.getState().open();
      } catch (e) {
        // Not running in Tauri (e.g., dev browser) — skip vault init.
        reportError({ context: 'Vault initialization', message: 'Vault init skipped (not in Tauri)', error: e });
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
        reportError({ context: 'Vault reindex', message: 'Reindex failed (non-critical)', error: e });
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
          refresh().catch((e) =>
            reportError({ context: 'Vault refresh file tree', message: 'Failed to refresh file tree', error: e }),
          );
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
      <main style={{ minHeight: '100vh' }}>
        <h1
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Glyphic
        </h1>
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="/capture" element={<CaptureOverlay />} />
          <Route path="/print-preview" element={<PrintPreview />} />
        </Routes>
      </main>
    </Suspense>
  );
}
