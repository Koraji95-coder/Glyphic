# Glyphic state assessment — May 2026

Date: 2026-05-08

## 1) Phase D feature inventory

Status key: **Present**, **Partial**, **Missing**.

1. **Multi-note tab bar — Present**
   - Implemented with `openNotes` state in `src/stores/vaultStore.ts:11-44`.
   - Rendered in title bar tab strip and close/new-tab UX in `src/components/Layout/TitleBar.tsx:140-258`.

2. **Pinned notes section — Present**
   - Pin/unpin store actions in `src/stores/vaultStore.ts:12,19-20,45-52`.
   - Dedicated sidebar “Pinned” section in `src/components/Sidebar/Sidebar.tsx:165-241`.

3. **Focus mode toggle — Present**
   - State + toggle in `src/stores/layoutStore.ts:9,18,39,47`.
   - Title bar toggle button in `src/components/Layout/TitleBar.tsx:281-300`.
   - F11 keyboard binding in `src/App.tsx:77-81`.

4. **Breadcrumb bar — Present**
   - Breadcrumb path derivation and UI bar in `src/components/Editor/Editor.tsx:159-192`.

5. **Tags browser — Present**
   - Tag browser/chips panel in `src/components/Sidebar/TagsPanel.tsx:5-103`.

6. **Quick Switcher improvements — Present**
   - Fuse-based search, create-when-no-match, keyboard nav hints, scroll-into-view in `src/components/QuickSwitcher/QuickSwitcher.tsx:44-91,101-141,235-272`.
   - Title-bar search icon now wired — clicking it dispatches `glyphic:open-quick-switcher`; `QuickSwitcher.tsx` listens for that event in addition to `Ctrl/Cmd+P`.

7. **Vault header with live statistics — Present**
   - Runtime counts from file tree via `countEntries` in `src/components/Sidebar/Sidebar.tsx:40-43,343-360`.
   - Header display (`{noteCount} notes · {folderCount} folders`) in `src/components/Sidebar/Sidebar.tsx:119-151`.

8. **Keyboard shortcuts — Present**
   - Shortcut registry in `src/lib/shortcuts.ts` (3 removed catalog entries that had no handlers; see `docs/shortcut-audit-2026-05.md`).
   - Help modal renders live registry via `src/components/Help/ShortcutHelp.tsx`.
   - All listed shortcuts now have handlers: capture in `useGlobalShortcuts.ts`, quick-switcher in `QuickSwitcher.tsx`, note management / force-save / lecture-mode / layout / AI in `src/App.tsx`, TipTap built-ins (Bold/Italic/Code) via `StarterKit`.
   - Title-bar search icon wired to `glyphic:open-quick-switcher` event (`src/components/Layout/TitleBar.tsx:302-311`).
   - Quick Switcher listens to both `Ctrl+P` keydown and `glyphic:open-quick-switcher` event.

9. **Markdown export with attachments — Present**
   - Toolbar wiring in `src/components/Editor/EditorToolbar.tsx:48-71,352-373`.
   - Backend export rewrites image paths and copies attachment files in `src-tauri/src/export/markdown.rs:1-47,53-57,127-155`.

10. **PDF export via print preview — Present**
    - Toolbar wiring in `src/components/Editor/EditorToolbar.tsx:73-91,374-395`.
    - Print-preview window command in `src-tauri/src/commands/export_commands.rs:4-48`.
    - Frontend wrapper documents OS print flow in `src/lib/export/pdfExport.ts:25-36`.

11. **Wikilinks parsing + backlink panel — Present**
    - Wikilink parsing and backlink persistence are implemented in backend: `src-tauri/src/db/backlinks.rs:7-17,98-119,253-287`.
    - Tauri command exists: `src-tauri/src/commands/search_commands.rs:34-40`; frontend invoke exists: `src/lib/tauri/commands.ts:118`.
    - Backlink panel UI is present in the sidebar (`src/components/Sidebar/BacklinksPanel.tsx`) and renders backlink source + context.

