import type { Editor } from '@tiptap/react';
import type { LucideIcon } from 'lucide-react';
import {
  Bold,
  Camera,
  Code,
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
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLectureMode } from '../../hooks/useLectureMode';
import { commands } from '../../lib/tauri/commands';
import { useLayoutStore } from '../../stores/layoutStore';

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

  if (!editor) return null;

  // On mobile, use minimum 44px touch targets per Apple HIG
  const btnSize = isMobile ? '44px' : undefined;
  const iconSize = isMobile ? 18 : 15;

  const groups: ToolbarButton[][] = [
    // Formatting
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
    // Headings
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
    // Lists + highlight
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
    <div
      className="flex items-center shrink-0"
      style={{
        height: isMobile ? '52px' : 'var(--toolbar-height)',
        backgroundColor: 'var(--bg-editor)',
        borderBottom: '1px solid var(--border)',
        paddingLeft: '12px',
        paddingRight: '12px',
        gap: '4px',
        overflowX: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Button groups */}
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center shrink-0" style={{ gap: '2px' }}>
          {gi > 0 && <div className="h-5 mx-1.5" style={{ width: '1px', backgroundColor: 'var(--border)' }} />}
          {group.map((btn) => {
            const active = btn.isActive?.() ?? false;
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.label}
                className="touch-target rounded transition-colors text-xs font-medium"
                style={{
                  backgroundColor: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  minWidth: btnSize,
                  minHeight: btnSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: isMobile ? '0' : '6px',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = active ? 'var(--accent-dim)' : 'transparent';
                }}
              >
                <Icon size={iconSize} />
              </button>
            );
          })}
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1 shrink-0" style={{ minWidth: '8px' }} />

      {/* Draw / Ink mode toggle — shown on touch devices or when pen is detected */}
      <button
        onClick={toggleInkMode}
        title="Draw Mode"
        className="touch-target rounded transition-colors shrink-0"
        style={{
          backgroundColor: isInkMode ? 'var(--accent-dim)' : 'transparent',
          color: isInkMode ? 'var(--accent)' : 'var(--text-secondary)',
          minWidth: btnSize,
          minHeight: btnSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '0' : '6px',
        }}
        onMouseEnter={(e) => {
          if (!isInkMode) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isInkMode ? 'var(--accent-dim)' : 'transparent';
        }}
      >
        <Pencil size={iconSize} />
      </button>

      <div className="h-5 mx-1.5 shrink-0" style={{ width: '1px', backgroundColor: 'var(--border)' }} />

      {/* Lecture mode toggle */}
      <button
        onClick={toggleLectureMode}
        title="Lecture Mode"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors shrink-0"
        style={{
          backgroundColor: lectureModeActive ? 'var(--green-dim)' : 'transparent',
          color: lectureModeActive ? 'var(--green)' : 'var(--text-secondary)',
          border: lectureModeActive ? '1px solid rgba(126,200,155,0.2)' : '1px solid transparent',
          minHeight: btnSize,
        }}
      >
        <span
          className={lectureModeActive ? 'lecture-pulse' : ''}
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: lectureModeActive ? 'var(--green)' : 'var(--text-tertiary)',
          }}
        />
        {lectureModeActive ? `Lecture — ${getElapsedTime()}` : 'Lecture'}
      </button>

      <div className="h-5 mx-1.5 shrink-0" style={{ width: '1px', backgroundColor: 'var(--border)' }} />

      {/* Capture button */}
      <button
        onClick={() => commands.startCapture().catch(() => {})}
        title="Capture screenshot (⌘⇧S)"
        className="touch-target flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors shrink-0"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--bg-app)',
          minHeight: btnSize,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
      >
        <Camera size={isMobile ? 16 : 13} />
        Capture
        {!isMobile && (
          <span className="text-xs opacity-60" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
            ⌘⇧S
          </span>
        )}
      </button>
    </div>
  );
}
