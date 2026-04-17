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
        gap: '5px',
        overflowX: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Button groups — pill-style groups */}
      {groups.map((group) => (
        <div
          key={`group-${group[0]?.label}`}
          className="flex items-center shrink-0"
          style={{
            gap: '1px',
            padding: '2px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {group.map((btn) => {
            const active = btn.isActive?.() ?? false;
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.label}
                className="rounded transition-colors text-xs font-medium"
                style={{
                  backgroundColor: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  width: isMobile ? '44px' : '28px',
                  height: isMobile ? '44px' : '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0',
                  flexShrink: 0,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
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

      {/* Draw / Ink mode toggle — hero button style */}
      <button
        onClick={toggleInkMode}
        title="Draw Mode"
        className="flex items-center shrink-0 transition-colors"
        style={{
          gap: '5px',
          padding: '5px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          border: '1px solid rgba(91, 141, 240, 0.12)',
          backgroundColor: isInkMode ? 'rgba(91, 141, 240, 0.18)' : 'var(--blue-dim)',
          color: 'var(--blue)',
          minHeight: btnSize,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(91, 141, 240, 0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isInkMode ? 'rgba(91, 141, 240, 0.18)' : 'var(--blue-dim)';
        }}
      >
        <Pencil size={isMobile ? 16 : 13} />
        Draw
      </button>

      <div className="h-5 mx-1 shrink-0" style={{ width: '1px', backgroundColor: 'var(--border)' }} />

      {/* Lecture mode toggle — hero button style */}
      <button
        onClick={toggleLectureMode}
        title="Lecture Mode"
        className="flex items-center shrink-0 transition-colors"
        style={{
          gap: '5px',
          padding: '5px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          backgroundColor: lectureModeActive ? 'var(--green-dim)' : 'var(--green-dim)',
          color: 'var(--green)',
          border: '1px solid rgba(94, 196, 158, 0.15)',
          minHeight: btnSize,
        }}
      >
        <span
          className={lectureModeActive ? 'lecture-pulse' : ''}
          style={{
            display: 'inline-block',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: lectureModeActive ? 'var(--green)' : 'var(--text-tertiary)',
          }}
        />
        {lectureModeActive ? `Lecture — ${getElapsedTime()}` : 'Lecture'}
      </button>

      <div className="h-5 mx-1 shrink-0" style={{ width: '1px', backgroundColor: 'var(--border)' }} />

      {/* Capture button — gradient hero */}
      <button
        onClick={() => commands.startCapture().catch(() => {})}
        title="Capture screenshot (⌘⇧S)"
        className="flex items-center shrink-0 transition-colors"
        style={{
          gap: '5px',
          padding: '5px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          border: 'none',
          background: 'var(--accent-gradient)',
          color: '#fff',
          minHeight: btnSize,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
      >
        <Camera size={isMobile ? 16 : 13} />
        Capture
        {!isMobile && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', opacity: 0.6 }}>⌘⇧S</span>}
      </button>
    </div>
  );
}