12. **Ollama integration with progress streaming — Present**
    - Pull-model progress streaming emitted from Rust in `src-tauri/src/ai/ollama.rs:327-394` and command entry in `src-tauri/src/commands/ai_commands.rs:314-324`.
    - Frontend listener + progress state in `src/components/Chat/AiSettingsPanel.tsx:96-157`.
    - Chat token streaming also present via `chat-stream-*` events (`src-tauri/src/commands/ai_commands.rs:350-365`; `src/lib/tauri/events.ts:50-57`).

## 2) Existing sidecar pattern (`vault_engine`, `diagram_engine`, `study_engine`)

### 2.1 Python source locations
- Vault sidecar: `sidecars/vault_engine/main.py:1-515`
- Diagram sidecar: `sidecars/diagram_engine/main.py:1-257`
- Study sidecar: `sidecars/study_engine/main.py` — four actions: `study_ask`, `grade_math_answer`, `solve_math`, `generate_problems`
- Diagram sidecar now also supports `generate_code` (NL → diagram code) with NDJSON progress/final/error events.

### 2.2 Rust launch/spawn path (exact files/functions)
- Vault sidecar launch path resolution + command selection:
  - `src-tauri/src/commands/vault_study.rs:10-48` (`vault_engine_path`, `vault_python_cmd`)
- Vault spawn + stdio wiring:
  - `src-tauri/src/commands/vault_study.rs:60-128` (`run_vault_engine`)
- Diagram sidecar launch path resolution + command selection:
  - `src-tauri/src/commands/diagram_commands.rs:10-48` (`diagram_engine_path`, `diagram_python_cmd`)
- Diagram spawn + stdio wiring:
  - `src-tauri/src/commands/diagram_commands.rs:53-104` (`run_diagram_engine`)
- Study sidecar launch path resolution + command selection:
  - `src-tauri/src/commands/study.rs` (`study_engine_path`, `study_python_cmd`)
- Study spawn + stdio wiring:
  - `src-tauri/src/commands/study.rs` (`run_study_engine`)

### 2.3 IPC convention
- Both sidecars are newline-delimited JSON over stdin/stdout:
  - Vault docs + writer: `sidecars/vault_engine/main.py:6-8,90-94`
  - Diagram docs + writer: `sidecars/diagram_engine/main.py:6-8,78-82`
- Rust side reads line-by-line JSON (`BufReader::lines()`):
  - Vault: `src-tauri/src/commands/vault_study.rs:93-124`
  - Diagram: `src-tauri/src/commands/diagram_commands.rs:85-100`

### 2.4 Error propagation path
- Sidecars emit structured error JSON (`{"status":"error"...}` or `{"error":...}`):
  - Vault: `sidecars/vault_engine/main.py:214-215,246-247,325-326,386-387,489-490,509-511`
  - Diagram: `sidecars/diagram_engine/main.py:20-23,215-216,237-238,250-251`
- Rust command spawn/IO failures return `Err(String)` to Tauri invoke caller:
  - Vault: `src-tauri/src/commands/vault_study.rs:77,84,89,97,127`
  - Diagram: `src-tauri/src/commands/diagram_commands.rs:69,76,82,88,103`
- UI handles either rejected invoke or payload error fields:
  - Vault mode catches invoke errors and surfaces status text: `src/components/vault/VaultMode.tsx:84-89,121-131,155-160`
  - Diagram mode displays returned `result.error`: `src/components/diagrams/DiagramMode.tsx:147-151,431-446`

### 2.5 Dependency declaration and pinning
- Sidecar installer uses venv + pinned requirements files:
  - `sidecars/install_deps.sh:17-31`
- Vault deps file (all pinned): `sidecars/vault_engine/Requirements.txt:1-30`
- Diagram deps file (all pinned): `sidecars/diagram_engine/Requirements.txt:1-14`

### 2.6 Bundling in Tauri
- Sidecars are bundled via resources glob only:
  - `src-tauri/tauri.conf.json:13-15` (`"../sidecars/**/*"`)
- No explicit Tauri sidecar binary declarations are present in `tauri.conf.json` (no `externalBin`/sidecar stanza in this file).

## 3) Governance state

1. **`.github/copilot-instructions.md`**
   - **Does not exist** (path absent in repository root).

2. **`AGENTS.md`**
   - **Does not exist** (path absent in repository root).

