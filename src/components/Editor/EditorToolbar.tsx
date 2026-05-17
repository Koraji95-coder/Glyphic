import type { Editor } from '@tiptap/react';
import type { LucideIcon } from 'lucide-react';
import {
  Bold,
  Camera,
  Code,
  Download,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListChecks,
  Pencil,
  Strikethrough,
} from 'lucide-react';
import { useState } from 'react';

import { useIsMobile } from '../../hooks/useIsMobile';
import { useLectureMode } from '../../hooks/useLectureMode';
import { reportError } from '../../lib/errorReporter';
import { exportNoteToPdf, suggestPdfFileName } from '../../lib/export/pdfExport';
import { commands } from '../../lib/tauri/commands';
import { useLayoutStore } from '../../stores/layoutStore';
import { useVaultStore } from '../../stores/vaultStore';

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarButton {
  icon: LucideIcon;
  label: string;
  action: () => void;
  isActive?: () => boolean;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { lectureModeActive, toggleLectureMode, getElapsedTime } = useLectureMode();
  const isMobile = useIsMobile();
  const { isInkMode, toggleInkMode } = useLayoutStore();
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  if (!editor) return null;

  const handleExportMarkdown = async () => {
    setExportMenuOpen(false);
    if (!vaultPath || !activeNotePath) {
      setExportStatus('Open a note first');
      setTimeout(() => setExportStatus(null), 3000);
      return;
    }
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const defaultName = activeNotePath.split('/').pop() ?? 'note.md';
      const target = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!target) return;
      await commands.exportMarkdown(vaultPath, activeNotePath, target);
      setExportStatus('Exported');
      setTimeout(() => setExportStatus(null), 2000);
    } catch (e) {
      reportError({ context: 'Markdown export', message: 'Export failed', error: e });
      setExportStatus(`Export failed: ${e}`);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleExportPdf = async () => {
    setExportMenuOpen(false);
    if (!vaultPath || !activeNotePath) {
      setExportStatus('Open a note first');
      setTimeout(() => setExportStatus(null), 3000);
      return;
    }
    try {
      await exportNoteToPdf({
        vaultPath,
        notePath: activeNotePath,
        suggestedFileName: suggestPdfFileName(activeNotePath),
      });
    } catch (e) {
      reportError({ context: 'PDF export', message: 'Export failed', error: e });
      setExportStatus(`PDF export failed: ${e}`);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const btnSize = isMobile ? '44px' : undefined;
  const iconSize = isMobile ? 18 : 15;

  const groups: ToolbarButton[][] = [
    [
      {
        icon: Bold,
        label: 'Bold',
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive('bold'),
      },
      {
        icon: Italic,
        label: 'Italic',
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive('italic'),
      },
      {
        icon: Strikethrough,
        label: 'Strikethrough',
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive('strike'),
      },
      {
        icon: Code,
        label: 'Inline Code',
        action: () => editor.chain().focus().toggleCode().run(),
        isActive: () => editor.isActive('code'),
      },
    ],
    [
      {
        icon: Heading1,
        label: 'H1',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive('heading', { level: 1 }),
      },
      {
        icon: Heading2,
        label: 'H2',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive('heading', { level: 2 }),
      },
      {
        icon: Heading3,
        label: 'H3',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive('heading', { level: 3 }),
      },
    ],
    [
      {
        icon: List,
        label: 'Bullet List',
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList'),
      },
      {
        icon: ListChecks,
        label: 'Task List',
        action: () => editor.chain().focus().toggleTaskList().run(),
        isActive: () => editor.isActive('taskList'),
      },
      {
        icon: Highlighter,
        label: 'Highlight',
        action: () => editor.chain().focus().toggleHighlight().run(),
        isActive: () => editor.isActive('highlight'),
      },
    ],
  ];

  return (
    <div className="flex items-center shrink-0 h-12 bg-zinc-950 border-b border-zinc-800 px-4 gap-2">
      <div className="flex items-center flex-1 min-w-0 gap-1 overflow-x-auto">
        {groups.map((group) => (
          <div
            key={`group-${group[0]?.label}`}
            className="flex items-center shrink-0 gap-px p-1 bg-zinc-900/70 border border-zinc-700 rounded-lg"
          >
            {group.map((btn) => {
              const active = btn.isActive?.() ?? false;
              const Icon = btn.icon;
              return (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  title={btn.label}
                  className={`flex items-center justify-center rounded-md transition-all ${
                    active ? 'bg-blue-500/10 text-blue-300' : 'hover:bg-zinc-800 text-zinc-400'
                  }`}
                  style={{
                    width: isMobile ? '44px' : '32px',
                    height: isMobile ? '44px' : '32px',
                  }}
                >
                  <Icon size={iconSize} />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center shrink-0 gap-2">
        {/* Ink Mode */}
        <button
          onClick={toggleInkMode}
          className={`flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium transition-all ${
            isInkMode ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30' : 'hover:bg-zinc-800 text-zinc-400'
          }`}
        >
          <Pencil size={16} />
          Draw
        </button>

        {/* Lecture Mode */}
        <button
          onClick={toggleLectureMode}
          className={`flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium transition-all ${
            lectureModeActive
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'hover:bg-zinc-800 text-zinc-400'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Lecture
          {lectureModeActive && <span className="font-mono text-xs">{getElapsedTime()}</span>}
        </button>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium hover:bg-zinc-800 text-zinc-400 transition-all"
          >
            <Download size={16} />
            Export
          </button>

          {exportMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-2 z-50">
              <button
                onClick={handleExportMarkdown}
                className="w-full px-5 py-3 text-left hover:bg-zinc-800 text-sm text-zinc-200"
              >
                Export as Markdown
              </button>
              <button
                onClick={handleExportPdf}
                className="w-full px-5 py-3 text-left hover:bg-zinc-800 text-sm text-zinc-200"
              >
                Export as PDF
              </button>
            </div>
          )}
        </div>

        {/* Capture Button */}
        <button
          onClick={() =>
            commands.startCapture().catch((e) => {
              reportError({ context: 'Capture', message: 'Failed to start capture', error: e });
            })
          }
          className="flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-gradient-to-r from-violet-500 to-cyan-400 text-white shadow-lg hover:brightness-110 transition-all"
        >
          <Camera size={16} />
          Capture
        </button>
      </div>
    </div>
  );
}