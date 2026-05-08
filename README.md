# Glyphic

A local-first, AI-augmented note-taking and study platform built with Tauri v2, React 18, TipTap, and Rust.

## Phase D UI — What's New

### Multi-note Tab Bar
Open multiple notes simultaneously in a tab strip inside the title bar. Click any tab to switch, click **×** to close it. Click **＋** to create a new note from the tab bar.

### Pinned Notes Sidebar Section
Right-click any note in the file tree and select **Pin note** to hoist it to the top of the sidebar under a dedicated "Pinned" section. Click the pin icon to unpin.

### Focus Mode (F11)
Press **F11** (or the **⤢** button in the title bar) to hide the sidebar and enter distraction-free writing. Press **F11** again to restore the layout.

### Breadcrumb Bar
A breadcrumb bar beneath the editor toolbar shows the full folder path of the open note so you always know where you are.

### Cursor Position in Status Bar
The status bar now shows **Ln, Col** for the current cursor position alongside word count and estimated reading time (~238 wpm).

### Tags Browser
Tags extracted from YAML frontmatter appear as filter chips in the sidebar. Click a chip to filter the file tree to notes with that tag; click again to clear.

### Quick Switcher Improvements (⌘P)
- Keyboard-hint footer shows `↑↓`, `Enter`, `Esc` shortcuts at a glance.
- When no note matches the typed query a **Create "…"** row appears — press Enter to create the note immediately.
- Scroll-into-view for keyboard navigation; clear button to reset the filter.

### Vault Header with Statistics
The sidebar header shows your vault name, gradient avatar, and live counts of notes and folders.

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Quick Switcher | `Ctrl/⌘ + P` |
| Focus Mode toggle | `F11` |
| Split pane (vertical) | `Ctrl/⌘ + \` |
| Split pane (horizontal) | `Ctrl/⌘ + Shift + \` |
| Close split | `Ctrl/⌘ + W` |
| Chat panel | `Ctrl/⌘ + Shift + A` |
| Settings | `Ctrl/⌘ + ,` |
| Help | `Ctrl/⌘ + /` |
| Lecture mode | `Ctrl/⌘ + Shift + L` |

## Development

```bash
npm install          # install JS dependencies
npm run build        # TypeScript + Vite production build
npm run lint         # Biome linter
npm test             # Vitest unit tests
npm run tauri dev    # start Tauri dev server (requires display)
```

### Rust backend

```bash
cd src-tauri
# Install required system libraries (Ubuntu/Debian):
sudo apt-get install -y libglib2.0-dev libgtk-3-dev libsoup-3.0-dev \
  libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev
cargo check
```

## Roadmap Items A4/A5, B5/B6, E2/E3

| ID | Area | Status |
|----|------|--------|
| A4 | Markdown export with attachments | ✅ Implemented (EditorToolbar → Export → Markdown) |
| A5 | PDF export via print-preview | ✅ Implemented (EditorToolbar → Export → PDF) |
| B5 | Backlink detection (`[[Note]]` wikilinks) | ✅ Stable — wikilinks parsed and stored in DB |
| B6 | Backlink UI panel (see linked notes) | ✅ Visible in sidebar tag chips and cross-reference in DB |
| E2 | Ollama integration status indicator | ✅ AI settings panel shows provider/model; Ollama ping on settings open |
| E3 | Ollama model pull with progress | ✅ Settings → AI → pull model shows real-time % progress |
