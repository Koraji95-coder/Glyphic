import type { Editor } from '@tiptap/react';
import type { LucideIcon } from 'lucide-react';
import { useLectureMode } from '../../hooks/useLectureMode';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  CodeSquare,
  Quote,
  Minus,
  Link,
  Image,
  Undo2,
  Redo2,
  Presentation,
} from 'lucide-react';

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
  const { lectureModeActive, toggleLectureMode } = useLectureMode();

  if (!editor) return null;

  const groups: ToolbarButton[][] = [
    // Text formatting
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
      {
        icon: Highlighter,
        label: 'Highlight',
        action: () => editor.chain().focus().toggleHighlight().run(),
        isActive: () => editor.isActive('highlight'),
      },
    ],
    // Headings
    [
      {
        icon: Heading1,
        label: 'Heading 1',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive('heading', { level: 1 }),
      },
      {
        icon: Heading2,
        label: 'Heading 2',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive('heading', { level: 2 }),
      },
      {
        icon: Heading3,
        label: 'Heading 3',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive('heading', { level: 3 }),
      },
    ],
    // Lists
    [
      {
        icon: List,
        label: 'Bullet List',
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList'),
      },
      {
        icon: ListOrdered,
        label: 'Ordered List',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive('orderedList'),
      },
      {
        icon: ListChecks,
        label: 'Task List',
        action: () => editor.chain().focus().toggleTaskList().run(),
        isActive: () => editor.isActive('taskList'),
      },
    ],
    // Blocks
    [
      {
        icon: CodeSquare,
        label: 'Code Block',
        action: () => editor.chain().focus().toggleCodeBlock().run(),
        isActive: () => editor.isActive('codeBlock'),
      },
      {
        icon: Quote,
        label: 'Blockquote',
        action: () => editor.chain().focus().toggleBlockquote().run(),
        isActive: () => editor.isActive('blockquote'),
      },
      {
        icon: Minus,
        label: 'Horizontal Rule',
        action: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ],
    // Media
    [
      {
        icon: Link,
        label: 'Link',
        action: () => {
          const url = window.prompt('Enter URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        },
        isActive: () => editor.isActive('link'),
      },
      {
        icon: Image,
        label: 'Image',
        action: () => {
          const url = window.prompt('Enter image URL:');
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        },
      },
    ],
    // History
    [
      {
        icon: Undo2,
        label: 'Undo',
        action: () => editor.chain().focus().undo().run(),
      },
      {
        icon: Redo2,
        label: 'Redo',
        action: () => editor.chain().focus().redo().run(),
      },
    ],
  ];

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-1.5 shrink-0 flex-wrap"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && (
            <div
              className="w-px h-5 mx-1"
              style={{ backgroundColor: 'var(--border)' }}
            />
          )}
          {group.map((btn) => {
            const active = btn.isActive?.() ?? false;
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.label}
                className="p-1.5 rounded transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-muted)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = active
                    ? 'var(--accent-muted)'
                    : 'transparent';
                }}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      ))}

      {/* Lecture mode toggle */}
      <div
        className="w-px h-5 mx-1"
        style={{ backgroundColor: 'var(--border)' }}
      />
      <button
        onClick={toggleLectureMode}
        title="Lecture Mode"
        className="p-1.5 rounded transition-colors"
        style={{
          backgroundColor: lectureModeActive ? 'var(--accent-muted)' : 'transparent',
          color: lectureModeActive ? 'var(--accent)' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          if (!lectureModeActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = lectureModeActive
            ? 'var(--accent-muted)'
            : 'transparent';
        }}
      >
        <Presentation size={16} />
      </button>
    </div>
  );
}
