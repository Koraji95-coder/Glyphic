// Basic markdown to HTML parser for loading into TipTap
// TipTap's setContent() accepts HTML strings

export function parseMarkdownToContent(markdown: string): string {
  // Strip YAML frontmatter
  let content = markdown.replace(/^---[\s\S]*?---\n*/, '');

  // Convert markdown to basic HTML that TipTap can consume
  const lines = content.split('\n');
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeContent: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';

  for (const line of lines) {
    // Code block toggle
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeContent = [];
      } else {
        inCodeBlock = false;
        const langAttr = codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : '';
        htmlLines.push(`<pre><code${langAttr}>${escapeHtml(codeContent.join('\n'))}</code></pre>`);
      }
      continue;
    }
    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Close open list if current line is not a list item
    if (inList && !line.match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
      htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
    }

    // Empty lines
    if (line.trim() === '') {
      if (inList) {
        htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
      }
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      htmlLines.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (line.match(/^(---|\*\*\*|___)\s*$/)) {
      htmlLines.push('<hr>');
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      htmlLines.push(`<blockquote><p>${inlineMarkdown(line.replace(/^>\s?/, ''))}</p></blockquote>`);
      continue;
    }

    // Task list
    const taskMatch = line.match(/^[-*+]\s\[([ xX])\]\s(.*)/);
    if (taskMatch) {
      if (!inList) {
        htmlLines.push('<ul data-type="taskList">');
        inList = true;
        listType = 'ul';
      }
      const checked = taskMatch[1] !== ' ' ? ' data-checked="true"' : '';
      htmlLines.push(`<li data-type="taskItem"${checked}><p>${inlineMarkdown(taskMatch[2])}</p></li>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*+]\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        htmlLines.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      htmlLines.push(`<li><p>${inlineMarkdown(ulMatch[1])}</p></li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        htmlLines.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      htmlLines.push(`<li><p>${inlineMarkdown(olMatch[1])}</p></li>`);
      continue;
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      htmlLines.push(`<img src="${escapeHtml(imgMatch[2])}" alt="${escapeHtml(imgMatch[1])}" />`);
      continue;
    }

    // Regular paragraph
    htmlLines.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) {
    htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  return htmlLines.join('\n');
}

function inlineMarkdown(text: string): string {
  return text
    // Timestamp badges [T:MM:SS]
    .replace(
      /\[T:(\d{2}:\d{2})\]/g,
      '<span data-type="timestamp" data-elapsed="$1" data-absolute=""></span>',
    )
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Highlight
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Images inline
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function extractFrontmatter(markdown: string): Record<string, unknown> | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter: Record<string, unknown> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Parse simple YAML values
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}
