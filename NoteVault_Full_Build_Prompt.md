# NoteVault — Full Build Prompt (Start to Finish)

You are building a complete desktop note-taking application called **NoteVault** using **Tauri v2 + React + TypeScript** on the frontend and **Rust** on the backend. This app replaces OneNote and Obsidian for a student workflow. The core problem it solves: OneNote uses a free-form canvas where images drift and shift when you type near them. NoteVault uses a linear document flow (like a web page) where screenshots are first-class citizens that never move unless you explicitly drag them.

Read this entire prompt before writing any code. Follow every section precisely. Do not skip features, do not substitute libraries unless one is deprecated, and do not simplify the architecture.

---

## 1. PROJECT INITIALIZATION

### 1.1 Create Tauri v2 Project

```bash
cargo install create-tauri-app
cargo create-tauri-app notevault --template react-ts
cd notevault
```

### 1.2 Project Structure

Create exactly this folder structure:

```
notevault/
├── src/                          # React frontend
│   ├── main.tsx                  # App entry
│   ├── App.tsx                   # Root component with router
│   ├── styles/
│   │   └── globals.css           # Global styles + CSS variables + theme
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── Editor.tsx             # TipTap editor wrapper
│   │   │   ├── EditorToolbar.tsx      # Formatting toolbar
│   │   │   ├── SlashCommand.tsx       # Slash command menu
│   │   │   ├── ImageNode.tsx          # Custom TipTap node for screenshots
│   │   │   └── AnnotatedImageNode.tsx # Screenshot with annotation overlay
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx            # Main sidebar container
│   │   │   ├── FileTree.tsx           # Folder/file navigation
│   │   │   ├── FileTreeItem.tsx       # Single tree node (folder or file)
│   │   │   ├── SearchBar.tsx          # Full-text search input
│   │   │   └── RecentScreenshots.tsx  # Thumbnail strip of recent captures
│   │   ├── Capture/
│   │   │   ├── CaptureOverlay.tsx     # Fullscreen overlay for snipping
│   │   │   ├── RegionSelector.tsx     # Rectangle drag selection
│   │   │   ├── FreeformSelector.tsx   # Freeform lasso selection
│   │   │   ├── WindowSelector.tsx     # Window highlight + click capture
│   │   │   ├── CaptureToolbar.tsx     # Mode switcher floating toolbar
│   │   │   └── Magnifier.tsx          # Pixel-level zoom loupe near cursor
│   │   ├── Annotation/
│   │   │   ├── AnnotationOverlay.tsx  # Canvas overlay on screenshot
│   │   │   ├── ArrowTool.tsx          # Draw arrows
│   │   │   ├── RectTool.tsx           # Draw rectangles/highlights
│   │   │   ├── TextTool.tsx           # Add text callouts
│   │   │   └── AnnotationToolbar.tsx  # Tool switcher for annotation mode
│   │   ├── LectureMode/
│   │   │   ├── LectureModeToggle.tsx  # On/off toggle in toolbar
│   │   │   └── TimestampBadge.tsx     # Inline timestamp display
│   │   ├── QuickSwitcher/
│   │   │   └── QuickSwitcher.tsx      # Cmd+P fuzzy file finder modal
│   │   └── Layout/
│   │       ├── TitleBar.tsx           # Custom titlebar with window controls
│   │       └── StatusBar.tsx          # Bottom bar: word count, sync status
│   ├── hooks/
│   │   ├── useCapture.ts             # Capture hotkey + event listeners
│   │   ├── useVault.ts               # Vault CRUD operations
│   │   ├── useSearch.ts              # Search integration
│   │   ├── useEditor.ts              # Editor state management
│   │   ├── useLectureMode.ts         # Lecture mode timestamp logic
│   │   └── useTheme.ts              # Theme switching
│   ├── stores/
│   │   ├── vaultStore.ts             # Zustand store for vault state
│   │   ├── editorStore.ts            # Zustand store for active editor
│   │   ├── captureStore.ts           # Zustand store for capture state
│   │   └── settingsStore.ts          # Zustand store for user preferences
│   ├── lib/
│   │   ├── tiptap/
│   │   │   ├── extensions.ts         # All TipTap extension configs
│   │   │   ├── markdownSerializer.ts # Export editor content as markdown
│   │   │   └── markdownParser.ts     # Import markdown into editor
│   │   ├── tauri/
│   │   │   ├── commands.ts           # Typed wrappers for all Tauri invoke() calls
│   │   │   └── events.ts            # Typed Tauri event listeners
│   │   └── utils/
│   │       ├── debounce.ts
│   │       ├── formatDate.ts
│   │       └── fileIcons.ts          # Icon mapping for file types
│   └── types/
│       ├── vault.ts                  # VaultConfig, NoteFile, Folder types
│       ├── capture.ts                # CaptureMode, CaptureResult types
│       ├── editor.ts                 # EditorState, DocumentNode types
│       └── annotation.ts            # Annotation, AnnotationTool types
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs                   # Tauri app entry, plugin registration
│   │   ├── lib.rs                    # Module declarations
│   │   ├── capture/
│   │   │   ├── mod.rs                # Capture module entry
│   │   │   ├── screen.rs             # Raw screen grab via xcap
│   │   │   ├── crop.rs               # Region/freeform cropping
│   │   │   ├── window_detect.rs      # OS-level window boundary detection
│   │   │   ├── overlay.rs            # Overlay window lifecycle management
│   │   │   └── postprocess.rs        # Thumbnailing, whitespace trim
│   │   ├── vault/
│   │   │   ├── mod.rs                # Vault module entry
│   │   │   ├── manager.rs            # Create/read/write/delete notes + folders
│   │   │   ├── watcher.rs            # Filesystem watcher (notify crate)
│   │   │   └── config.rs             # Vault config (config.toml) read/write
│   │   ├── db/
│   │   │   ├── mod.rs                # Database module entry
│   │   │   ├── schema.rs             # SQLite table definitions + migrations
│   │   │   ├── index.rs              # Full-text indexing of notes
│   │   │   ├── search.rs             # Search queries (FTS5)
│   │   │   └── ocr.rs                # OCR text extraction + indexing
│   │   ├── export/
│   │   │   ├── mod.rs
│   │   │   ├── pdf.rs                # Export note to PDF
│   │   │   └── markdown.rs           # Export note to clean markdown
│   │   └── commands/
│   │       ├── mod.rs                # All Tauri command registrations
│   │       ├── capture_commands.rs   # capture_region, capture_window, etc.
│   │       ├── vault_commands.rs     # create_note, save_note, delete_note, etc.
│   │       ├── search_commands.rs    # search_notes, search_screenshots
│   │       ├── export_commands.rs    # export_pdf, export_markdown
│   │       └── settings_commands.rs  # get_settings, update_settings
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

### 1.3 Dependencies

**Frontend (package.json):**

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-global-shortcut": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-clipboard-manager": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "@tiptap/react": "^2",
    "@tiptap/starter-kit": "^2",
    "@tiptap/extension-image": "^2",
    "@tiptap/extension-placeholder": "^2",
    "@tiptap/extension-code-block-lowlight": "^2",
    "@tiptap/extension-mathematics": "^2",
    "@tiptap/extension-task-list": "^2",
    "@tiptap/extension-task-item": "^2",
    "@tiptap/extension-link": "^2",
    "@tiptap/extension-highlight": "^2",
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "zustand": "^4",
    "fuse.js": "^7",
    "fabric": "^6",
    "lowlight": "^3",
    "katex": "^0.16",
    "lucide-react": "latest",
    "date-fns": "^3"
  },
  "devDependencies": {
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

**Backend (Cargo.toml) — add these dependencies:**

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
xcap = "0.0.14"
image = "0.25"
rusqlite = { version = "0.31", features = ["bundled", "fts5"] }
notify = "6"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
toml = "0.8"
walkdir = "2"
thiserror = "1"
tokio = { version = "1", features = ["full"] }
log = "0.4"
env_logger = "0.11"
directories = "5"
```