3. **Copilot Coding Agent enablement signal (`@copilot` assignable)**
   - Evidence indicates assignability exists: open issue #70 includes `Copilot` in assignees (`assignees: ["Copilot", "Koraji95-coder"]`) from GitHub issue search metadata.

4. **`.github/prompts/` directory**
   - **Does not exist** in this repository.

5. **README local-AI-only constraint documentation**
   - README says “local-first, AI-augmented” (`README.md:3`) but does **not** state a strict local-AI-only rule.
   - Current UI explicitly supports OpenAI cloud provider (`src/components/Chat/AiSettingsPanel.tsx:290-307`).

6. **Branch protection on `main`**
   - `main` reports `protected: false` in branch metadata from GitHub branch listing (no protection rules detected by this check).

## 4) Configuration health

### 4.1 `src-tauri/tauri.conf.json`
- Identifier: `com.glyphic.app` (`src-tauri/tauri.conf.json:5`)
- Resources array: `"../sidecars/**/*"` (`src-tauri/tauri.conf.json:13-15`)
- Sidecar declarations: none beyond resource glob (same file).

### 4.2 `src-tauri/Cargo.toml`
- `tokio` features: `full` (`src-tauri/Cargo.toml:32`)
- `rusqlite` present (`0.31`, `bundled`) (`src-tauri/Cargo.toml:25`)
- `serde_json` present (`1`) (`src-tauri/Cargo.toml:23`)
- Other notable versions:
  - `tauri = "2"` (`src-tauri/Cargo.toml:16`)
  - `reqwest = "0.12"` (`src-tauri/Cargo.toml:33`)

### 4.3 `package.json`
- Scripts include `lint`, `build`, `test`, `tauri`, `desktop`: `package.json:6-17`
- Key deps:
  - React 19 (`package.json:49-50`)
  - Vitest (`package.json:67` and script `test` at `package.json:14`)
  - KaTeX (`package.json:44`)

### 4.4 Python version pin
- No repository-level Python runtime pin file found (`.python-version`, `pyproject.toml`, `runtime.txt` absent).
- Sidecar deps are pinned by package version in `Requirements.txt` files (`sidecars/vault_engine/Requirements.txt:5-30`, `sidecars/diagram_engine/Requirements.txt:5-14`).

## 5) Test surface

### 5.1 Rust tests
- `src-tauri/tests/`: **0 files** (directory-level integration tests absent).
- Inline `#[cfg(test)]` modules: **7 files**
  - `src-tauri/src/db/backlinks.rs:289`
  - `src-tauri/src/db/tags.rs:95`
  - `src-tauri/src/db/annotations.rs:95`
  - `src-tauri/src/commands/study.rs:193`
  - `src-tauri/src/commands/fe_commands.rs:359`
  - `src-tauri/src/commands/flashcards.rs:264`
  - `src-tauri/src/capture/postprocess.rs:186`
- Inline `#[test]` count (all Rust source): **27**.
- Representative test: `extracts_wikilinks` in `src-tauri/src/db/backlinks.rs:293-300`.

### 5.2 Python tests
- `sidecars/*/tests/`: **7 Python test files found** (`sidecars/diagram_engine/tests/conftest.py`, `sidecars/diagram_engine/tests/test_generate_code.py`, `sidecars/study_engine/tests/__init__.py`, `sidecars/study_engine/tests/conftest.py`, `sidecars/study_engine/tests/test_study_engine.py`, `sidecars/study_engine/tests/test_solve_math.py`, `sidecars/study_engine/tests/test_generate_problems.py`).

### 5.3 Frontend tests
- Test files found: **4**
  - `src/__tests__/frontmatter.test.ts`
  - `src/__tests__/phaseD.test.ts`
  - `src/__tests__/smoke.test.ts`
  - `src/lib/tiptap/__tests__/roundtrip.test.ts`
- Representative test: pinned note store behavior in `src/__tests__/phaseD.test.ts:12-26`.

### 5.4 CI configuration
- Workflow files: **1** (`.github/workflows/ci.yml`)
- Representative job snippet: lint/typecheck and rust-check jobs in `.github/workflows/ci.yml:13-67`.

## 6) Hidden work

