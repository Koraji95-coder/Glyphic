/**
 * Single source of truth for keyboard shortcuts displayed in Help and Settings.
 * Registration of the actual key handlers still happens in their respective
 * components (App.tsx, Editor toolbar, etc.); this file keeps the user-facing
 * documentation in one place so it can never drift from the real bindings.
 */
export type ShortcutCategory = 'Capture' | 'Navigation' | 'Editor' | 'Layout' | 'AI';

export interface ShortcutEntry {
  combo: string;
  description: string;
  category: ShortcutCategory;
}

export const SHORTCUTS: ShortcutEntry[] = [
  // Capture
  { combo: 'Ctrl+Shift+S', description: 'Open capture overlay', category: 'Capture' },
  { combo: 'Ctrl+Shift+F', description: 'Fullscreen capture', category: 'Capture' },
  { combo: 'Ctrl+Shift+R', description: 'Repeat last capture region', category: 'Capture' },

  // Navigation
  { combo: 'Ctrl+P', description: 'Quick switcher', category: 'Navigation' },
  { combo: 'Ctrl+N', description: 'New note in current folder', category: 'Navigation' },
  { combo: 'Ctrl+Shift+N', description: 'New folder', category: 'Navigation' },
  { combo: 'Ctrl+F', description: 'Find in current note', category: 'Navigation' },

  // Editor
  { combo: 'Ctrl+S', description: 'Force-save current note', category: 'Editor' },
  { combo: 'Ctrl+B', description: 'Bold', category: 'Editor' },
  { combo: 'Ctrl+I', description: 'Italic', category: 'Editor' },
  { combo: 'Ctrl+K', description: 'Insert link', category: 'Editor' },
  { combo: 'Ctrl+Shift+K', description: 'Insert backlink', category: 'Editor' },
  { combo: 'Ctrl+E', description: 'Inline code', category: 'Editor' },
  { combo: 'Ctrl+Shift+E', description: 'Code block', category: 'Editor' },
  { combo: 'Ctrl+Shift+L', description: 'Toggle lecture mode', category: 'Editor' },

  // Layout
  { combo: 'Ctrl+/', description: 'Toggle sidebar (or open this help)', category: 'Layout' },
  { combo: 'Ctrl+?', description: 'Open this help', category: 'Layout' },
  { combo: 'Ctrl+,', description: 'Open settings', category: 'Layout' },
  { combo: 'Ctrl+\\', description: 'Split editor right', category: 'Layout' },
  { combo: 'Ctrl+Shift+\\', description: 'Split editor down', category: 'Layout' },
  { combo: 'Ctrl+W', description: 'Close split pane', category: 'Layout' },

  // AI
  { combo: 'Ctrl+Shift+A', description: 'Toggle ScribeAI chat panel', category: 'AI' },
];

export function shortcutsByCategory(): Record<ShortcutCategory, ShortcutEntry[]> {
  const grouped: Record<ShortcutCategory, ShortcutEntry[]> = {
    Capture: [],
    Navigation: [],
    Editor: [],
    Layout: [],
    AI: [],
  };
  for (const s of SHORTCUTS) grouped[s.category].push(s);
  return grouped;
}