For Windows window detection, conditionally include:
```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
  "Win32_UI_WindowsAndMessaging",
  "Win32_Foundation",
  "Win32_Graphics_Gdi"
]}
```

For macOS window detection:
```toml
[target.'cfg(target_os = "macos")'.dependencies]
core-graphics = "0.24"
core-foundation = "0.10"
```

---

## 2. VAULT SYSTEM

### 2.1 Vault Folder Structure

When the user first launches the app, prompt them to choose a vault location. Default to `~/NoteVault/`. Create this structure:

```
~/NoteVault/
├── .notevault/
│   ├── config.toml        # Vault settings
│   └── index.db           # SQLite database (FTS5 enabled)
├── Fall2026/
│   ├── Calculus2/
│   │   ├── notes/
│   │   │   └── welcome.md
│   │   └── attachments/
│   └── Physics/
│       ├── notes/
│       └── attachments/
└── Unsorted/
    ├── notes/
    └── attachments/
```

### 2.2 config.toml Schema

```toml
[vault]
name = "My School Notes"
created_at = "2026-04-15T10:00:00Z"

[capture]
default_mode = "region"           # region | window | freeform | fullscreen
hotkey = "CmdOrCtrl+Shift+S"
fullscreen_hotkey = "CmdOrCtrl+Shift+F"
repeat_hotkey = "CmdOrCtrl+Shift+R"
save_to_clipboard = true          # also copy to clipboard on capture
auto_trim_whitespace = false
image_format = "png"              # png | jpg | webp
jpg_quality = 90

[editor]
autosave_interval_ms = 2000
font_family = "Inter"
font_size = 16
line_height = 1.6
show_line_numbers = false
spell_check = true

[appearance]
theme = "system"                  # light | dark | system
sidebar_width = 280
accent_color = "#6366f1"          # indigo-500

[lecture_mode]
enabled = false
timestamp_format = "HH:mm:ss"
```

### 2.3 Vault Manager (Rust)

Implement in `src-tauri/src/vault/manager.rs`:

- `create_vault(path: &str, name: &str) -> Result<VaultConfig>` — creates folder structure, config.toml, and empty SQLite database.
- `open_vault(path: &str) -> Result<VaultConfig>` — reads config.toml, opens database, starts file watcher.
- `create_folder(vault_path: &str, relative_path: &str) -> Result<()>` — creates a class/semester folder with `notes/` and `attachments/` subdirs.
- `create_note(vault_path: &str, folder: &str, title: &str) -> Result<NoteFile>` — creates a `.md` file with YAML frontmatter, indexes it in SQLite.
- `save_note(vault_path: &str, note_path: &str, content: &str) -> Result<()>` — writes content to disk, re-indexes in SQLite.
- `delete_note(vault_path: &str, note_path: &str) -> Result<()>` — moves to OS trash (not permanent delete), removes from index.
- `rename_note(vault_path: &str, old_path: &str, new_name: &str) -> Result<NoteFile>` — renames file, updates index, updates any internal links pointing to this note.
- `list_vault_contents(vault_path: &str) -> Result<Vec<VaultEntry>>` — recursive listing of all folders and notes, used to populate the sidebar file tree.
- `read_note(vault_path: &str, note_path: &str) -> Result<String>` — reads markdown content from disk.

### 2.4 Note Frontmatter

Every `.md` note file starts with YAML frontmatter:

```yaml
---
title: "Week 1 - Limits and Continuity"
created: 2026-04-15T14:30:00Z
modified: 2026-04-15T15:45:00Z
tags: [calculus, limits, chapter1]
lecture_timestamps: true
---
```

The editor must parse this frontmatter on load and update the `modified` field on every save.

### 2.5 File Watcher

Implement in `src-tauri/src/vault/watcher.rs` using the `notify` crate:

- Watch the entire vault directory recursively.
- On file create/modify/delete, emit a Tauri event `vault-changed` with `{ event_type: "created" | "modified" | "deleted", path: string }`.
- Debounce events by 500ms to avoid flooding during rapid saves.
- Ignore changes to `.notevault/index.db` (the database) and any `.tmp` files.
- The frontend listens for `vault-changed` and refreshes the file tree and re-reads the active note if it was externally modified.

