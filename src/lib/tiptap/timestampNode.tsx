import { mergeAttributes, Node, NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { TimestampBadge } from '../../components/LectureMode/TimestampBadge';

/**
 * Custom TipTap inline node for timestamp badges in lecture mode.
 * Renders as a non-editable pill: [05:32]
 * Serializes to markdown as [T:05:32]
 */
export const TimestampNode = Node.create({
  name: 'timestamp',
  group: 'inline',
  inline: true,
  atom: true, // non-editable, deletable with backspace

  addAttributes() {
    return {
      elapsed: {
        default: '00:00',
      },
      absolute: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="timestamp"]',
        getAttrs: (el) => {
          const dom = el as HTMLElement;
          return {
            elapsed: dom.getAttribute('data-elapsed') ?? '00:00',
            absolute: dom.getAttribute('data-absolute') ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'timestamp' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TimestampNodeView);
  },
});

function TimestampNodeView({ node }: ReactNodeViewProps) {
  const elapsed = (node.attrs.elapsed as string) ?? '00:00';
  const absolute = (node.attrs.absolute as string) ?? '';
  return (
    <NodeViewWrapper as="span" className="inline">
      <TimestampBadge elapsed={elapsed} absolute={absolute} />
    </NodeViewWrapper>
  );
}
