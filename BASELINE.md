# Glyphic Baseline

**Last verified: 2026-05-08** (post Phase D shortcuts + fe_engine vertical slice)

This document records the verified baseline state of the repository. It serves as a regression-prevention checkpoint and reflects the actual build/lint status as of the date above.

**Previous baseline:** 2026-04-20 on commit `e8189e4` (Phase 0.1 start).

## Environment

This baseline is tested on:

- **OS:** Windows 11 (dev machine), Ubuntu 24.04 (CI)
- **Node:** v24.14.1+
- **npm:** 11.11.0+
- **rustc:** 1.94.1+ (2026-03-25+)
- **cargo:** 1.94.1+ (2026-03-24+)

### System libraries (Linux only)

Tauri v2 Rust backend requires GTK/WebKit libraries on Linux:

```bash
sudo apt-get install -y \
  libglib2.0-dev libgtk-3-dev libsoup-3.0-dev \
  libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev
```

### What's new (May 2026)

Since April 20 baseline:

- ✅ Phase D UI redesign (pinned notes, focus mode, quickswitcher polish)
- ✅ Keyboard shortcut parity audit and restoration (Ctrl+K, Ctrl+Shift+K, Ctrl+Shift+E)
- ✅ fe_engine vertical slice (Python sidecar, Tauri commands, FE Prep UI shell)
- ✅ Study engine expanded (study_ask, grade_math_answer, solve_math, generate_problems)
- ✅ 7 new seed question JSON files added (op-amps, probability, 3-phase, transient, transmission, z-transforms)
- ✅ LinkModal + BacklinkModal wired to editor shortcuts
- ⚠️ PDF export declared but NOT implemented (see CRITICAL issues in audit)

## Build & check results

All commands run from the repo root unless otherwise noted.

**Current status (May 8, 2026):**

- ✅ `npm run lint` — **PASSES** (0 errors, 0 warnings after Phase D fixes)
- ✅ `npm run build` — **PASSES** (TypeScript clean, Vite transforms 2,259+ modules)
- ✅ `npm test` — **PASSES** (42 tests, 3 skipped due to known markdown roundtrip bugs)
- ⚠️ `cargo test` — **Blocked** (system lib missing in this environment; known to work locally)
- 🔴 **24 CRITICAL/HIGH audit issues identified** (see Audit Summary section below)





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

| Signal                              | Baseline (May 2026)                                              |
| ----------------------------------- | ---------------------------------------------------------------- |
| `npm install`                       | 0 vulnerabilities                                                |
| `cargo check` (first-party)         | 0 errors, 0 warnings                                             |
| `cargo check` (transitive)          | 1 future-incompat warn (xcap 0.0.14)                             |
| `npm run build`                     | success, main ~174 kB / total 1.23 MB across split chunks        |
| `npm run lint` errors               | 0                                                                |
| `npm run lint` warnings             | 0                                                                |
| `npm test`                          | 42 passed, 3 skipped (markdown roundtrip bugs)                   |
| Manual `tauri dev` smoke test       | pending on dev machine                                           |

Subsequent phases must keep `cargo check`, `npm run build`, `npm run lint`, and `npm test` green.

---

## 🔴 AUDIT SUMMARY — CRITICAL ISSUES IDENTIFIED (May 8, 2026)

A deep code audit revealed **24 critical/high-severity issues** blocking production readiness:

### Critical (12 Rust backend + 8 TS/React + 4 database/sidecar)

- **PDF export is a stub:** `src-tauri/src/export/pdf.rs` contains only a TODO comment
- **18+ `.lock().unwrap()` panics:** Mutex poisoning risks in `ai_commands.rs`, `diagram_commands.rs`, `study.rs`
- **5+ silent `.catch(() => {})` handlers:** Errors swallowed in `useGlobalShortcuts.ts`, `AiSettingsPanel.tsx`, `CaptureOverlay.tsx`
- **Database migrations not transactional:** ALTER TABLE statements in `fe_commands.rs` can leave schema partial on crash
- **4 runtime creations instead of reusing Tauri async:** `diagram_commands.rs` lines 336, 356, 414, 429