---

## 3. SQLITE DATABASE & SEARCH

### 3.1 Schema

Implement in `src-tauri/src/db/schema.rs`. Create these tables on vault initialization:

```sql
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,                  -- UUID v4
  path TEXT NOT NULL UNIQUE,            -- relative path from vault root
  title TEXT NOT NULL,
  content TEXT NOT NULL,                -- full markdown content
  tags TEXT DEFAULT '[]',               -- JSON array of tags
  created_at TEXT NOT NULL,             -- ISO 8601
  modified_at TEXT NOT NULL,
  word_count INTEGER DEFAULT 0
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  content,
  tags,
  content=notes,
  content_rowid=rowid
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
  INSERT INTO notes_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TABLE IF NOT EXISTS screenshots (
  id TEXT PRIMARY KEY,                  -- UUID v4
  note_id TEXT,                         -- FK to notes.id (nullable for unlinked screenshots)
  path TEXT NOT NULL UNIQUE,            -- relative path to image file
  thumbnail_path TEXT,                  -- relative path to thumbnail
  ocr_text TEXT DEFAULT '',             -- extracted text from OCR
  captured_at TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  capture_mode TEXT DEFAULT 'region',   -- region | window | freeform | fullscreen
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS screenshots_fts USING fts5(
  ocr_text,
  content=screenshots,
  content_rowid=rowid
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  screenshot_id TEXT NOT NULL,
  data TEXT NOT NULL,                   -- JSON blob of annotation objects
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1'
);

CREATE TABLE IF NOT EXISTS backlinks (
  source_note_id TEXT NOT NULL,
  target_note_id TEXT NOT NULL,
  PRIMARY KEY (source_note_id, target_note_id),
  FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

### 3.2 Search Implementation

Implement in `src-tauri/src/db/search.rs`:

- `search_notes(query: &str, limit: usize) -> Result<Vec<SearchResult>>` — uses FTS5 `MATCH` on `notes_fts`, returns note ID, path, title, and a snippet with highlighted matches.
- `search_screenshots(query: &str, limit: usize) -> Result<Vec<ScreenshotSearchResult>>` — searches OCR text in `screenshots_fts`.
- `search_all(query: &str, limit: usize) -> Result<SearchResults>` — combined search across notes and screenshots, ranked by relevance.

### 3.3 Indexing

Implement in `src-tauri/src/db/index.rs`:

- `index_note(note: &NoteFile) -> Result<()>` — inserts or updates a note in the database and FTS index.
- `reindex_vault(vault_path: &str) -> Result<usize>` — walks the entire vault, indexes every `.md` file. Returns count of indexed files. Used on first open or for repair.
- `remove_from_index(note_path: &str) -> Result<()>` — removes a note from the database when deleted.

---

## 4. SCREENSHOT CAPTURE SYSTEM

This is the most critical feature of the app. It must feel instant and native.

### 4.1 Capture Modes

Implement four capture modes in `src-tauri/src/capture/`:

#### 4.1.1 Region Capture (Default)

File: `crop.rs`

1. User presses global hotkey (default `Ctrl+Shift+S`).
2. Rust captures a fullscreen screenshot of all monitors using `xcap::Monitor::all()` and `monitor.capture_image()`.
3. Tauri creates a new borderless, fullscreen, always-on-top, transparent window called `capture-overlay`.
4. The frozen screenshot is passed to this window (as a base64-encoded PNG or written to a temp file and loaded).
5. The overlay window renders the screenshot as background with a semi-transparent dark tint (`rgba(0,0,0,0.3)`) over it.
6. The user sees a crosshair cursor.
7. User clicks and drags to draw a rectangle. While dragging:
   - The selected area shows the original screenshot at full brightness (the tint is removed inside the rectangle).
   - The dimensions (W × H in pixels) are displayed near the bottom-right corner of the rectangle.
   - A magnifier loupe (see 4.2) appears near the cursor.
8. On mouse release, the frontend sends `invoke('finish_capture', { mode: 'region', x, y, width, height })`.
9. Rust crops the original fullscreen image to those pixel coordinates using the `image` crate.
10. Rust saves the cropped image as `{vault}/attachments/{YYYY-MM-DD_HH-mm-ss}_{uuid_short}.png`.
11. Rust generates a 200px-wide thumbnail and saves it alongside.
12. Rust emits a Tauri event `screenshot-captured` with `{ path, thumbnail_path, width, height }`.
13. The overlay window closes.
14. The main editor window receives the event and inserts an image node at the current cursor position.
15. If `save_to_clipboard` is true in config, also copy the image to the OS clipboard.

The entire sequence from hotkey press to image-in-note must complete in under 1 second.

#### 4.1.2 Window Capture

File: `window_detect.rs`

1. Activated by pressing `W` key on the capture toolbar, or holding `Alt` when the overlay opens.
2. Requires detecting all visible window boundaries on the current monitor.
3. **Windows:** Use `EnumWindows` + `GetWindowRect` + `IsWindowVisible` from the `windows` crate.
4. **macOS:** Use `CGWindowListCopyWindowInfo` from `core-graphics`.
5. **Linux:** Use X11's `XQueryTree` + `XGetWindowAttributes` or Wayland equivalents.
6. Send the list of window rectangles `Vec<{ x, y, width, height, title }>` to the overlay frontend.
7. As the user moves their mouse, the overlay highlights the window under the cursor with a colored border (2px solid `#6366f1`) and a slight brightness increase.
8. User clicks to capture that window's region.
9. The rest of the flow (crop, save, emit event) is identical to region capture.

#### 4.1.3 Fullscreen Capture

1. Activated by a separate hotkey (default `Ctrl+Shift+F`) or by pressing `F` on the capture toolbar.
2. No overlay needed — immediately capture the full screen.
3. Save, thumbnail, emit event, insert into editor.

#### 4.1.4 Freeform Capture

