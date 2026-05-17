import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  FileText,
  GraduationCap,
  Grid2X2,
  Maximize2,
  Menu,
  MessageSquare,
  Minimize2,
  Search,
  Workflow,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useIsMobile } from '../../hooks/useIsMobile';
import { useChatStore } from '../../stores/chatStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useVaultStore } from '../../stores/vaultStore';

export function TitleBar() {
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const openNotes = useVaultStore((s) => s.openNotes);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const removeOpenNote = useVaultStore((s) => s.removeOpenNote);

  const isDirty = useEditorStore((s) => s.isDirty);
  const { isOpen: chatOpen, togglePanel } = useChatStore();

  const {
    toggleSidebar,
    isFocusMode,
    toggleFocusMode,
    isFePrepMode,
    isVaultMode,
    isDiagramMode,
    openFePrep,
    openVaultMode,
    openDiagramMode,
    closeFePrep,
  } = useLayoutStore();

  const [isMaximized, setIsMaximized] = useState(false);
  const isMobile = useIsMobile();

  const appWindow = getCurrentWindow();

  const activeWorkspace = isVaultMode
    ? 'vault'
    : isDiagramMode
    ? 'diagram'
    : isFePrepMode
    ? 'study'
    : 'dashboard';

  const workspaceItems = useMemo(
    () => [
      { key: 'dashboard' as const, label: 'Dashboard', icon: Grid2X2, onClick: closeFePrep },
      { key: 'vault' as const, label: 'Vault', icon: FileText, onClick: openVaultMode },
      { key: 'diagram' as const, label: 'Diagrams', icon: Workflow, onClick: openDiagramMode },
      { key: 'study' as const, label: 'FE Prep', icon: GraduationCap, onClick: openFePrep },
    ],
    [closeFePrep, openVaultMode, openDiagramMode, openFePrep]
  );

  // Window maximize state
  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const isMax = await appWindow.isMaximized();
        setIsMaximized(isMax);
      } catch {
        setIsMaximized(false);
      }
    };

    void checkMaximized();
  }, [appWindow]);

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeOpenNote(path);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex flex-col shrink-0 bg-[#050507] border-b border-zinc-800 shadow-xl"
    >
      {/* Main Title Bar */}
      <div className="h-12 flex items-center px-3 gap-2">
        {/* Window Controls / Mobile Menu */}
        {!isMobile ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => appWindow.minimize()}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <Minimize2 size={15} />
            </button>
            <button
              onClick={() => appWindow.toggleMaximize()}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              onClick={() => appWindow.close()}
              className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button onClick={toggleSidebar} className="p-2 text-zinc-400 hover:text-white">
            <Menu size={20} />
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2 ml-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-inner">
            G
          </div>
          <div className="font-semibold tracking-tighter text-xl text-white">Glyphic</div>
        </div>

        {/* Global Search */}
        {!isMobile && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('glyphic:open-quick-switcher'))}
            className="flex-1 mx-6 h-9 flex items-center gap-3 px-5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-3xl text-sm text-zinc-400 transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            <Search size={17} />
            <span className="flex-1 text-left truncate">Search notes or ask anything...</span>
            <span className="text-xs px-2.5 py-0.5 bg-zinc-800 rounded-lg font-mono text-zinc-500">⌘K</span>
          </button>
        )}

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFocusMode}
            className={`px-4 h-9 flex items-center gap-2 text-sm rounded-2xl transition-all ${
              isFocusMode
                ? 'bg-violet-500/10 text-violet-300 border border-violet-500/30'
                : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden sm:inline">Focus</span>
          </button>

          <button
            onClick={togglePanel}
            className={`px-4 h-9 flex items-center gap-2 text-sm rounded-2xl transition-all ${
              chatOpen
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            <MessageSquare size={17} />
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>
      </div>

      {/* Workspace + Open Note Tabs */}
      <div className="h-11 bg-zinc-900/50 border-t border-zinc-800 flex items-center px-2 gap-1 overflow-x-auto">
        {workspaceItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeWorkspace === item.key;
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`flex items-center gap-2 px-5 h-8 text-sm font-medium rounded-2xl whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-zinc-800 text-white shadow-inner'
                  : 'text-zinc-400 hover:bg-zinc-800/70'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}

        {/* Open Notes Tabs */}
        {openNotes.length > 0 && (
          <div className="flex-1 flex items-center gap-1 ml-6 border-l border-zinc-700 pl-6 overflow-x-auto">
            {openNotes.map((path) => {
              const name = path.replace(/\.md$/, '').split('/').pop() || path;
              const isActive = path === activeNotePath;
              return (
                <div
                  key={path}
                  onClick={() => setActiveNote(path, path)}
                  className={`group flex items-center gap-2 px-4 h-8 rounded-2xl text-sm cursor-pointer transition-all whitespace-nowrap border ${
                    isActive
                      ? 'bg-zinc-800 text-white border-zinc-600'
                      : 'bg-zinc-900/50 text-zinc-400 border-transparent hover:border-zinc-700'
                  }`}
                >
                  <FileText size={14} />
                  <span className="max-w-[160px] truncate">{name}</span>
                  {isDirty && isActive && <span className="text-amber-400 text-xs">•</span>}
                  <button
                    onClick={(e) => handleCloseTab(e, path)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}