### 6.1 Branches other than `main` (67)
(Branch name — last commit date — one-line summary from head commit subject)

- `chore/feat--add-vault-engine-sidecar-for-document-ingestion-and-querying` — 2026-05-05T22:38:36-05:00 — feat: add vault engine sidecar for document ingestion and querying
- `copilot/add-ai-model-frontmatter-support` — 2026-04-22T06:49:06-05:00 — Merge pull request #51 from Koraji95-coder/copilot/p5-4-merge-ai-model-override
- `copilot/add-automatic-model-routing` — 2026-04-15T17:33:36Z — feat: add automatic model routing to ScribeAI
- `copilot/add-export-to-pdf-functionality` — 2026-04-22T12:41:47Z — [T6.3] Export rendered note to PDF
- `copilot/add-flashcard-review-session-ui` — 2026-04-22T12:41:37Z — fix: address code review comments in flashcard review session
- `copilot/add-katex-math-rendering` — 2026-04-21T21:29:42Z — [P4.1] Add KaTeX math support (inline and block)
- `copilot/add-mermaid-diagram-support` — 2026-04-22T12:36:21Z — security: sanitize mermaid SVG output with DOMPurify
- `copilot/add-ocr-availability-banner` — 2026-04-21T21:33:29Z — fix: use proper apostrophe in OcrBanner text
- `copilot/add-ollama-model-pulling-in-picker` — 2026-04-22T06:17:59-05:00 — Merge pull request #50 from Koraji95-coder/copilot/p53-merge-ollama-model-pulling
- `copilot/add-ollama-status-banner` — 2026-04-22T02:29:32Z — Merge origin/main to resolve ChatPanel.tsx conflict
- `copilot/add-stop-button-to-chat-stream` — 2026-04-22T05:49:00Z — fix: remove duplicate impl block and clean up stream listener teardown
- `copilot/add-test-connection-button` — 2026-04-22T00:53:30Z — [P5.4] Add Test connection button to AI settings
- `copilot/add-vitest-roundtrip-test-suite` — 2026-04-21T21:35:37Z — test(tiptap): add Vitest round-trip suite for markdown serializer/parser
- `copilot/analyze-command-registrations` — 2026-05-06T06:01:47Z — fix: address code review feedback - store activNotePath in Zustand, named SM-2 constants, fix question placeholder
- `copilot/audit-fix-loose-ends-pr-20-38` — 2026-04-22T06:58:05Z — Initial plan
- `copilot/audit-glyphic-repository` — 2026-04-25T21:22:01Z — Changes before error encountered
- `copilot/create-implementation-plan` — 2026-04-22T10:38:44-05:00 — Merge pull request #45 from Koraji95-coder/copilot/add-ollama-model-pulling-in-picker
- `copilot/create-ui-implementation-plan` — 2026-04-17T02:15:49Z — feat: implement mockup design system - themes, sidebar, tab bar, chat, statusbar
- `copilot/debug-glyphic-build-issue` — 2026-04-16T22:47:56Z — Add Glyphic app icons and fix Windows build error
- `copilot/docs-create-state-assessment-2026-05` — 2026-05-08T04:46:56Z — Initial plan
- `copilot/explore-codebase-and-create-plan` — 2026-04-15T08:48:48Z — Fix critical issues: export command signatures, vault path expansion, markdown-to-HTML parser
- `copilot/explore-codebase-and-implementation-plan` — 2026-04-20T10:09:43-05:00 — Merge pull request #21 from Koraji95-coder/copilot/fix-frontmatter-wipe-issue
- `copilot/explore-codebase-and-implementation-plan-again` — 2026-04-21T06:11:40Z — Address code review: vault guard, simplify pixel_close, log state errors, doc Ctrl+W
- `copilot/explore-codebase-and-plan-implementation` — 2026-05-08T03:29:37Z — fix(deps): upgrade Pillow 10.3.0 → 12.2.0 to patch three CVEs (OOB write PSD, integer overflow PSD, FITS GZIP decompression bomb)
- `copilot/explore-codebase-implementation-plan` — 2026-04-20T14:03:18Z — Address review: stable note ids on save, cross-platform title, safer composeNote, narrower asset scope
- `copilot/explore-codebase-implementation-plan-again` — 2026-04-21T10:06:56Z — fix: address code review — UTF-8 percent_decode, Windows path comment, OCR tuple comment
- `copilot/explore-codebase-implementation-plan-another-one` — 2026-04-22T10:38:44-05:00 — Merge pull request #45 from Koraji95-coder/copilot/add-ollama-model-pulling-in-picker
- `copilot/explore-codebase-implementation-plan-yet-again` — 2026-05-05T22:53:52-05:00 — Merge pull request #61 from Koraji95-coder/copilot/fix-sentence-transformer-issue
- `copilot/feat-implement-phase-d-ui-redesign` — 2026-05-08T04:10:02Z — fix: address code review — accurate line count via textBetween, remove unnecessary Pin re-export from Sidebar
- `copilot/fix-atomic-write-for-notes` — 2026-04-21T10:43:41Z — [P1.3] Make save_note atomic via temp-file + rename
- `copilot/fix-capability-allowlist` — 2026-04-21T10:35:10Z — [P1.1] Add capture-overlay to capabilities window allowlist
- `copilot/fix-capture-overlay-issues` — 2026-04-21T13:18:09Z — [P2.1] Wire capture overlay to a frozen screenshot background
- `copilot/fix-copilot-integration-issue` — 2026-04-25T23:31:40Z — Initial plan
- `copilot/fix-delete-note-data-loss` — 2026-04-21T10:43:04Z — Verify cargo check passes with trash crate
- `copilot/fix-frontmatter-wipe-issue` — 2026-04-20T14:54:35Z — Step 6: tesseract OCR + screenshots indexing; harden annotation paths
- `copilot/fix-global-capture-shortcuts` — 2026-04-21T14:24:54Z — clarify cleanup ordering in useGlobalShortcuts
- `copilot/fix-global-shortcut-issue` — 2026-04-16T23:35:09Z — Fix global-shortcut plugin config: remove empty map that caused deserialization error
- `copilot/fix-merge-conflicts-pr-40` — 2026-04-22T01:14:39Z — [P5.2] Add model picker that lists installed Ollama models
- `copilot/fix-model-routing-defaults` — 2026-04-21T12:43:47Z — [P1.5] Default AI routing to llama3.1 / llava for fresh installs
- `copilot/fix-npm-run-desktop-error` — 2026-04-16T22:10:24Z — Add desktop script and omit optional deps to remove deprecation warnings
- `copilot/fix-provider-name-casing-bug` — 2026-04-22T09:31:31Z — fix(ai): case-insensitive provider check so Ollama banner + model picker actually render
- `copilot/fix-rand-library-unsafe-issue` — 2026-04-16T23:07:04Z — chore: cargo update to get latest compatible dependency versions
- `copilot/fix-renamed-note-path` — 2026-04-21T21:00:18Z — [P3.2] Preserve note ID and update DB on rename
- `copilot/fix-sentence-transformer-issue` — 2026-05-06T03:41:42Z — Fix SentenceTransformer 'Variable not allowed' type annotation in main.py
- `copilot/fix-sidebar-image-visibility` — 2026-04-21T10:43:03Z — [P1.4] Filter file tree to hide attachments and image files
- `copilot/fix-vault-watcher-issues` — 2026-04-21T21:02:31Z — docs: document why event_type is hardcoded to 'changed' in coalesced watcher
- `copilot/glyphic-full-implementation-plan` — 2026-04-20T16:14:38Z — [P0.1] establish baseline and add BASELINE.md
- `copilot/implement-advanced-study-math-modes` — 2026-05-08T04:38:11Z — feat: implement study_ask, grade_math_answer commands and FePrepMode AI grading
- `copilot/p5-1-show-ollama-connection-banner` — 2026-04-22T01:11:20Z — [P5.1] Show Ollama connection banner in chat panel
- `copilot/p5-4-merge-ai-model-override` — 2026-04-22T11:42:52Z — Merge main into copilot/add-ai-model-frontmatter-support
- `copilot/p53-merge-ollama-model-pulling` — 2026-04-22T09:50:46Z — Merge main into copilot/add-ollama-model-pulling-in-picker
- `copilot/persist-ai-config-to-file` — 2026-04-21T21:07:29Z — Address code review: create_dir_all in save(), disable save button when no vault
- `copilot/phase-2-work` — 2026-04-16T21:57:15Z — Address code review feedback: stable keys, improved sanitizer, clarifying comments
- `copilot/phase-3-development` — 2026-04-15T15:08:58Z — Address code review feedback: fix deps, remove unused props, add error handling
- `copilot/reconcile-tauri-config-drift` — 2026-04-20T16:25:56Z — CI: restrict GITHUB_TOKEN permissions; clarify Phase 5 TODO
- `copilot/rename-zero-claw-to-scribeai` — 2026-04-15T21:22:27Z — fix: UTF-8 safe truncation in get_note, remove misleading detectToolCall from chatStore
- `copilot/replace-text-inputs-with-dropdowns` — 2026-04-22T00:57:12Z — Extract getModelOptions helper for model dropdown logic
- `copilot/restyle-glyphic-app-ui` — 2026-04-15T16:02:05Z — feat: Phase 4 — UI overhaul + ScribeAI chat panel
- `copilot/start-phase-2` — 2026-04-15T13:55:02Z — Address code review feedback: fix window coords, remove dead code, improve parse error handling
- `copilot/tablet-ready-responsive-layout` — 2026-04-15T20:02:36Z — fix: named constant for palm rejection delay, crypto.randomUUID fallback, remove deprecated webkit scroll prop
- `copilot/toggle-note-context-visibility` — 2026-04-22T00:53:21Z — fix: add aria-label to context badge buttons for screen reader accessibility
- `copilot/update-dependencies-and-vite` — 2026-04-16T21:32:15Z — Use ES2023 target in tsconfig.node.json for wider Node.js compatibility
- `copilot/update-progress-on-plan` — 2026-05-07T22:34:31-05:00 — Merge pull request #64 from Koraji95-coder/copilot/explore-codebase-and-plan-implementation
- `copilot/update-tauri-config-plugins-fs` — 2026-04-17T00:35:55Z — Fix Tauri v2 FS plugin config crash: remove scope, add capabilities/default.json
- `copilot/wire-zero-claw-ai-engine` — 2026-04-15T16:30:47Z — fix: rename providerName to modelName in chatStore for clarity
- `dependabot/cargo/src-tauri/cargo-1a59d422c9` — 2026-04-23T01:08:23Z — Bump openssl in /src-tauri in the cargo group across 1 directory
- `dependabot/pip/sidecars/vault_engine/pip-69113fc996` — 2026-05-08T03:35:46Z — build(deps): bump the pip group across 1 directory with 2 updates

