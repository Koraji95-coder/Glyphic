import type { JSONContent } from '@tiptap/react';

export function serializeToMarkdown(doc: JSONContent): string {
  if (!doc.content) return '';
  return doc.content.map((node) => serializeNode(node, 0)).join('\n\n');
}

/**
 * Serialize a node. `depth` is the list-nesting depth (0 = top-level), used so
 * nested bullet/ordered/task lists round-trip with two-space indentation per
 * level (CommonMark convention).
 */
function serializeNode(node: JSONContent, depth: number): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content || []);
    case 'heading': {
      const level = node.attrs?.level || 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${serializeInline(node.content || [])}`;
    }
    case 'bulletList':
      return serializeList(node, depth, (_item, _i) => '- ');
    case 'orderedList': {
      const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1;
      return serializeList(node, depth, (_item, i) => `${start + i}. `);
    }
    case 'taskList':
      return serializeList(node, depth, (item) => {
        const checked = item.attrs?.checked ? 'x' : ' ';
        return `- [${checked}] `;
      });
    case 'listItem':
    case 'taskItem':
      // listItem/taskItem children are joined with single newlines; nested
      // lists handle their own indentation.
      return (node.content || []).map((n) => serializeNode(n, depth)).join('\n');
    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      const code = node.content?.map((n) => n.text || '').join('') || '';
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'blockquote': {
      // Render inner content first, then prefix every output line with `> `
      // so multi-line blockquotes (paragraphs, nested lists, hard breaks)
      // keep the marker on every line per CommonMark.
      const inner = (node.content || []).map((n) => serializeNode(n, depth)).join('\n\n');
      return inner
        .split('\n')
        .map((line) => (line.length > 0 ? `> ${line}` : '>'))
        .join('\n');
    }
    case 'horizontalRule':
      return '---';
    case 'hardBreak':
      // Markdown hard line break: two trailing spaces + newline.
      return '  \n';
    case 'image': {
      const src = node.attrs?.src || '';
      const alt = node.attrs?.alt || '';
      return `![${alt}](${src})`;
    }
    case 'timestamp': {
      const elapsed = node.attrs?.elapsed || '00:00';
      return `[T:${elapsed}]`;
    }
    default:
      return serializeInline(node.content || []);
  }
}

/**
 * Serialize a list-like node (bulletList, orderedList, taskList). Each item's
 * first content block gets the marker (e.g. `- `, `1. `, `- [ ] `); subsequent
 * blocks (nested lists, additional paragraphs) are indented to align under it.
 *
 * Indentation comes purely from the parent item's marker padding propagating
 * down — `serializeList` itself doesn't add depth-based indent, so nested
 * lists end up indented by exactly one marker-width per level (CommonMark).
 */
function serializeList(node: JSONContent, depth: number, marker: (item: JSONContent, index: number) => string): string {
  const items = node.content || [];
  return items
    .map((item, i) => {
      const m = marker(item, i);
      const childIndent = ' '.repeat(m.length);
      const blocks = (item.content || []).map((child) => serializeNode(child, depth + 1));
      // Join blocks within an item with single newlines so nested lists hug
      // the parent item rather than creating a paragraph break.
      const body = blocks.join('\n');
      const lines = body.split('\n');
      return lines
        .map((line, idx) => {
          if (idx === 0) return `${m}${line}`;
          return `${childIndent}${line}`;
        })
        .join('\n');
    })
    .join('\n');
}

function serializeInline(nodes: JSONContent[]): string {
  return nodes
    .map((node) => {
      // Inline hard break (TipTap can put hardBreak inside paragraph content).
      if (node.type === 'hardBreak') return '  \n';
      let text = node.text || '';
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'bold':
              text = `**${text}**`;
              break;
            case 'italic':
              text = `*${text}*`;
              break;
            case 'code':
              text = `\`${text}\``;
              break;
            case 'link':
              text = `[${text}](${mark.attrs?.href || ''})`;
              break;
            case 'highlight':
              text = `==${text}==`;
              break;
          }
        }
      }
      return text;
    })
    .join('');
}
