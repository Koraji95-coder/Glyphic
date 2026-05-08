---
name: add-vertical-slice
description: Use when building a new Glyphic feature that spans the full stack — Python sidecar action, Rust Tauri command, React UI shell, and tests at every layer. Triggers include any feature work that involves new LLM-powered functionality with user-facing UI. This is the four-layer pattern; do NOT use this skill for sidecar-only work or pure refactors.
---

# Add a new Glyphic feature as a vertical slice

Use this skill when building a feature that spans sidecar action + Rust command + UI + tests. Most work-package items in the Glyphic completion plan decompose into 1–3 vertical slices each.

## Information to gather from the user

- **feature_name** — human name (e.g., "Math problem grading")
- **engine** — sidecar (existing or new) hosting the action
- **action** — action name in the sidecar
- **command** — Tauri command name (typically matches the action)
- **domain** — Rust file under `src-tauri/src/commands/<domain>.rs`
- **area** — React area folder under `src/components/<area>/`
- **component** — React component name (PascalCase, e.g., `MathGrader`)
- **input_shape** — command input parameters
- **output_shape** — command output structure

## What you build (all four layers, single PR)

### Layer 1 — Sidecar action

If the engine exists: add the action to the dispatch table.
If the engine is new: create the directory, `main.py`, `Requirements.txt` (all pinned), `tests/` directory, and add the engine to `sidecars/install_deps.sh`. Use `sidecars/vault_engine/main.py:1-515` as the structural template.

Action requirements:
- Reads NDJSON from stdin, dispatches on `action`
- Streams NDJSON events to stdout, `flush=True` after each
- Emits `{"event":"error","message":"..."}` and exits 1 on failure
- Ships with at least one pytest covering happy path + malformed input + LLM-unavailable

### Layer 2 — Rust command

Tauri command at `src-tauri/src/commands/<domain>.rs`:

```rust
#[tauri::command]
pub async fn <command>(<input_shape>, app: AppHandle) -> Result<<Output>, String>
```

Spawn pattern: follow `src-tauri/src/commands/vault_study.rs:60-128`. Parse NDJSON line-by-line via `BufReader::lines()`. Emit Tauri events for streaming progress where applicable. Register in `main.rs`.

Unit tests in `#[cfg(test)] mod tests` covering:
- Happy path with mocked sidecar
- Sidecar failure path returns `Err`

Reference test style: `src-tauri/src/commands/study.rs:193`.

### Layer 3 — React UI shell

Component at `src/components/<area>/<component>.tsx`:
- Imports the command wrapper from `src/lib/tauri/commands.ts` (add a wrapper there if one doesn't exist; do NOT call `invoke` directly from the component)
- Renders results in the appropriate style (KaTeX for math, syntax highlighting for code, etc.)
- Handles loading and error states explicitly (don't hide errors)

Vitest test at `src/components/<area>/__tests__/<component>.test.tsx` covering:
- Initial render
- Happy-path invocation (mock the Tauri command, assert the rendered output)
- Error state rendering

Wire the component into the navigation/main view as appropriate. Keep the entry point minimal — a single navigation item or panel toggle.

### Layer 4 — Documentation

- README feature list updated (mark as alpha if appropriate)
- `docs/state-assessment-2026-05.md` section 1 updated with the new feature's status
- If the feature introduces a new convention, document it in `docs/`
- If the engine is new, mention it in the state assessment alongside the existing reference engines

## What you don't build (typical exclusions for one slice)

- Multi-feature integration (e.g., this slice ships solving; grading is a separate slice)
- Persistence of operation history beyond what the feature needs to function
- Cross-platform UI polish beyond what's needed for the primary platform
- Performance tuning
- Advanced error recovery (basic loading + error states are enough for the slice; sophisticated retry UX is a follow-up)

## Verification before opening the PR

- `cd sidecars/<engine> && pytest -v` passes
- `cargo test -p src-tauri` passes
- `npm test` passes
- `npm run lint` passes (don't introduce new lint errors)
- Manual: end-to-end UX walkthrough produces the expected result

## PR shape

- Title: `feat(<area>): <feature_name> end-to-end`
- Body sections:
  - **Scope** — what this slice ships
  - **Deferred** — what's intentionally left for follow-up slices
  - **Verification** — manual test steps the reviewer can run
  - **Screenshots** — if UI changes are visible (small clips/gifs preferred over walls of text)
- Don't push automatically
