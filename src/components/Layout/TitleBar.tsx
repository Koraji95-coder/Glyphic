// TitleBar -- top app chrome.
//
// Rewritten for Phase 2 of the deep-dive UI rewrite. Same features as
// before (window controls, workspace switcher, open-note tabs, search,
// focus + AI toggles) but restyled with the calmer zinc palette and
// smaller rounded radii. No gradient logo, no shadow-inner, no
// violet/cyan accent borders on active states.

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
import { cn } from '../../lib/cn';
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
    [closeFePrep, openVaultMode, openDiagramMode, openFePrep],
  );

  useEffect(() => {
    void appWindow.isMaximized().then(setIsMaximized).catch(() => setIsMaximized(false));
  }, [appWindow]);

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeOpenNote(path);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex shrink-0 flex-col border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md"
    >
      {/* -- Row 1 -- window + brand + search + actions -- */}
      <div className="flex h-12 items-center gap-2 px-3">
        {/* Window controls */}
        {!isMobile ? (
          <div className="flex items-center gap-0.5">
            <WindowButton onClick={() => appWindow.minimize()}>
              <Minimize2 size={14} />
            </WindowButton>
            <WindowButton onClick={() => appWindow.toggleMaximize()}>
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </WindowButton>
            <WindowButton danger onClick={() => appWindow.close()}>
              <X size={14} />
            </WindowButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleSidebar}
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Menu size={18} />
          </button>
        )}

        {/* Brand */}
        <div className="ml-3 flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
            Glyphic
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        </div>

        {/* Global search */}
        {!isMobile && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('glyphic:open-quick-switcher'))}
            className={cn(
              'mx-6 flex h-8 flex-1 items-center gap-2.5 rounded-md border border-zinc-800 bg-zinc-900 px-3.5',
              'text-sm text-zinc-500 transition-colors',
              'hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-300',
            )}
          >
            <Search size={14} />
            <span className="flex-1 truncate text-left">Search notes or ask anything...</span>
            <kbd className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <ToggleButton active={isFocusMode} onClick={toggleFocusMode} label="Focus">
            {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </ToggleButton>
          <ToggleButton active={chatOpen} onClick={togglePanel} label="AI">
            <MessageSquare size={14} />
          </ToggleButton>
        </div>
      </div>

      {/* -- Row 2 -- workspace tabs + open note tabs -- */}
      <div className="flex h-10 items-center gap-1 border-t border-zinc-800 px-2">
        {workspaceItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeWorkspace === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={cn(
                'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
              )}
            >
              <Icon size={13} />
              {item.label}
            </button>
          );
        })}

        {openNotes.length > 0 && (
          <div className="ml-3 flex flex-1 items-center gap-0.5 overflow-x-auto border-l border-zinc-800 pl-3">
            {openNotes.map((path) => {
              const name = path.replace(/\.md$/, '').split('/').pop() || path;
              const isActive = path === activeNotePath;
              return (
                <div
                  key={path}
                  onClick={() => setActiveNote(path, path)}
                  className={cn(
                    'group flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                  )}
                >
                  <FileText size={12} />
                  <span className="max-w-[160px] truncate">{name}</span>
                  {isDirty && isActive && (
                    <span className="text-amber-400" aria-label="Unsaved changes">
                      •
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(e, path)}
                    className="ml-1 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    aria-label={`Close ${name}`}
                  >
                    <X size={12} />
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

// -- Sub-components ----------------------------------------------------

interface WindowButtonProps {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}

function WindowButton({ onClick, danger, children }: WindowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        danger
          ? 'text-zinc-400 hover:bg-red-500/10 hover:text-red-400'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
      )}
    >
      {children}
    </button>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function ToggleButton({ active, onClick, label, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
        active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}