// Basic markdown to HTML parser for loading into TipTap
// TipTap's setContent() accepts HTML strings

/**
 * Split a raw note file into its frontmatter block (including the surrounding
 * `---` fences and trailing newlines) and the markdown body. If no frontmatter
 * is present, `frontmatter` is an empty string.
 */
export function splitFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n*/);
  if (!match) {
    return { frontmatter: '', body: markdown };
  }
  return { frontmatter: match[0], body: markdown.slice(match[0].length) };
}

interface ListFrame {
  type: 'ul' | 'ol';
  /** TaskList rendering uses a different opening tag */
  isTask: boolean;
  /** Number of leading spaces this list level was opened at */
  indent: number;
  /** True if the most recent <li> at this level is still open (awaiting children/close) */
  liOpen: boolean;
}

export function parseMarkdownToContent(markdown: string): string {
  // Strip YAML frontmatter
  const { body: rawBody } = splitFrontmatter(markdown);

  // Pre-process multi-line block math ($$\n...\n$$) → single-line $$...$$ in a paragraph.
  // Must be done before splitting into lines so the block is treated as one unit.
  const content = rawBody.replace(/^\$\$\s*\n([\s\S]*?)\n\$\$\s*$/gm, (_match, latex) => `$$${latex.trim()}$$`);

  // Convert markdown to basic HTML that TipTap can consume
  const lines = content.split('\n');
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeContent: string[] = [];

  // Stack of open lists, deepest last. Allows arbitrary nesting via
  // 2-space indentation per CommonMark convention. Each frame tracks whether
  // its current <li> is still open so nested lists can be written *inside*
  // the parent <li> rather than as siblings.
  const listStack: ListFrame[] = [];

  const closeOpenLi = (frame: ListFrame) => {
    if (frame.liOpen) {
      htmlLines.push('</li>');
      frame.liOpen = false;
    }
  };

  const closeListsTo = (targetDepth: number) => {
    while (listStack.length > targetDepth) {
      const frame = listStack.pop()!;
      closeOpenLi(frame);
      htmlLines.push(frame.type === 'ul' ? '</ul>' : '</ol>');
      // The list itself was nested inside its parent's open <li>; that <li>
      // remains open and will be closed when its sibling/end arrives.
    }
  };

  const closeAllLists = () => closeListsTo(0);

  for (const line of lines) {
    // Code block toggle
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // Opening a code block ends any list context
        closeAllLists();
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

    // Detect list items (with optional leading indent that determines nesting depth)
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const leading = listMatch[1].length;
      const marker = listMatch[2];
      const rest = listMatch[3];
      const depth = Math.floor(leading / 2);
      const taskMatch = rest.match(/^\[([ xX])\]\s(.*)$/);
      const isOrdered = /\d+\./.test(marker);
      const wantType: 'ul' | 'ol' = isOrdered ? 'ol' : 'ul';
      const wantTask = !!taskMatch && !isOrdered;

      // If we're going deeper, leave the parent <li> OPEN (so the nested
      // list nests inside it).
      // If we're staying or going shallower, close the previous <li> at the
      // target level first.
      while (listStack.length > depth + 1) {
        const f = listStack.pop()!;
        closeOpenLi(f);
        htmlLines.push(f.type === 'ul' ? '</ul>' : '</ol>');
      }
      if (
        listStack.length === depth + 1 &&
        (listStack[depth].type !== wantType || listStack[depth].isTask !== wantTask)
      ) {
        const f = listStack.pop()!;
        closeOpenLi(f);
        htmlLines.push(f.type === 'ul' ? '</ul>' : '</ol>');
      }
      // Open lists up to required depth.
      while (listStack.length < depth + 1) {
        const newFrame: ListFrame = { type: wantType, isTask: wantTask, indent: leading, liOpen: false };
        listStack.push(newFrame);
        if (wantTask) {
          htmlLines.push('<ul data-type="taskList">');
        } else if (wantType === 'ol') {
          const startNum = parseInt(marker, 10) || 1;
          const startAttr = startNum !== 1 ? ` start="${startNum}"` : '';
          htmlLines.push(`<ol${startAttr}>`);
        } else {
          htmlLines.push('<ul>');
        }
      }

      // Close any prior open <li> at this exact depth before starting a new sibling.
      const frame = listStack[depth];
      closeOpenLi(frame);

      if (taskMatch && !isOrdered) {
        const checked = taskMatch[1] !== ' ' ? ' data-checked="true"' : '';
        htmlLines.push(`<li data-type="taskItem"${checked}><p>${inlineMarkdown(taskMatch[2])}</p>`);
      } else {
        htmlLines.push(`<li><p>${inlineMarkdown(rest)}</p>`);
      }
      frame.liOpen = true;
      continue;
    }

    // Empty lines: terminate any open lists / reset.
    if (line.trim() === '') {
      closeAllLists();
      continue;
    }

    // Any non-list, non-empty line closes open lists before being emitted.
    closeAllLists();

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

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      htmlLines.push(`<img src="${escapeHtml(imgMatch[2])}" alt="${escapeHtml(imgMatch[1])}" />`);
      continue;
    }

    // Regular paragraph — coalesce hard-break continuations into one <p>.
    // A line that ends in two-or-more trailing spaces is a Markdown hard
    // break; the next non-blank/non-block line should be appended to the
    // same paragraph separated by <br>, instead of becoming a new <p>.
    const prev = htmlLines.length > 0 ? htmlLines[htmlLines.length - 1] : '';
    const continuesParagraph = /^<p>.*<br><\/p>$/.test(prev);
    if (continuesParagraph) {
      htmlLines[htmlLines.length - 1] = prev.replace(/<\/p>$/, `${inlineMarkdown(line)}</p>`);
    } else {
      htmlLines.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }

  closeAllLists();

  return htmlLines.join('\n');
}