File: `crop.rs` (extend with polygon cropping)

1. Activated by pressing `L` (lasso) on the capture toolbar.
2. User clicks and drags to draw a freehand path on the overlay.
3. On mouse release, the path auto-closes (connect last point to first point).
4. The frontend sends the array of points to Rust.
5. Rust creates a mask from the polygon, crops to the bounding box, and makes everything outside the polygon transparent (save as PNG with alpha).
6. Rest of flow is identical.

### 4.2 Magnifier Loupe

File: `src/components/Capture/Magnifier.tsx`

- A 120×120px circular element that follows the cursor with a 20px offset to the top-right.
- Shows a 4× zoom of the area around the cursor position.
- Has a crosshair overlay in the center.
- Displays the pixel coordinates (X, Y) below the loupe.
- Renders using a clipped and scaled version of the background screenshot.
- Flip to the left side of the cursor when near the right edge of the screen.

### 4.3 Capture Toolbar

File: `src/components/Capture/CaptureToolbar.tsx`

- A small floating toolbar at the top-center of the overlay.
- Contains mode buttons: **Region** (default, icon: square with dashed border), **Window** (icon: application window), **Freeform** (icon: lasso), **Fullscreen** (icon: monitor).
- Also contains: **Delay** toggle (3s / 5s / off), **Close** button (or press Escape).
- Keyboard shortcuts displayed as tooltips: `R` for region, `W` for window, `L` for lasso, `F` for fullscreen, `D` to cycle delay, `Esc` to cancel.
- The toolbar must not interfere with the capture area — if the user starts dragging from the toolbar area, the toolbar hides.

### 4.4 Advanced Capture Features

#### Multi-Capture Mode

- After a capture completes, if the user is holding `Shift`, do NOT close the overlay. Instead, keep it open and allow additional captures.
- Each capture is saved and queued. When the user finally presses `Escape` or releases `Shift`, all captures are inserted sequentially into the editor at the cursor position.
- Show a small counter badge on the toolbar: "3 captured".

#### Last Region Repeat

- A separate hotkey (default `Ctrl+Shift+R`).
- Stores the last capture region coordinates in memory (not persisted across app restarts).
- When pressed, immediately captures that exact same screen region without showing the overlay.
- Useful for capturing the same area of a slide as a professor advances through a presentation.

#### Auto-Trim Whitespace

- Optional setting in config (`auto_trim_whitespace`).
- After cropping, analyze the edges of the image. If there are uniform-color borders (white, black, or near-uniform), trim them.
- Use the `image` crate to scan pixel rows/columns from each edge inward. Stop when the row/column contains more than 5% pixel variance.

### 4.5 Overlay Window Configuration (tauri.conf.json)

Add a secondary window configuration for the capture overlay:

```json
{
  "label": "capture-overlay",
  "title": "",
  "url": "/capture",
  "fullscreen": true,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": false,
  "resizable": false
}
```

