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
  ~627 ms, 2,243 modules transformed.
- **Output sizes (pre-gzip):**
  - `dist/index.html` — 0.84 kB
  - `dist/assets/index-*.css` — 11.49 kB
  - `dist/assets/index-*.js` — **1,191.88 kB** (370.21 kB gzipped)
  - several small Tauri API chunks (core, path, webviewWindow, …)
- **Non-blocking build warnings:**
  - Main JS chunk exceeds Vite's 500 kB warning threshold (code-splitting /
    `build.rolldownOptions.output.codeSplitting` suggested).
  - `INEFFECTIVE_DYNAMIC_IMPORT` for `src/lib/tauri/commands.ts` — the module is
    dynamically imported by `src/components/Sidebar/FileTreeItem.tsx` but also
    statically imported by `App.tsx`, the Capture components, etc., so the
    dynamic import does not produce a separate chunk.

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
| `npm run build`                     | success, ~1.19 MB JS   |
| `npm run lint` errors               | 8                      |
| `npm run lint` warnings             | 61                     |
| `npm run lint` info                 | 1                      |
| Manual `tauri dev` smoke test       | pending on dev machine |

Subsequent phases must keep `cargo check` and `npm run build` green and must
not introduce new lint errors beyond the 8 recorded above.