### High Severity (3 Rust + 2 TS + 4 Python/tests)

- **3 skipped roundtrip tests:** Mark nesting, blockquote parsing, image alt-text edge cases broken
- **Bare except clauses in Python sidecars:** `diagram_engine/main.py` silent failures
- **Type coercion gaps:** `AnnotationOverlay.tsx` uses `as any` with Fabric.js event types
- **Promise rejections unhandled:** `chatStore.ts` error handling loses final state

See `docs/audit-findings-2026-05.md` for complete issue list, file paths, and line numbers.

---

## UI ASSESSMENT (May 8, 2026)

### What's working well ✅

- **Overall visual polish:** Consistent use of CSS variables (--bg-app, --text-primary, --accent) gives a cohesive dark theme
- **Responsive grid layout:** Sidebar + editor + chat layout adapts well to window resizing
- **Accessibility foundations:** Proper ARIA labels, button types, semantic HTML structure
- **Component isolation:** Modals (LinkModal, BacklinkModal, QuestionBankPanel) are well-contained with clear responsibilities
- **Edit modals:** Question editor, add question, flag question modals follow a consistent UI pattern

### Issues & gaps ⚠️

1. **Link/Backlink modals UX collision:** Modals for inserting links (Ctrl+K) and backlinks (Ctrl+Shift+K) both overlay, can be visually confusing
   - Suggestion: Differentiate styling or combine into a unified dialog

2. **Question bank panel UI incomplete:** QuestionBankPanel has all structure but:
   - Import JSON button unhandled (no click handler)
   - Add Question form has no success feedback
   - No empty state illustration for "no questions in topic"

3. **FE Prep Mode lacks visual hierarchy:** When opened, shows only `onExit` button in a sea of empty space
   - Suggestion: Add header with vault name, stats, breadcrumb "FE Prep Mode / [Topic]"

4. **Inconsistent error UX:** Some errors show toasts, others show inline messages, some are silent
   - Create unified error notification component

5. **Type safety in modal callbacks:** Editor action store uses `| null` callbacks which can silently fail
   - Better: type as `() => never` to catch typos at compile-time

6. **Color contrast:** Dark theme on dark backgrounds (--bg-card on --bg-app) could fail WCAG AA in some areas
   - Check: Run axe DevTools or similar contrast checker

### Performance concerns 🟡

- **Frontmatter registry unbounded:** `src/lib/frontmatterRegistry.ts` is an in-memory Map with no eviction policy
  - If 10k notes are loaded, all frontmatter stays in RAM forever
- **Single DB connection:** `src-tauri/src/lib.rs` uses one SQLite connection, serializing all writes
  - At scale (1000+ notes), will see blocking on concurrent save attempts
- **No pagination in question bank:** QuestionBankPanel loads all questions for a topic into memory
  - If a topic has 5000 questions, the UI will stall

---

## Recommended next steps

**Before user testing:**

1. ✅ Run `npm run lint` and `npm run build` to verify clean state ← DONE
2. 🔴 **CRITICAL:** Implement PDF export stub OR remove from UI
3. 🔴 **CRITICAL:** Replace `.lock().unwrap()` with proper error handling
4. ⚠️ **HIGH:** Remove silent `.catch(() => {})` handlers; log or bubble errors
5. ⚠️ **HIGH:** Wrap FE migrations in `BEGIN TRANSACTION`
6. 🟡 **MEDIUM:** Unskip the 3 markdown roundtrip tests or mark as known-broken
7. 🟡 **MEDIUM:** Add bounds checking to question bank pagination
8. 🟡 **MEDIUM:** Differentiate link/backlink modal UX

**For production hardening:**

- Add `.github/copilot-instructions.md` and `.github/prompts/` templates
- Consider branch protection rules on `main`
- Add structured logging (tracing crate) instead of manual eprintln!()
- Implement connection pooling for SQLite
- Add integration tests for sidecar IPC layer
