# Glyphic Baseline

Verified working as of **2026-04-20** on commit `e8189e4` (branch `copilot/glyphic-full-implementation-plan`).

This file records the baseline state of the repository at the start of the full
implementation plan (Phase 0.1). Subsequent phases should not regress any of the
signals below without an explicit, documented reason.

## Environment

| Tool    | Version                          |
| ------- | -------------------------------- |
| Node    | v24.14.1                         |
| npm     | 11.11.0                          |
| rustc   | 1.94.1 (e408947bf 2026-03-25)    |
| cargo   | 1.94.1 (29ea6fb6a 2026-03-24)    |
| OS      | Ubuntu 24.04 (x86_64-linux-gnu)  |

### System libraries required for `cargo check`

The Tauri v2 Rust backend links against GTK/WebKit system libraries. On a fresh
Ubuntu/Debian host these must be installed before `cargo check` will succeed:

```bash
sudo apt-get install -y \
  libglib2.0-dev libgtk-3-dev libsoup-3.0-dev \
  libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev
```

## Build & check results

All commands run from the repo root unless otherwise noted.

### `npm install`
- **Status:** ✅ success
- Output: `added 120 packages, and audited 121 packages` — `found 0 vulnerabilities`.

### `cargo check` (in `src-tauri/`)
- **Status:** ✅ success — `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 1m 28s`.
- **Warnings:** 1 future-incompatibility warning from the transitive dependency
  `xcap v0.0.14` (not from Glyphic code). Surfaced via
  `cargo report future-incompatibilities --id 1`. No first-party warnings.

### `npm run build` (= `tsc && vite build`)
- **Status:** ✅ success — TypeScript compiles cleanly, Vite build finishes in
  ~470 ms, 2,259 modules transformed.
- **Output sizes (post Phase 5 PR 8 perf pass, pre-gzip):**
  - `dist/index.html` — 1.24 kB
  - `dist/assets/index-*.css` — 11.49 kB
  - `dist/assets/index-*.js` — **174.17 kB** (48.08 kB gzipped) ← main chunk
  - `dist/assets/tiptap-*.js` — 364.37 kB (116.02 kB gzipped)
  - `dist/assets/fabric-*.js` — 289.84 kB (87.99 kB gzipped) — lazy-loaded with the annotation overlay
  - `dist/assets/react-vendor-*.js` — 209.49 kB (66.76 kB gzipped)
  - `dist/assets/lowlight-*.js` — 161.70 kB (51.40 kB gzipped)
  - `dist/assets/CaptureOverlay-*.js` — 11.41 kB (lazy route)
  - `dist/assets/AnnotationOverlay-*.js` — 10.50 kB (lazy)
  - `dist/assets/PrintPreview-*.js` — 4.47 kB (lazy route)
  - several small Tauri API chunks (core, path, webviewWindow, …)
- **Build warnings:** none. The previous `INEFFECTIVE_DYNAMIC_IMPORT` and the
  500 kB chunk-size warnings are both gone — `commands.ts` is now imported
  statically everywhere, and `vite.config.ts`'s `manualChunks` splits
  `react-vendor`, `tiptap`, `fabric`, and `lowlight` into their own files.

#### Historical baseline (pre-perf-pass)
- Main chunk was **1,191.88 kB** (370.21 kB gzipped). Vite emitted a
  `INEFFECTIVE_DYNAMIC_IMPORT` warning for `src/lib/tauri/commands.ts` because
  the module was both dynamically imported by `Sidebar/FileTreeItem.tsx` and
  statically imported elsewhere.

### `npm run lint` (= `biome check .`)
- **Status:** ⚠️ fails with pre-existing findings, as expected by the plan.
- **Totals:** **8 errors, 61 warnings, 1 info** across 66 files.
- Sample error (first reported):
  `src/components/Chat/AiSettingsPanel.tsx:195:15 lint/a11y/noLabelWithoutControl`
  — "A form label must be associated with an input."
- Biome truncates output with
  "The number of diagnostics exceeds the limit allowed." Full output is
  reproducible with `npm run lint -- --max-diagnostics=200`.
- These 8 errors are the baseline the plan refers to as "existing 8 errors
  (addressed in Phase 5)." Future phases must not introduce new lint errors.

## Runtime smoke test (`npm run tauri dev`)

The baseline script calls for a manual smoke test:

> Run `npm run tauri dev`. Create a vault, create a note, type text, confirm it
> saves (file appears under `~/Glyphic/Unsorted/notes/`).

**Status in this environment:** _not executable in the headless CI sandbox_ —
`cargo tauri dev` requires a running display server (X11/Wayland) to open the
WebView window, which is not available here. The smoke test must be rerun on a
local developer machine before declaring Phase 0 complete.

What was verified headlessly that stands in for parts of the smoke test:
- Rust backend compiles (`cargo check`).
- Frontend bundles cleanly (`vite build`).
- No changes to vault on-disk layout since the prior release; notes continue to
  be written to `~/Glyphic/<VaultName>/Unsorted/notes/` with YAML frontmatter
  (`title`, `created`, `modified`, `tags: []`, `lecture_timestamps: []`) per
  `src-tauri/src/vault/manager.rs`.

## Baseline summary (do-not-regress list)

| Signal                              | Baseline               |
| ----------------------------------- | ---------------------- |
| `npm install`                       | 0 vulnerabilities      |
| `cargo check` (first-party)         | 0 errors, 0 warnings   |
| `cargo check` (transitive)          | 1 future-incompat warn (xcap 0.0.14) |
| `npm run build`                     | success, main 174 kB / total 1.23 MB across split chunks |
| `npm run lint` errors               | 8                      |
| `npm run lint` warnings             | 61                     |
| `npm run lint` info                 | 1                      |
| Manual `tauri dev` smoke test       | pending on dev machine |

Subsequent phases must keep `cargo check` and `npm run build` green and must
not introduce new lint errors beyond the 8 recorded above.
