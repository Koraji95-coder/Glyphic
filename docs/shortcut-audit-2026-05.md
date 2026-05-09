# Shortcut audit — May 2026

Date: 2026-05-08

Every entry in `src/lib/shortcuts.ts` is listed below with an honest status
assessment and the decision taken in this PR.

## Decision key

- `keep` — handler already exists; no code change needed.
- `implement` — handler added in this PR.

## Audit table

| Shortcut | Category | Documented in shortcuts.ts | Handler existed before this PR | Decision |
| --- | --- | --- | --- | --- |
| Ctrl+Shift+S | Capture | yes | yes — `useGlobalShortcuts.ts` registers via Tauri `global-shortcut` plugin | keep |
| Ctrl+Shift+F | Capture | yes | yes — same hook | keep |
| Ctrl+Shift+R | Capture | yes | yes — same hook | keep |
| Ctrl+P | Navigation | yes | yes — `QuickSwitcher.tsx:65-75` handles `keydown` | keep |
| Ctrl+N | Navigation | yes | no | implement |
| Ctrl+Shift+N | Navigation | yes | no | implement |
| Ctrl+F | Navigation | yes | no custom handler (browser / Tauri WebView native find-in-page) | keep |
| Ctrl+S | Editor | yes | no — `forceSave` existed in `useEditor.ts` but had no key binding | implement |
| Ctrl+B | Editor | yes | yes — TipTap `StarterKit` ships `Mod-b` → toggle bold | keep |
| Ctrl+I | Editor | yes | yes — TipTap `StarterKit` ships `Mod-i` → toggle italic | keep |
| Ctrl+K | Editor | yes | no — TipTap `Link` extension has no default shortcut; this PR adds a link modal + handler | implement |
| Ctrl+Shift+K | Editor | yes | no — backlink insertion had no picker UI; this PR adds backlink modal + handler | implement |
| Ctrl+E | Editor | yes | yes — TipTap `StarterKit` ships `Mod-e` → toggle inline code | keep |
| Ctrl+Shift+E | Editor | yes | no — documented binding was missing; this PR wires it to `toggleCodeBlock()` | implement |
| Ctrl+Shift+L | Editor | yes | no — `toggleLectureMode()` existed in `editorStore` but had no key binding | implement |
| Ctrl+/ | Layout | yes | yes — `App.tsx:89-92` handles both `/` and `?` | keep |
| Ctrl+? | Layout | yes | yes — same handler | keep |
| Ctrl+, | Layout | yes | yes — `App.tsx:84-87` | keep |
| Ctrl+\ | Layout | yes | yes — `App.tsx:61-66` (with shiftKey for split-down variant) | keep |
| Ctrl+Shift+\ | Layout | yes | yes — same handler | keep |
| Ctrl+W | Layout | yes | yes — `App.tsx:68-76` | keep |
| Ctrl+Shift+A | AI | yes | yes — `App.tsx:55-58` | keep |

## Changes made in this PR

### Implemented

- **Ctrl+N** — dispatches `glyphic:new-note` custom event from `App.tsx`; `Sidebar.tsx` already listens for that event and prompts for a note name.
- **Ctrl+Shift+N** — dispatches `glyphic:new-folder` custom event from `App.tsx`; `Sidebar.tsx` now listens for it and calls the existing `handleNewFolder` handler.
- **Ctrl+S** — dispatches `glyphic:force-save` custom event from `App.tsx`; `Editor.tsx` listens and calls `forceSave()` from `useEditor`.
- **Ctrl+K** — opens `LinkModal` and inserts markdown link text into the active editor.
- **Ctrl+Shift+K** — opens `BacklinkModal` with note search and inserts `[[Note Title]]`.
- **Ctrl+Shift+E** — triggers TipTap `toggleCodeBlock()` via editor action store callback.
- **Ctrl+Shift+L** — handled directly in `App.tsx` by calling `useEditorStore.getState().toggleLectureMode()`.

### Manual test checklist (current)

- Press `Ctrl+K` in editor, enter URL/text, click Insert, confirm markdown link is inserted.
- Press `Ctrl+Shift+K`, search a note title, press Enter, confirm `[[Note Title]]` is inserted.
- Press `Ctrl+Shift+E` on a paragraph line, confirm code block toggles on and off.

### Title-bar search icon

- `TitleBar.tsx` now dispatches `glyphic:open-quick-switcher` on click.
- `QuickSwitcher.tsx` listens for that event in addition to its existing `Ctrl+P` keydown handler.
