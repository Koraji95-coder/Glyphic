---
name: backfill-sidecar-tests
description: Use when adding pytest coverage to an existing Glyphic Python sidecar that has zero or incomplete tests. Triggers include vault_engine, diagram_engine, or any sidecar with empty tests/ directory. This is test addition only — NO source changes to main.py; bugs found get filed as separate issues.
---

# Backfill pytest coverage for a Glyphic sidecar

Use this skill when an existing sidecar has no (or incomplete) pytest coverage. Per `docs/state-assessment-2026-05.md` section 5.2, both `vault_engine` and `diagram_engine` currently have zero pytest coverage. Future sidecars must ship with tests from day one — this skill is for retrofitting.

## Information to gather from the user

- **engine** — sidecar name (e.g., `vault_engine`)

That's it. The skill itself works out the rest from the engine's `main.py`.

## What you build

### 1. Test directory structure

```
sidecars/<engine>/tests/
  __init__.py
  conftest.py             # shared fixtures (mocked Ollama, temp directories)
  test_<action_1>.py
  test_<action_2>.py
  ...
```

### 2. Per-action coverage

For each action the sidecar dispatches, at least three test cases:

- **Happy path** — valid input, mocked LLM response, asserts expected event sequence on stdout
- **Malformed input** — missing required field or wrong type, asserts error event + exit 1
- **LLM unavailable** — mocked HTTP failure, asserts error event + exit 1

Encouraged but not required:
- Edge case specific to the action (empty input, very long input, special characters, unicode)

### 3. Conftest fixtures

Minimum fixtures in `conftest.py`:

```python
import pytest
from unittest.mock import patch

@pytest.fixture
def mocked_ollama():
    """Patch Ollama HTTP client; tests configure responses per case."""
    with patch("<engine>.main.requests") as mock:  # adjust import path to match actual usage
        yield mock

@pytest.fixture
def tmp_workdir(tmp_path):
    """Provide a tmp directory for any file operations the engine performs."""
    return tmp_path
```

Adjust the patch target to whatever HTTP client the engine actually uses (`requests`, `httpx`, etc.).

### 4. CI integration

If `.github/workflows/ci.yml` doesn't already run sidecar pytest, add a job (or extend an existing one) that:
- Sets up Python (matching the version the sidecars assume)
- Installs the engine's pinned dependencies via `pip install -r sidecars/<engine>/Requirements.txt`
- Runs `pytest sidecars/<engine>/tests/`

If multiple engines need this, parameterize via a matrix:

```yaml
strategy:
  matrix:
    engine: [vault_engine, diagram_engine, study_engine]
```

### 5. State assessment update

In `docs/state-assessment-2026-05.md` section 5.2, update the count for `<engine>` and link to the new test directory.

## What you don't build

- Source changes to `main.py` — file separate fix-PRs for any real bugs found
- Refactoring the engine's structure
- New actions
- Performance benchmarks (those go in their own slice)
- Higher-level mocking (e.g., a fake HTTP server) — patch the HTTP client directly for unit-test speed

## Bug-handling rule

If you discover a real bug while writing tests:
1. Capture the failure case in a test marked `@pytest.mark.xfail(reason="bug #N - <link>")`
2. Open a separate issue describing the bug
3. Continue the backfill PR; do NOT fix the bug in the same PR

This keeps the backfill PR focused and reviewable.

## Verification before opening the PR

- `cd sidecars/<engine> && python -m venv .venv && .venv/bin/pip install -r Requirements.txt -r tests/requirements-test.txt && .venv/bin/pytest -v` passes (or fails on documented xfails only)
- CI run picks up the new tests and they pass

## PR shape

- Title: `test(<engine>): backfill pytest coverage`
- Body covers: list of actions covered, coverage approach, any bugs found (with separate-PR/issue links)
- Don't push automatically
