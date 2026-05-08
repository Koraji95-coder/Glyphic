# Skill: Extract a direct LLM call into a sidecar

Use this template when migrating Rust code that calls Ollama (or another LLM provider) directly to the sidecar pattern. This is a **refactor PR** — no new features, no public-API changes.

## Inputs to fill in before invoking

- `<source_file>`: the Rust file containing direct LLM calls (e.g., `src-tauri/src/commands/study.rs`)
- `<target_engine>`: name of the new or existing sidecar that will host the actions
- `<actions>`: list of LLM-calling functions in the source file that map to sidecar actions

## Goal

Move all LLM-calling logic from `<source_file>` into `sidecars/<target_engine>/main.py`. Refactor the Rust commands in `<source_file>` to spawn-and-stream the sidecar instead. Public Tauri command surface MUST remain identical — no changes to command names, parameters, or output types.

## Deliverable

### 1. Sidecar — `sidecars/<target_engine>/main.py`

If the engine doesn't exist, create it following `sidecars/vault_engine/main.py:1-515` as the template. Include:
- `main.py` with NDJSON dispatch loop
- `Requirements.txt` with all versions pinned
- `tests/` directory (covered in step 2)

If the engine exists, add the migrated actions to its dispatch table.

For each action in `<actions>`:
- Read NDJSON input matching the public command's parameters
- Stream NDJSON events as the operation progresses
- Emit error events + exit 1 on failure

The LLM prompts MUST be lifted **verbatim** from the Rust source. Do NOT rewrite prompts during extraction — that changes meaning of outputs and breaks downstream comparisons. Prompt rewrites are a separate slice.

### 2. Sidecar tests — `sidecars/<target_engine>/tests/`

For each migrated action, add `test_<action>.py` covering:
- Happy path with mocked LLM response → expected event sequence
- Malformed input → error event + exit 1
- LLM unavailable → error event + exit 1

Add `conftest.py` with shared fixtures (`mocked_ollama`, `tmp_workdir`) if not already present.

### 3. Rust refactor — `<source_file>`

Replace direct Ollama HTTP calls with sidecar spawn-and-stream. Reference: `src-tauri/src/commands/vault_study.rs:60-128` (full pattern) and `src-tauri/src/commands/diagram_commands.rs:53-104` (simpler variant).

The public Tauri command surface MUST remain identical:
- Same command names
- Same input parameters
- Same output types
- Same emitted Tauri events (if any)

Add path/python helpers if missing:
- `<target_engine>_path()` — locates the sidecar `main.py` (mirror `vault_engine_path()` at `vault_study.rs:10-48`)
- `<target_engine>_python_cmd()` — picks the Python interpreter (mirror `vault_python_cmd()`)

### 4. Rust unit tests

Existing `#[cfg(test)]` tests in `<source_file>` MUST still pass after refactor. If they tested the old direct-call shape, update them to mock the sidecar binary and assert the same final behavior.

Reference style: `src-tauri/src/commands/study.rs:193`.

### 5. Bundling — `src-tauri/tauri.conf.json`

The existing `../sidecars/**/*` resource glob (at `tauri.conf.json:13-15`) picks up new directories automatically. Verify by inspection.

If a new engine was created, also add it to `sidecars/install_deps.sh` (around line 17-31).

### 6. State assessment update

Update `docs/state-assessment-2026-05.md`:
- Section 2 — note the engine now follows the standard sidecar pattern alongside `vault_engine` and `diagram_engine`
- Section 5.2 — update Python test count
- Section 8 — strike this slice from the recommended order if listed there

## Out of scope

- Any change to public command surface (names, parameters, outputs)
- Changes to LLM prompts (verbatim lift only)
- Frontend changes (the public API is unchanged, so nothing should break)
- Other LLM-calling Rust code outside `<source_file>`
- Performance optimizations during the refactor

## Verification

- `cd sidecars/<target_engine> && pytest -v` passes
- `cargo test -p src-tauri` passes including existing tests for `<source_file>`
- `npm test` still passes (no frontend changes expected)
- Manual: exercise every Tauri command from `<source_file>` via the existing UI; behavior MUST be indistinguishable from pre-refactor

## PR shape

- Title: `refactor(<domain>): extract Ollama calls into <target_engine> sidecar`
- Body: list of actions migrated, statement that public surface is unchanged, what tests cover
- Don't push automatically
