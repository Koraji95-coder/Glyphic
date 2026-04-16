import type { Editor, Range } from '@tiptap/react';
import { Extension } from '@tiptap/react';
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from '@tiptap/suggestion';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SlashCommandMenu } from '../../components/Editor/SlashCommand/SlashCommandMenu';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: Editor; range: Range }) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: '•',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Ordered List',
    description: 'Create a numbered list',
    icon: '1.',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Create a to-do list with checkboxes',
    icon: '☑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Insert a code block with syntax highlighting',
    icon: '</>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Blockquote',
    description: 'Insert a quote block',
    icon: '❝',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Divider',
    description: 'Insert a horizontal rule',
    icon: '—',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Image',
    description: 'Insert an image from URL',
    icon: '🖼',
    command: ({ editor, range }) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
  {
    title: 'Timestamp',
    description: 'Insert current timestamp',
    icon: '🕐',
    command: ({ editor, range }) => {
      const now = new Date();
      const hours = now.getHours();
      const mins = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h = hours % 12 || 12;
      const absolute = `${h}:${String(mins).padStart(2, '0')} ${ampm}`;
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'timestamp',
          attrs: { elapsed: '00:00', absolute },
        })
        .run();
    },
  },
];

function createSlashCommandRenderer() {
  let root: Root | null = null;
  let popup: HTMLDivElement | null = null;

  return {
    onStart: (props: SuggestionProps<SlashCommandItem>) => {
      popup = document.createElement('div');
      popup.style.position = 'absolute';
      popup.style.zIndex = '100';
      document.body.appendChild(popup);
      root = createRoot(popup);

      const { clientRect } = props;
      if (clientRect) {
        const rect = clientRect();
        if (rect) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 4}px`;
        }
      }

      root.render(
        createElement(SlashCommandMenu, {
          items: props.items,
          command: (item: SlashCommandItem) => props.command(item),
        }),
      );
    },

    onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
      if (!root || !popup) return;

      const { clientRect } = props;
      if (clientRect) {
        const rect = clientRect();
        if (rect) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 4}px`;
        }
      }

      root.render(
        createElement(SlashCommandMenu, {
          items: props.items,
          command: (item: SlashCommandItem) => props.command(item),
        }),
      );
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === 'Escape') {
        if (popup) {
          root?.unmount();
          popup.remove();
          popup = null;
          root = null;
        }
        return true;
      }
      // Let the SlashCommandMenu handle arrow/enter keys via document listener
      return false;
    },

    onExit: () => {
      root?.unmount();
      if (popup) {
        popup.remove();
      }
      popup = null;
      root = null;
    },
  };
}

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          props.command({ editor, range });
        },
        items: ({ query }: { query: string }) => {
          return SLASH_COMMANDS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
        },
        render: createSlashCommandRenderer,
      } satisfies Partial<SuggestionOptions<SlashCommandItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
