---
name: add-sidecar-action
description: Use when adding a new action to an existing Glyphic Python sidecar (vault_engine, diagram_engine, study_engine, fe_engine, etc.). Triggers include extending sidecar capabilities, adding LLM-powered features that fit into an existing engine, or implementing a Tauri command that wraps a new sidecar action. This is a two-layer slice (sidecar + Rust command); does NOT cover frontend wiring.
---

# Add a new action to an existing Glyphic sidecar

Use this skill when extending `study_engine`, `vault_engine`, `diagram_engine`, or any other existing sidecar with a new action. This is a two-layer slice (sidecar + Rust command). Frontend wiring is a separate piece of work.

## Information to gather from the user

Before writing code, confirm:

- **engine** — which sidecar (e.g., `study_engine`, `vault_engine`, `diagram_engine`)
- **action** — snake_case action name (e.g., `summarize_chunks`)
- **inputs** — JSON shape the action accepts
- **events** — NDJSON event types the action will emit
- **command** — Tauri command name (typically matches the action name)
- **domain** — which Rust file under `src-tauri/src/commands/<domain>.rs` will host the command

If any of these aren't clear from context, ask the user before starting.

## What you build

### 1. Sidecar action — `sidecars/<engine>/main.py`

Add the new action to the dispatch table. Document the contract in the action's docstring:

```
Input:  {"action":"<action>", <input_fields>}
Events: <event_types>
Final:  {"event":"final", ...}
Error:  {"event":"error","message":"..."} then exit 1
```

Implementation requirements:
- Read NDJSON from stdin, dispatch on the `action` field
- Stream events to stdout, one event per line, with `flush=True` after each
- On any exception, emit an error event and exit with code 1
- Reuse the LLM prompt patterns already established in this engine; if a new prompt is needed, document the choice in the action's docstring

Reference: `sidecars/vault_engine/main.py:90-94` for the writer pattern.

### 2. Pytest — `sidecars/<engine>/tests/test_<action>.py`

Cover at minimum:
- Happy path with mocked LLM response → expected event sequence
- Malformed input (missing field or wrong type) → error event + exit 1
- LLM unavailable (mocked HTTP failure) → error event + exit 1

Use `unittest.mock.patch` to stub Ollama HTTP calls. No real network in tests.

If `sidecars/<engine>/tests/conftest.py` doesn't exist yet, create it with shared fixtures (`mocked_ollama`, `tmp_workdir`).

### 3. Rust command — `src-tauri/src/commands/<domain>.rs`

Add the new command following the spawn-and-stream pattern from `src-tauri/src/commands/vault_study.rs:60-128`. Register the command in `main.rs`.

Public signature:

```rust
#[tauri::command]
pub async fn <command>(<args>, app: AppHandle) -> Result<<Output>, String>
```

Use `Result<T, String>` with stable, human-readable error messages. Never panic in command handlers.

### 4. Rust unit tests

Add to the `#[cfg(test)] mod tests` module in `src-tauri/src/commands/<domain>.rs`. Reference style: `src-tauri/src/commands/study.rs:193`.

Cover:
- Happy path with a mocked sidecar binary
- Sidecar non-zero exit handled correctly (returns `Err`)

### 5. State assessment update

If `docs/state-assessment-2026-05.md` references the engine's action surface, update it. At minimum, increment the Python test count in section 5.2 if this is the first pytest for the engine.

## What you don't build

- Frontend UI wiring — that's a separate slice (use `add-vertical-slice` skill if bundling)
- Cross-engine action sharing
- New dependencies in the engine's `Requirements.txt` unless absolutely required (justify in PR description; pin all new versions)
- Refactoring of existing actions in the same engine

## Verification before opening the PR

- `cd sidecars/<engine> && pytest -v` passes
- `cargo test -p src-tauri` passes including new tests
- Manually invoke the new Tauri command (debug console or temporary frontend test page) and confirm the event stream

## PR shape

- Title: `feat(<engine>): add <action> action`
- Body covers: input/output contract, what tests cover, anything intentionally deferred
- Don't push automatically — open as draft if exploratory, ready-for-review otherwise