function inlineMarkdown(text: string): string {
  return (
    escapeHtml(text)
      // Markdown hard line break: two spaces at end-of-line → <br>. Apply before
      // the other inline rules so the trailing spaces aren't trimmed away.
      .replace(/ {2,}$/g, '<br>')
      // Timestamp badges [T:MM:SS]
      .replace(/\[T:(\d{2}:\d{2})\]/g, '<span data-type="timestamp" data-elapsed="$1" data-absolute=""></span>')
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
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Upsert a scalar string field in a raw frontmatter block (including the
 * surrounding `---` fences). If the key already exists its value is replaced.
 * If `value` is `null` the key line is removed. Returns the updated frontmatter
 * string unchanged when no frontmatter fences are present.
 */
export function upsertFrontmatterField(frontmatter: string, key: string, value: string | null): string {
  if (!frontmatter) return frontmatter;
  // Escape any regex metacharacters in the key for safe pattern construction.
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}:[^\n]*\n?`, 'm');
  if (value === null) {
    return frontmatter.replace(pattern, '');
  }
  const line = `${key}: ${value}`;
  if (pattern.test(frontmatter)) {
    return frontmatter.replace(new RegExp(`^${escapedKey}:[^\n]*`, 'm'), line);
  }
  // Insert before the closing --- fence.
  return frontmatter.replace(/(\n---\n*)$/, `\n${line}$1`);
}

/**
 * Compose a complete note string (frontmatter + body) refreshing the
 * `modified:` field to the current time. If the frontmatter is empty the body
 * is returned unchanged.
 */
export function composeNote({ body, frontmatter }: { body: string; frontmatter: string }): string {
  if (!frontmatter) return body;
  const now = new Date().toISOString();
  const modifiedLine = `modified: "${now}"`;
  if (/^modified:\s*"[^"]*"\s*$/m.test(frontmatter)) {
    return frontmatter.replace(/^modified:\s*"[^"]*"\s*$/m, modifiedLine) + body;
  }
  const injected = frontmatter.replace(/(\n)?---(\n*)$/, `\n${modifiedLine}\n---$2`);
  return injected + body;
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
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}
