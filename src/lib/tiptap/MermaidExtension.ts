import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { common, createLowlight } from 'lowlight';
import { MermaidBlock } from '../../components/Editor/MermaidBlock';

const lowlight = createLowlight(common);

/**
 * Extends Tiptap's `CodeBlockLowlight` with a React node view that renders
 * Mermaid diagrams inline when the code block language is "mermaid".
 *
 * Keeps the underlying node type as `codeBlock` so that:
 *   - The existing markdown serializer round-trips ```mermaid blocks without changes.
 *   - Lowlight syntax-highlighting decorations continue to apply for all
 *     other languages (the decoration plugin is inherited unchanged).
 *   - No document migration is required for notes that already contain
 *     ```mermaid fenced blocks.
 */
export const MermaidCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlock);
  },
}).configure({ lowlight });