### 6.2 Open issues (one-line titles)
- #70 — docs(assessment): repo state assessment before completion plan execution
- #68 — Implement Advanced Study and Math Modes
- #66 — feat: implement Phase D UI redesign and outstanding roadmap items.
- #60 — Main.py Sentence Transformer issue
- #57 — Issue when trying to get copilot to work on this app.

### 6.3 Recently merged PRs (last 30 days)
(57 merged PRs in window `>= 2026-04-08`; shown with merge timestamp)

- #69 — 2026-05-08T04:39:55Z — Implement study_ask and grade_math_answer: context-grounded Q&A and AI math grading
- #67 — 2026-05-08T04:21:32Z — feat: Phase D UI redesign — pinned notes, focus mode, cursor position, Quick Switcher polish
- #64 — 2026-05-08T03:34:32Z — fix(deps): upgrade Pillow 10.3.0 → 12.2.0 to patch three CVEs
- #63 — 2026-05-06T06:07:47Z — feat: wire sidebar buttons, fix lint/CI, add TS command stubs, flashcard SRS persistence, FE Exam Prep UI
- #61 — 2026-05-06T03:53:52Z — Fix SentenceTransformer "Variable not allowed in type expression" in vault engine
- #59 — 2026-05-06T03:38:58Z — feat: add vault engine sidecar for document ingestion and querying
- #56 — 2026-04-25T23:30:53Z — Refocus Glyphic on STEM studying: harden Ollama path, add math affordances, fix save_note id churn
- #45 — 2026-04-22T15:38:44Z — [P5.3] Show Ollama model-pull progress in the model picker
- #46 — 2026-04-22T15:38:29Z — [P5.4] Per-note AI model override via frontmatter
- #54 — 2026-04-22T15:37:23Z — [T6.4] Add flashcard review session UI
- #53 — 2026-04-22T12:44:55Z — [T6.3] Export rendered note to PDF
- #52 — 2026-04-22T12:42:09Z — [T6.1] Render Mermaid diagrams in markdown code blocks
- #51 — 2026-04-22T11:49:06Z — Merge main into copilot/add-ai-model-frontmatter-support (conflict resolution)
- #50 — 2026-04-22T11:17:59Z — Merge main into copilot/add-ollama-model-pulling-in-picker (resolve P5.1/P5.2/casing-fix conflicts)
- #49 — 2026-04-22T09:34:35Z — fix(ai): case-insensitive provider check so Ollama banner + model picker actually render
- #47 — 2026-04-22T07:02:02Z — [P5.5] Stop button to cancel in-flight Ollama generation
- #48 — 2026-04-22T07:02:40Z — [WIP] Audit and address loose ends from PRs #20–#38
- #39 — 2026-04-22T02:46:25Z — [P5.1] Show Ollama connection banner in chat panel
- #44 — 2026-04-22T01:26:51Z — [P5.2] Add Ollama model picker to AI settings
- #43 — 2026-04-22T01:17:14Z — [P5.1] Show Ollama connection banner in chat panel
- #42 — 2026-04-22T00:56:48Z — [P5.4] Add Test connection button to AI settings
- #41 — 2026-04-22T00:56:56Z — feat: visible, toggleable note context for ScribeAI chat
- #36 — 2026-04-21T22:27:43Z — test(tiptap): Vitest round-trip suite for markdown serializer/parser + 3 bug fixes
- #38 — 2026-04-21T22:25:03Z — [P4.3] Show OCR install banner when tesseract is missing
- #37 — 2026-04-21T21:31:36Z — [P4.1] Add KaTeX math support (inline and block)
- #35 — 2026-04-21T21:21:00Z — [P3.4] Persist AI config to /.glyphic/ai.toml
- #33 — 2026-04-21T21:03:30Z — [P3.2] Preserve note ID and update DB on rename
- #34 — 2026-04-21T21:03:40Z — [P3.3] Widen watcher ignores and coalesce file events
- #32 — 2026-04-21T20:00:33Z — [P3.1] Register global capture hotkeys (Ctrl+Shift+S/F/R)
- #31 — 2026-04-21T14:01:49Z — [P2.1] Wire capture overlay to a frozen screenshot background
- #30 — 2026-04-21T12:54:22Z — Default AI model routing to llama3.1 / llava for fresh installs
- #29 — 2026-04-21T12:41:45Z — [P1.4] Filter attachments dir and image files from sidebar file tree
- #28 — 2026-04-21T12:41:18Z — [P1.3] Make save_note atomic via temp-file + rename
- #27 — 2026-04-21T12:41:32Z — [P1.2] Move deleted notes to OS trash instead of hard-deleting
- #26 — 2026-04-21T10:38:09Z — Add capture-overlay window to Tauri capability allowlist
- #25 — 2026-04-21T10:10:42Z — feat: fix tags live-save, markdown export with attachments, 8 lint errors, PDF CSS, OCR settings
- #24 — 2026-04-21T06:14:31Z — Finish Plan A: tags, split pane, settings, shortcut help, lightbox, auto-trim, onboarding, perf
- #23 — 2026-04-21T00:13:48Z — Phase 0.2–0.4: collapse Tauri config, add CI, scaffold Vitest
- #22 — 2026-04-20T16:17:10Z — [P0.1] Establish baseline and add BASELINE.md
- #21 — 2026-04-20T15:09:43Z — Implement PDF/Markdown export, backlinks, OCR, annotation indexing, and fix markdown round-trip
- #20 — 2026-04-20T14:07:01Z — Fix data-loss bugs in note save path and wire up vault DB, watcher, and asset protocol
- #19 — 2026-04-17T02:19:24Z — feat: Implement mockup design system across UI components
- #18 — 2026-04-17T01:05:10Z — Fix Tauri v2 startup crash: migrate fs plugin scope to capabilities
- #17 — 2026-04-16T23:36:33Z — Fix global-shortcut plugin deserialization panic on startup
- #16 — 2026-04-16T23:22:41Z — chore: cargo update to mitigate rand and glib security advisories
- #15 — 2026-04-16T22:56:22Z — Add app icons and bundle config to fix Windows build
- #14 — 2026-04-16T22:40:10Z — Add `desktop` script and drop fabric's optional Node.js deps
- #13 — 2026-04-16T22:00:22Z — Phase 2: Better Capture + Search
- #12 — 2026-04-16T21:37:06Z — Upgrade Vite 8, React 19, add Biome, remove Tailwind CSS
- #11 — 2026-04-15T21:33:26Z — Phase 7: ZeroClaw → ScribeAI rename + MCP protocol foundation
- #10 — 2026-04-15T20:49:04Z — Phase 6: Responsive layout + Apple Pencil / stylus input foundation
- #9 — 2026-04-15T19:49:05Z — feat(ai): automatic per-task model routing in ScribeAI
- #8 — 2026-04-15T16:33:20Z — Phase 5: Wire ScribeAI backend — Ollama/OpenAI providers, RAG context, settings UI
- #7 — 2026-04-15T16:06:52Z — feat: Phase 4 — SnapScribe UI overhaul + ScribeAI chat panel
- #5 — 2026-04-15T15:12:48Z — Phase 3: Annotation overlay, lecture mode, and slash commands
- #4 — 2026-04-15T14:51:41Z — Phase 2: All capture modes, magnifier loupe, multi-capture, last-region repeat, FTS5 search integration
- #1 — 2026-04-15T13:33:16Z — Stage 1: Glyphic — Tauri v2 + React + TypeScript note-taking app with screenshot capture