This window is created hidden and shown only when a capture is triggered. After capture completes, hide it again (don't destroy — reuse for performance).

---

## 5. EDITOR

### 5.1 TipTap Configuration

File: `src/components/Editor/Editor.tsx`

Use TipTap with the following extensions:

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Mathematics from '@tiptap/extension-mathematics';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight
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
    Mathematics,
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false }),
    Highlight.configure({ multicolor: true }),
    // Custom extensions (see below)
    SlashCommandExtension,
    ScreenshotNodeExtension,
    BacklinkExtension,
  ],
  content: '', // loaded from file
  autofocus: true,
  editorProps: {
    attributes: {
      class: 'prose prose-lg max-w-none focus:outline-none',
    },
  },
  onUpdate: ({ editor }) => {
    // Debounced autosave (2 seconds)
    debouncedSave(editor.getJSON());
  },
});
```

### 5.2 Custom Screenshot Node

File: `src/components/Editor/ImageNode.tsx`

Extend TipTap's Image node to create a `ScreenshotNode`:

- Renders the image with a wrapper div that has hover controls.
- On hover, show a small toolbar above the image: **Annotate** (pencil icon), **Full Size** (expand icon), **Delete** (trash icon), **Copy** (clipboard icon).
- Clicking **Annotate** opens the annotation overlay (see Section 7).
- Clicking the image itself opens it in a lightbox (full-resolution view with zoom/pan).
- The node stores these attributes: `src` (file path), `alt`, `title`, `width`, `height`, `capturedAt` (ISO timestamp), `annotationId` (optional, links to annotation data).
- Images are draggable within the document — the user can drag to reorder them. But they NEVER drift or move on their own when typing nearby. This is inherently handled by TipTap's block-level node system (not absolute positioning like OneNote).

### 5.3 Slash Commands

File: `src/components/Editor/SlashCommand.tsx`

When the user types `/` at the beginning of a line or after a space, show a floating command menu:

| Command | Icon | Description |
|---------|------|-------------|
| `/screenshot` | Camera | Trigger capture overlay |
| `/image` | Image | Insert an image from file picker |
| `/code` | Code | Insert a code block |
| `/math` | Sigma | Insert a LaTeX math block |
| `/divider` | Minus | Insert a horizontal rule |
| `/callout` | AlertCircle | Insert a callout/admonition block |
| `/todo` | CheckSquare | Insert a task list |
| `/heading1` | H1 | Insert heading level 1 |
| `/heading2` | H2 | Insert heading level 2 |
| `/heading3` | H3 | Insert heading level 3 |
| `/link` | Link | Insert a link to another note (backlink) |
| `/table` | Grid | Insert a table |
| `/timestamp` | Clock | Insert current timestamp |

The menu is filterable — typing `/co` should filter to show `/code` and `/callout`. Arrow keys to navigate, Enter to select, Escape to dismiss.

### 5.4 Autosave

- The editor saves automatically on a debounced interval (default 2000ms from last keystroke).
- Save writes the content as markdown to disk (using the markdown serializer) AND updates the SQLite index.
- Show a subtle save indicator in the status bar: a small dot that turns green on save, with text "Saved" or "Saving...".
- On window close or note switch, force an immediate save.

### 5.5 Markdown Import/Export

File: `src/lib/tiptap/markdownSerializer.ts` and `markdownParser.ts`

- **Export:** Convert TipTap's JSON document to markdown. Screenshot nodes become `![alt](./attachments/filename.png)`. Annotations are referenced as HTML comments: `<!-- annotation: annotation_id -->`.
- **Import:** Parse markdown into TipTap JSON. Resolve image paths relative to the note's location. Preserve frontmatter.
- The on-disk format is always markdown. The editor works with TipTap JSON internally but reads/writes markdown.

---

## 6. SIDEBAR

### 6.1 File Tree

File: `src/components/Sidebar/FileTree.tsx`

- Displays the vault folder structure as a collapsible tree.
- Top-level folders represent semesters (e.g., "Fall2026").
- Second-level folders represent classes (e.g., "Calculus2").
- Inside each class, list the note files from the `notes/` subfolder.
- Each note shows: file icon, title (from frontmatter, not filename), and a small screenshot count badge if the note has attached images.
- Right-click context menu on folders: New Note, New Subfolder, Rename, Delete.
- Right-click context menu on files: Rename, Delete, Duplicate, Move to..., Export as PDF, Export as Markdown, Copy Link.
- Drag and drop to move notes between folders.
- The active note is highlighted with the accent color.

### 6.2 Search Bar

File: `src/components/Sidebar/SearchBar.tsx`

- Fixed at the top of the sidebar.
- On typing, debounce 300ms, then call `invoke('search_all', { query })`.
- Results appear in a dropdown below the search bar, replacing the file tree temporarily.
- Each result shows: note title, a snippet with highlighted matches, and the folder path.
- Screenshot OCR results show a small thumbnail alongside the OCR text snippet.
- Clicking a result opens that note and scrolls to the matching content.
- Press Escape or clear the search to return to the file tree.

### 6.3 Recent Screenshots

File: `src/components/Sidebar/RecentScreenshots.tsx`

- A horizontal scrollable strip at the bottom of the sidebar.
- Shows thumbnails of the 10 most recent screenshots across all notes.
- Clicking a thumbnail opens the note containing that screenshot and scrolls to it.
- Hovering shows a tooltip with the capture timestamp and the note title.

---

## 7. SCREENSHOT ANNOTATION

### 7.1 Annotation Overlay

File: `src/components/Annotation/AnnotationOverlay.tsx`

When the user clicks the **Annotate** button on a screenshot in the editor:

1. The screenshot expands to fill a modal overlay (not fullscreen — a centered modal with padding).
2. A toolbar appears above the image with annotation tools.
3. The user draws annotations on a canvas layer on top of the image.
4. Annotations are saved as a JSON sidecar file: `{image_name}.annotations.json` in the same `attachments/` folder.
5. The original image is NEVER modified.
6. When rendering the image in the editor, if an annotations file exists, render the annotations as an SVG overlay on top of the image.

### 7.2 Annotation Tools

Implement using Fabric.js on a canvas overlay:

| Tool | Behavior |
|------|----------|
| **Arrow** | Click start point, drag to end point. Draws a straight arrow with a triangular head. Color picker. |
| **Rectangle** | Click and drag to draw a rectangle outline. Optionally filled with semi-transparent color. |
| **Highlight** | Click and drag to draw a semi-transparent yellow (or chosen color) rectangle. Like a highlighter marker. |
| **Freehand** | Draw freehand lines. Configurable stroke width and color. |
| **Text** | Click to place a text box. Type to add text. Configurable font size, color, and background. |
| **Crop** | Click and drag to crop the screenshot to a smaller region (creates a new file, keeps the original). |
| **Eraser** | Click on an annotation object to delete it. |
| **Undo/Redo** | Standard undo/redo stack for all annotation actions. |

### 7.3 Annotation Data Format

```json
{
  "version": 1,
  "screenshot_id": "uuid",
  "objects": [
    {
      "type": "arrow",
      "id": "uuid",
      "x1": 100, "y1": 200, "x2": 300, "y2": 150,
      "color": "#ef4444",
      "strokeWidth": 2,
      "createdAt": "2026-04-15T14:35:00Z"
    },
    {
      "type": "rect",
      "id": "uuid",
      "x": 50, "y": 50, "width": 200, "height": 100,
      "color": "#fbbf24",
      "fill": "rgba(251, 191, 36, 0.3)",
      "strokeWidth": 2,
      "createdAt": "2026-04-15T14:35:30Z"
    },
    {
      "type": "text",
      "id": "uuid",
      "x": 400, "y": 100,
      "text": "Important formula!",
      "fontSize": 16,
      "color": "#ef4444",
      "backgroundColor": "rgba(255,255,255,0.8)",
      "createdAt": "2026-04-15T14:36:00Z"
    }
  ]
}
```

---

## 8. LECTURE MODE

### 8.1 Overview

Lecture mode adds automatic timestamps to everything the user types and every screenshot they capture, so they can later correlate their notes with the lecture timeline.

### 8.2 Activation

File: `src/components/LectureMode/LectureModeToggle.tsx`

- A toggle button in the editor toolbar: clock icon with "Lecture Mode" label.
- When activated, a subtle banner appears below the toolbar: "Lecture Mode active — started at 2:30 PM".
- A running timer shows elapsed time since activation.

### 8.3 Behavior When Active

- **On every new paragraph:** When the user presses Enter to create a new paragraph, automatically insert a timestamp badge at the beginning. The badge shows the elapsed time since lecture mode was activated (e.g., "05:32") and the absolute time (e.g., "2:35 PM"). The badge is a custom TipTap inline node that renders as a small pill-shaped element.
- **On every screenshot capture:** The screenshot node includes the timestamp in its metadata. The timestamp is displayed as a small badge in the top-right corner of the image.
- **On deactivation:** The timestamps remain in the document. They are part of the content and export to markdown as `[T:05:32]` inline markers.

### 8.4 Timestamp Badge Component

File: `src/components/LectureMode/TimestampBadge.tsx`

- Renders as a small inline element: `[05:32]` in a muted color, slightly smaller font.
- Non-editable (the user can't type inside it) but deletable (backspace removes it).
- On hover, shows tooltip with full timestamp: "5 minutes 32 seconds — 2:35:32 PM".
- In the markdown export, renders as `<!-- timestamp: 05:32 -->` or `[T:05:32]`.

---

## 9. BACKLINKS

### 9.1 Link Syntax

In the editor, the user can type `[[` to trigger an autocomplete that searches note titles. Selecting a note inserts a link: `[[Week 1 - Limits]]`. This is stored in markdown as a wikilink.

### 9.2 Backlink Tracking

- On every note save, parse the content for `[[...]]` links.
- Resolve each link to a note ID via the database.
- Update the `backlinks` table: insert new links, remove stale ones.
- In the sidebar or a dedicated panel, show "Linked from" — a list of all notes that link TO the current note.

### 9.3 Backlink Panel

- A collapsible section at the bottom of the sidebar (below the file tree).
- Shows all notes that reference the currently open note.
- Each backlink shows: note title, the sentence containing the link (as context), and the date.
- Clicking a backlink opens that note and scrolls to the link.

---

## 10. QUICK SWITCHER

File: `src/components/QuickSwitcher/QuickSwitcher.tsx`

- Triggered by `Cmd+P` (Mac) or `Ctrl+P` (Windows/Linux).
- A centered modal with a search input at the top.
- Fuzzy-searches all note titles in the vault using Fuse.js.
- Results show: note title, folder path, last modified date.
- Arrow keys to navigate, Enter to open, Escape to close.
- Most recently opened notes appear first when the input is empty.

---

## 11. EXPORT

### 11.1 Export to PDF

File: `src-tauri/src/export/pdf.rs`

- Convert the markdown note to a styled PDF.
- Use a Rust PDF library (e.g., `printpdf` or `genpdf`).
- Embed all screenshots inline at their correct positions.
- Include annotations rendered on top of screenshots.
- Apply clean formatting: proper headings, code blocks with syntax highlighting, math rendered as images.
- The PDF should look professional enough to submit as a homework assignment.

### 11.2 Export to Markdown

File: `src-tauri/src/export/markdown.rs`

- Export the note as a standalone `.md` file.
- Copy all referenced images to an `attachments/` folder next to the exported file.
- Rewrite image paths to be relative to the exported file.
- Include frontmatter.
- This allows the user to share a self-contained note with classmates or import it into Obsidian.

---

## 12. THEMING

### 12.1 CSS Variables

Define in `src/styles/globals.css`:

```css
:root {
  /* Light theme */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --bg-hover: #e5e7eb;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-tertiary: #9ca3af;
  --border: #e5e7eb;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-muted: rgba(99, 102, 241, 0.1);
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --radius: 6px;
  --font-sans: 'Inter', -apple-system, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

[data-theme="dark"] {
  --bg-primary: #0f1117;
  --bg-secondary: #1a1b26;
  --bg-tertiary: #24253a;
  --bg-hover: #2f3146;
  --text-primary: #e5e7eb;
  --text-secondary: #9ca3af;
  --text-tertiary: #6b7280;
  --border: #2f3146;
  --accent: #818cf8;
  --accent-hover: #6366f1;
  --accent-muted: rgba(129, 140, 248, 0.15);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

### 12.2 Theme Switching

- Respect the OS preference by default (`prefers-color-scheme` media query).
- Allow manual override in settings: Light / Dark / System.
- Store preference in `config.toml`.
- Apply theme by setting `data-theme` attribute on the root `<html>` element.

---

## 13. KEYBOARD SHORTCUTS

Implement all of these. They must work globally (even when the editor doesn't have focus, for capture shortcuts) or within the editor context.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Open capture overlay (global) |
| `Ctrl+Shift+F` | Fullscreen capture (global) |
| `Ctrl+Shift+R` | Repeat last capture region (global) |
| `Ctrl+P` | Quick switcher |
| `Ctrl+S` | Force save current note |
| `Ctrl+N` | Create new note in current folder |
| `Ctrl+Shift+N` | Create new folder |
| `Ctrl+F` | Find in current note |
| `Ctrl+Shift+F` | (when not capturing) Search all notes |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+K` | Insert link |
| `Ctrl+Shift+K` | Insert backlink (`[[`) |
| `Ctrl+E` | Inline code |
| `Ctrl+Shift+E` | Code block |
| `Ctrl+/` | Toggle sidebar |
| `Ctrl+\` | Toggle backlinks panel |
| `Ctrl+Shift+L` | Toggle lecture mode |
| `Ctrl+,` | Open settings |

---

## 14. TAURI COMMANDS (RUST ↔ FRONTEND BRIDGE)

Register all of these in `src-tauri/src/commands/mod.rs`:

### Capture Commands

```rust
#[tauri::command]
async fn start_capture(app: AppHandle) -> Result<(), String>

#[tauri::command]
async fn finish_capture(
    app: AppHandle,
    mode: String,
    x: u32, y: u32,
    width: u32, height: u32,
    points: Option<Vec<(u32, u32)>>,  // for freeform
    note_id: Option<String>,
) -> Result<CaptureResult, String>

#[tauri::command]
async fn repeat_last_capture(app: AppHandle) -> Result<CaptureResult, String>

#[tauri::command]
async fn get_window_list() -> Result<Vec<WindowInfo>, String>
```

### Vault Commands

```rust
#[tauri::command]
async fn create_vault(path: String, name: String) -> Result<VaultConfig, String>

#[tauri::command]
async fn open_vault(path: String) -> Result<VaultConfig, String>

#[tauri::command]
async fn list_vault_contents(vault_path: String) -> Result<Vec<VaultEntry>, String>

#[tauri::command]
async fn create_note(vault_path: String, folder: String, title: String) -> Result<NoteFile, String>

#[tauri::command]
async fn read_note(vault_path: String, note_path: String) -> Result<String, String>

#[tauri::command]
async fn save_note(vault_path: String, note_path: String, content: String) -> Result<(), String>

#[tauri::command]
async fn delete_note(vault_path: String, note_path: String) -> Result<(), String>

#[tauri::command]
async fn rename_note(vault_path: String, old_path: String, new_name: String) -> Result<NoteFile, String>

#[tauri::command]
async fn create_folder(vault_path: String, relative_path: String) -> Result<(), String>
```

### Search Commands

```rust
#[tauri::command]
async fn search_notes(query: String, limit: Option<usize>) -> Result<Vec<SearchResult>, String>

#[tauri::command]
async fn search_screenshots(query: String, limit: Option<usize>) -> Result<Vec<ScreenshotSearchResult>, String>

#[tauri::command]
async fn search_all(query: String, limit: Option<usize>) -> Result<SearchResults, String>

#[tauri::command]
async fn reindex_vault(vault_path: String) -> Result<usize, String>
```

### Export Commands

```rust
#[tauri::command]
async fn export_pdf(vault_path: String, note_path: String, output_path: String) -> Result<(), String>

#[tauri::command]
async fn export_markdown(vault_path: String, note_path: String, output_path: String) -> Result<(), String>
```

### Settings Commands

```rust
#[tauri::command]
async fn get_settings(vault_path: String) -> Result<VaultConfig, String>

#[tauri::command]
async fn update_settings(vault_path: String, settings: VaultConfig) -> Result<(), String>
```

---

## 15. TAURI EVENTS (RUST → FRONTEND)

These events are emitted by the Rust backend and listened to by the React frontend:

| Event Name | Payload | Description |
|------------|---------|-------------|
| `screenshot-captured` | `{ path, thumbnail_path, width, height, captured_at, note_id }` | A screenshot was captured and saved |
| `vault-changed` | `{ event_type, path }` | A file in the vault was created/modified/deleted externally |
| `index-updated` | `{ notes_count, screenshots_count }` | The search index was updated |
| `capture-cancelled` | `{}` | The user pressed Escape during capture |
| `save-status` | `{ status: "saving" \| "saved" \| "error", error?: string }` | Note save status changed |

Frontend listener pattern:

```typescript
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen<CaptureResult>('screenshot-captured', (event) => {
    // Insert image at cursor position in editor
    editor.chain().focus().setImage({ src: event.payload.path }).run();
  });
  return () => { unlisten.then(fn => fn()); };
}, [editor]);
```

---

## 16. SETTINGS UI

File: `src/components/Settings/SettingsModal.tsx`

A modal dialog (triggered by `Ctrl+,` or gear icon in sidebar) with these sections:

### General
- Vault location (display only, with "Move Vault" button)
- Theme: Light / Dark / System (radio buttons)
- Accent color: color picker
- Sidebar width: slider (200-400px)

### Editor
- Font family: dropdown (Inter, SF Pro, Georgia, JetBrains Mono, System Default)
- Font size: slider (12-24px)
- Line height: slider (1.2-2.0)
- Autosave interval: slider (500ms-10000ms)
- Spell check: toggle
- Show line numbers: toggle

### Capture
- Default mode: dropdown (Region, Window, Freeform, Fullscreen)
- Capture hotkey: hotkey recorder input
- Fullscreen hotkey: hotkey recorder input
- Repeat hotkey: hotkey recorder input
- Copy to clipboard: toggle
- Auto-trim whitespace: toggle
- Image format: dropdown (PNG, JPG, WebP)
- JPG quality: slider (50-100) — only visible when format is JPG

### Lecture Mode
- Timestamp format: dropdown (HH:mm:ss, mm:ss, HH:mm)

---

## 17. STATE MANAGEMENT

Use Zustand for all state management. Create these stores:

### vaultStore.ts

```typescript
interface VaultState {
  vaultPath: string | null;
  vaultConfig: VaultConfig | null;
  fileTree: VaultEntry[];
  activeNoteId: string | null;
  activeNotePath: string | null;
  openNotes: string[];  // tabs
  setVaultPath: (path: string) => void;
  setFileTree: (tree: VaultEntry[]) => void;
  setActiveNote: (id: string, path: string) => void;
  refreshFileTree: () => Promise<void>;
}
```

### editorStore.ts

```typescript
interface EditorState {
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  wordCount: number;
  lectureModeActive: boolean;
  lectureModeStartedAt: Date | null;
  setContent: (content: string) => void;
  markDirty: () => void;
  markSaved: () => void;
  toggleLectureMode: () => void;
}
```

### captureStore.ts

```typescript
interface CaptureState {
  isCapturing: boolean;
  captureMode: 'region' | 'window' | 'freeform' | 'fullscreen';
  lastRegion: { x: number, y: number, width: number, height: number } | null;
  multiCaptureQueue: CaptureResult[];
  setCaptureMode: (mode: CaptureMode) => void;
  setLastRegion: (region: Region) => void;
  addToQueue: (result: CaptureResult) => void;
  clearQueue: () => void;
}
```

### settingsStore.ts

```typescript
interface SettingsState {
  settings: VaultConfig;
  updateSettings: (partial: Partial<VaultConfig>) => Promise<void>;
  loadSettings: () => Promise<void>;
}
```

---

## 18. WINDOW LAYOUT

### 18.1 Main Window

The main window layout is a horizontal split:

```
┌─────────────────────────────────────────────────┐
│ Title Bar (custom, draggable)                    │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │ Editor                                │
│ (280px)  │                                       │
│          │ ┌──────────────────────────────────┐  │
│ Search   │ │ Editor Toolbar                   │  │
│ ───────  │ ├──────────────────────────────────┤  │
│ File     │ │                                  │  │
│ Tree     │ │  Note content with inline        │  │
│          │ │  screenshots that never drift    │  │
│          │ │                                  │  │
│          │ │  ![screenshot](attachments/...)  │  │
│          │ │                                  │  │
│          │ │  More text below the image...    │  │
│          │ │                                  │  │
│ ───────  │ ├──────────────────────────────────┤  │
│ Backlinks│ │ Status Bar                       │  │
│ ───────  │ └──────────────────────────────────┘  │
│ Recent   │                                       │
│ Captures │                                       │
├──────────┴──────────────────────────────────────┤
│ (no bottom bar for main window)                  │
└─────────────────────────────────────────────────┘
```

### 18.2 Custom Title Bar

File: `src/components/Layout/TitleBar.tsx`

- Uses Tauri's `decorations: false` for a custom title bar.
- Shows: app icon, vault name, active note title, window controls (minimize, maximize, close).
- The title bar area is draggable (use `data-tauri-drag-region`).
- On macOS, traffic lights are on the left; on Windows, controls are on the right.

### 18.3 Status Bar

File: `src/components/Layout/StatusBar.tsx`

- Fixed at the bottom of the editor area.
- Shows: word count, character count, save status ("Saved" / "Saving..." / "Unsaved changes"), lecture mode timer (if active), cursor position (line:column).

---

## 19. PERFORMANCE REQUIREMENTS

- **App startup:** Under 2 seconds to a usable editor on a cold start.
- **Screenshot capture to insertion:** Under 1 second for region capture.
- **Note switching:** Under 200ms to load and render a note.
- **Search results:** Under 100ms for FTS5 queries.
- **Autosave:** Must not block the editor (run on a background thread).
- **Memory usage:** Under 100MB RSS with 50 notes open in the sidebar and 20 screenshots in the active note.
- **Binary size:** Under 15MB for the final installer.

### Performance Strategies

- Use Tauri's async command system to prevent UI blocking.
- Lazy-load images in the editor — render thumbnails initially, load full resolution on scroll-into-view.
- Debounce all filesystem writes.
- Use SQLite WAL mode for concurrent reads during search.
- Cache the file tree in Zustand — only update on `vault-changed` events, don't re-walk the directory.
- Virtual scrolling for the file tree if the vault has hundreds of files (use a library like `react-virtual`).

---

## 20. BUILD AND DISTRIBUTION

### 20.1 Build Commands

```bash
# Development
cargo tauri dev

# Production build
cargo tauri build
```

### 20.2 tauri.conf.json Essentials

```json
{
  "productName": "NoteVault",
  "version": "1.0.0",
  "identifier": "com.notevault.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "NoteVault",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": false,
        "transparent": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost; style-src 'self' 'unsafe-inline'"
    }
  },
  "plugins": {
    "global-shortcut": {
      "shortcuts": ["CmdOrCtrl+Shift+S", "CmdOrCtrl+Shift+F", "CmdOrCtrl+Shift+R"]
    },
    "fs": {
      "scope": ["$HOME/NoteVault/**", "$APPDATA/**"]
    }
  }
}
```

### 20.3 Asset Protocol

For loading images from the vault into the editor, use Tauri's asset protocol:

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

// Convert a filesystem path to a URL the webview can load
const imageUrl = convertFileSrc(absoluteImagePath);
// Returns: https://asset.localhost/path/to/image.png (or asset://localhost/...)
```

Use this in the Image node's `src` attribute so images load directly from disk without copying to the webview's origin.

---

## 21. PHASED IMPLEMENTATION ORDER

Build in this exact order. Each phase must be fully complete and working before starting the next.

### Phase 1 — Core MVP (Get off OneNote)

1. Project setup with Tauri v2 + React + TypeScript.
2. Vault system: create vault, create folders, create/read/save/delete notes.
3. TipTap editor with StarterKit + Image extension.
4. File tree sidebar with folder/file navigation.
5. Region capture: global hotkey → overlay → select → crop → save → insert at cursor.
6. Autosave to disk.
7. Custom title bar and status bar.
8. Light/dark theme.

### Phase 2 — Better Capture + Search

1. Capture toolbar with all 4 modes (region, window, freeform, fullscreen).
2. Magnifier loupe.
3. Multi-capture mode.
4. Last region repeat hotkey.
5. SQLite indexing with FTS5.
6. Search bar in sidebar.
7. Quick switcher (Cmd+P).

### Phase 3 — Annotation + Lecture Mode

1. Screenshot annotation overlay with Fabric.js.
2. Arrow, rectangle, highlight, text, freehand tools.
3. Annotation save/load as JSON sidecar.
4. Lecture mode with timestamp badges.
5. Slash commands menu.

### Phase 4 — Power Features

1. Backlinks (wikilink syntax + backlink panel).
2. OCR indexing of screenshots.
3. Export to PDF.
4. Export to standalone Markdown.
5. Tag system.
6. Split pane / side-by-side note view.

### Phase 5 — Polish

1. Keyboard shortcut help overlay (Ctrl+?).
2. Drag-to-reorder images in editor.
3. Image lightbox (click to view full resolution).
4. Auto-trim whitespace on screenshots.
5. Settings UI with all options.
6. Performance optimization pass.
7. Onboarding flow for first launch.
8. App icon and branding.

---

## 22. CRITICAL RULES

1. **Images NEVER move on their own.** This is the entire reason the app exists. The document uses a linear flow. Images are block-level elements between paragraphs. Typing above or below an image does not affect its position.
2. **Files on disk are markdown.** The user owns their data. No proprietary formats. Everything is plain text + image files in folders.
3. **Capture must feel instant.** Under 1 second from hotkey to image-in-note. If it's slow, it's broken.
4. **The overlay must cover the full screen and feel native.** No window chrome, no flickering, no visible loading. The frozen screenshot + dim overlay must appear within 200ms of the hotkey press.
5. **Never modify original screenshots.** Annotations are overlays. Cropping creates copies. The original captured image is immutable.
6. **Autosave is not optional.** The user should never lose work. Save on every pause in typing (debounced 2 seconds) and on every note switch or window close.
7. **All Rust operations that touch disk or database must be async.** Never block the UI thread.
8. **Error handling must be user-friendly.** Never show a Rust panic or raw error. Catch errors in the command handlers and return descriptive strings that the frontend can display as toast notifications.
