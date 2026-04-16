import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { SlashCommandExtension } from './slashCommand';
import { TimestampNode } from './timestampNode';

const lowlight = createLowlight(common);

export function getEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'note-image',
        draggable: 'true',
      },
    }),
    Placeholder.configure({
      placeholder: 'Start typing, or press / for commands...',
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false }),
    Highlight.configure({ multicolor: true }),
    TimestampNode,
    SlashCommandExtension,
  ];
}
