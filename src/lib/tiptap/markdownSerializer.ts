import { JSONContent } from '@tiptap/react';

export function serializeToMarkdown(doc: JSONContent): string {
  if (!doc.content) return '';
  return doc.content.map((node) => serializeNode(node)).join('\n\n');
}

function serializeNode(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content || []);
    case 'heading': {
      const level = node.attrs?.level || 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${serializeInline(node.content || [])}`;
    }
    case 'bulletList':
      return (node.content || []).map((item) => `- ${serializeNode(item)}`).join('\n');
    case 'orderedList':
      return (node.content || []).map((item, i) => `${i + 1}. ${serializeNode(item)}`).join('\n');
    case 'listItem':
      return (node.content || []).map((n) => serializeNode(n)).join('\n');
    case 'taskList':
      return (node.content || [])
        .map((item) => {
          const checked = item.attrs?.checked ? 'x' : ' ';
          return `- [${checked}] ${serializeNode(item)}`;
        })
        .join('\n');
    case 'taskItem':
      return (node.content || []).map((n) => serializeNode(n)).join('\n');
    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      const code = node.content?.map((n) => n.text || '').join('') || '';
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'blockquote':
      return (node.content || []).map((n) => `> ${serializeNode(n)}`).join('\n');
    case 'horizontalRule':
      return '---';
    case 'image': {
      const src = node.attrs?.src || '';
      const alt = node.attrs?.alt || '';
      return `![${alt}](${src})`;
    }
    default:
      return serializeInline(node.content || []);
  }
}

function serializeInline(nodes: JSONContent[]): string {
  return nodes
    .map((node) => {
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
