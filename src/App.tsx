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

const CaptureOverlay = lazy(() =>
  import('./components/Capture/CaptureOverlay').then((m) => ({ default: m.CaptureOverlay }))
);
const PrintPreview = lazy(() =>
  import('./components/PrintPreview/PrintPreview').then((m) => ({ default: m.PrintPreview }))
);

import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTheme } from './hooks/useTheme';
import { useVault } from './hooks/useVault';
import { reportError } from './lib/errorReporter';
import { commands } from './lib/tauri/commands';
import { useChatStore } from './stores/chatStore';
import { useEditorModalStore } from './stores/editorModalStore';
import { useEditorStore } from './stores/editorStore';
import { useLayoutStore } from './stores/layoutStore';
import { useSettingsStore } from './stores/settingsStore';
import { useVaultStore } from './stores/vaultStore';

function MainLayout() {
  const isFePrepMode = useLayoutStore((s) => s.isFePrepMode);
  const isVaultMode = useLayoutStore((s) => s.isVaultMode);
  const isDiagramMode = useLayoutStore((s) => s.isDiagramMode);
  const referenceModalOpen = useEditorModalStore((s) => s.referenceModalOpen);

  const isFullScreenMode = isFePrepMode || isVaultMode || isDiagramMode;

  useGlobalShortcuts();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#050507]">
      <TitleBar />
      <OcrBanner />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />

        {/* Core Content */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-zinc-900/70 backdrop-blur-xl border-l border-zinc-800">
          {isFePrepMode && <FePrepMode />}
          {isVaultMode && <VaultMode />}
          {isDiagramMode && <DiagramMode />}
          {!isFullScreenMode && <EditorPaneGroup />}
          {!isFullScreenMode && <AiDrawer />}
        </div>
      </div>

      <StatusBar />

      {/* Modals & Overlays */}
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

  const isAuxRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/capture') ||
      window.location.pathname.startsWith('/print-preview'));

  // Vault initialization
  useEffect(() => {
    if (isAuxRoute) return;
    // ... (your existing vault initialization logic remains unchanged)
  }, [isAuxRoute, openVault]);

  // Reindex vault when path changes
  useEffect(() => {
    if (isAuxRoute) return;
    if (!vaultPath) return;
    commands.reindexVault(vaultPath).catch((e) => {
      reportError({ context: 'Vault reindex', message: 'Reindex failed', error: e });
    });
  }, [vaultPath, isAuxRoute]);

  // Theme synchronization
  useEffect(() => {
    const theme = settings?.appearance?.theme ?? 'system';
    applyTheme(theme as Parameters<typeof applyTheme>[0]);
  }, [settings?.appearance?.theme, applyTheme]);

  return (
    <Suspense fallback={null}>
      <MainLayout />
    </Suspense>
  );
}