## 7) Plan corrections (wrong claim vs. correct finding)

| Wrong claim | Correct finding |
|---|---|
| “Keyboard shortcuts” are comprehensively implemented as listed. | Resolved — shortcut catalog trimmed to only wired shortcuts, all remaining entries have handlers, title-bar search icon wired. See `docs/shortcut-audit-2026-05.md`. |

## 8) Recommended slice order (next 4–6 PRs)

Principle applied: each slice is vertical (sidecar/runtime + Rust command + UI shell + test) before parallelization.

1. **Shortcut parity slice (vertical slice)** ✓ _Done — see `docs/shortcut-audit-2026-05.md`_

2. **Study sidecar full action set (`study_engine`) (vertical slice)** ✓ _Done_
   - Four actions implemented: `study_ask`, `grade_math_answer`, `solve_math`, `generate_problems`.
   - Tauri commands `solve_math` and `generate_problems` added and registered in `lib.rs`.
   - TypeScript bindings added to `src/lib/tauri/commands.ts`.
   - 17 Python tests across 3 test files (`test_study_engine.py`, `test_solve_math.py`, `test_generate_problems.py`).

3. **FE sidecar template extraction (`fe_engine`) (vertical slice)**
   - Same launch/IPC/error model, with one initial FE workflow command and UI shell.

4. **Python sidecar test surface slice**
   - Add `sidecars/*/tests` coverage for NDJSON protocol handling, action dispatch, and error payload contracts.

5. **Governance hardening slice**
   - Add `.github/copilot-instructions.md` and `.github/prompts/` templates; decide/implement branch protection for `main`; update README governance/AI-constraint statements.

## Baseline command checks run for this assessment (read-only)

- `npm install` → success (engine warning + one moderate audit advisory)
- `npm run build` → success
- `npm test` → success (5 files, 42 tests with 3 skipped)
- `npm run lint` → fails due existing Biome diagnostics (pre-existing, not changed here)
- `cargo test` in `src-tauri` → fails in this environment due missing system libs (`glib-2.0`, `gio-2.0`, `gobject-2.0`)

CI signal sampled via GitHub Actions:
- Recent `CI` run on `main` failed on `Lint & Typecheck` (run `25537111485`, failed job logs).
