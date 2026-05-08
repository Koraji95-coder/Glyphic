# Skill: Add a new action to an existing sidecar

Use this template when extending `study_engine`, `vault_engine`, `diagram_engine`, or any other existing sidecar with a new action. This is a **two-layer slice** (sidecar + Rust command). Frontend wiring is a separate PR unless explicitly bundled.

## Inputs to fill in before invoking

- `<engine>`: sidecar name (e.g., `study_engine`)
- `<action>`: snake_case action name (e.g., `summarize_chunks`)
- `<inputs>`: JSON shape the action accepts
- `<events>`: NDJSON event types the action emits
- `<command>`: Tauri command name (typically matches `<action>`)
- `<domain>`: Rust file under `src-tauri/src/commands/<domain>.rs`

## Goal

Add a new `<action>` to `sidecars/<engine>/main.py`, expose it as a Tauri command in `src-tauri/src/commands/<domain>.rs`, and add tests at both layers.

## Deliverable

### 1. Sidecar — `sidecars/<engine>/main.py`

Add the new action to the dispatch table. Document the contract:

```
Input:  {"action":"<action>", <inputs>}
Events: <events>
Final:  {"event":"final", ...}
Error:  {"event":"error","message":"..."} then exit 1
```

Implementation MUST:
- Read NDJSON from stdin, dispatch on `action`
- Stream events to stdout (one event per line, `flush=True` after each)
- On exception, emit error event and exit 1
- Reuse the LLM prompt patterns already in this engine; if a new prompt is needed, document the choice in the action's docstring

Reference: `sidecars/vault_engine/main.py:90-94` for the writer pattern.

### 2. Pytest — `sidecars/<engine>/tests/test_<action>.py`

Cover at minimum:
- Happy path with mocked LLM response → expected event sequence
- Malformed input (missing field, wrong type) → error event + exit 1
- LLM unavailable (mocked HTTP failure) → error event + exit 1

Use `unittest.mock.patch` to stub Ollama HTTP calls. No real network in tests.

If `sidecars/<engine>/tests/conftest.py` doesn't exist yet, create it with shared fixtures (`mocked_ollama`, `tmp_workdir`).

### 3. Rust command — `src-tauri/src/commands/<domain>.rs`

Add `<command>` following the spawn-and-stream pattern from `src-tauri/src/commands/vault_study.rs:60-128`. Register in `main.rs`.

Public signature:
```rust
#[tauri::command]
pub async fn <command>(<args>, app: AppHandle) -> Result<<Output>, String>
```

Use `Result<T, String>` with stable, human-readable error messages. Never panic.

### 4. Rust unit tests

Add to the `#[cfg(test)] mod tests` module in `src-tauri/src/commands/<domain>.rs`. Reference style: `src-tauri/src/commands/study.rs:193`.

Cover:
- Happy path with mocked sidecar binary
- Sidecar non-zero exit handled correctly (returns `Err`)

### 5. State assessment update

If `docs/state-assessment-2026-05.md` references the engine's action surface, update it. At minimum, increment the Python test count in section 5.2 if this is the first pytest for the engine.

## Out of scope

- Frontend UI wiring (separate PR — use `add-vertical-slice.prompt.md` if you want to bundle)
- Cross-engine action sharing (each engine owns its actions)
- New dependencies in the engine's `Requirements.txt` unless absolutely required (justify in PR description if added; pin all new versions)
- Refactoring existing actions in the same engine

## Verification

- `cd sidecars/<engine> && pytest -v` passes
- `cargo test -p src-tauri` passes including new tests
- Manual: invoke the new Tauri command from a debug console (Tauri inspector or temporary frontend test page) and confirm the event stream

## PR shape

- Title: `feat(<engine>): add <action> action`
- Body: input/output contract, what tests cover, anything intentionally deferred
- Don't push automatically
