# Agents

This file is the entry point for any AI agent (Copilot Coding Agent, Claude CLI, Cursor, Aider, etc.) working on Glyphic. Read it before doing anything.

## Pre-flight checklist

Before changing any code, read in order:

1. `.github/copilot-instructions.md` — the rules (non-negotiable)
2. This file — task patterns and dispatch
3. `docs/state-assessment-2026-05.md` — current repo state and known gaps
4. The relevant prompt template under `.github/prompts/`

## Architecture summary

```
glyphic/
├─ src/                                 # React 19 + TS frontend
│  ├─ components/<area>/                # UI components, one folder per area
│  │  └─ __tests__/                     # Vitest tests colocated with components
│  ├─ lib/tauri/commands.ts             # ONLY place to call Tauri invoke
│  ├─ stores/                           # Zustand state stores
│  └─ __tests__/                        # Top-level tests (e.g., phaseD.test.ts)
├─ src-tauri/                           # Rust backend
│  └─ src/
│     ├─ commands/<domain>.rs           # Tauri commands per domain (study, math, fe, …)
│     ├─ db/                            # SQLite schemas + access modules
│     ├─ ai/ollama.rs                   # Ollama HTTP client (do NOT add new direct calls)
│     └─ main.rs                        # Command registration
├─ sidecars/                            # Python LLM sidecars
│  ├─ vault_engine/                     # Reference: NDJSON pattern + ingestion
│  ├─ diagram_engine/                   # Reference: NDJSON pattern + render
│  ├─ install_deps.sh                   # venv + pinned-deps setup
│  └─ <new_engine>/                     # Future engines follow same pattern
└─ docs/                                # Architecture + state docs
```

## Vertical slice pattern

When you add a feature, the complete PR has four layers:

1. **Sidecar action** (Python) — implements the LLM/processing logic, ships with at least one pytest covering happy path + at least one failure path
2. **Rust command** (Tauri) — spawns the sidecar, parses NDJSON, returns typed result, registered in `main.rs`, ships with at least one unit test
3. **React UI shell** (React + TypeScript) — invokes the command via `src/lib/tauri/commands.ts`, renders results, ships with at least one Vitest test
4. **Documentation** — README feature list update, state assessment update, any prompt template changes

A PR that lands only one or two layers MUST state explicitly why (e.g., "this is the architectural extraction; UI follows in #N"). Never claim completeness for partial work.

## Common tasks

| Intent | Prompt template |
|---|---|
| Add a new action to an existing sidecar | `.github/prompts/add-sidecar-action.prompt.md` |
| Migrate a direct Rust→LLM call to a sidecar | `.github/prompts/extract-llm-to-sidecar.prompt.md` |
| Build a new feature top-to-bottom | `.github/prompts/add-vertical-slice.prompt.md` |
| Backfill sidecar pytest coverage | `.github/prompts/backfill-sidecar-tests.prompt.md` |
| Fix a failing CI job | Inspect `.github/workflows/ci.yml` and the failing step output; reproduce locally before changing code |

## Dispatch by intent

- **"add a feature"** → vertical slice template
- **"add an action to <engine>"** → add-sidecar-action template
- **"refactor existing code"** → if it's a direct-LLM-call extraction use the extract template; otherwise open a draft PR with `needs-discussion`
- **"fix a bug"** → reproduce first, write a failing test, then fix
- **"improve coverage"** → backfill template
- **"update docs"** → no template needed; just keep documentation honest

## What you cannot do

- Enable branch protection (admin-only setting)
- Change CI provider or fundamentally restructure `.github/workflows/`
- Add a new cloud LLM provider without an explicit roadmap issue
- Push directly to `main`
- Bypass the `src/lib/tauri/commands.ts` wrapper layer

## Honesty requirements

- If a feature is partially implemented, describe what's missing in the PR description.
- If a test is skipped, document why with a TODO and a tracking issue link.
- If you can't run the test suite locally, say so in the PR description.
- Never claim completeness for work that's actually a partial slice.
- Never invent file paths, line numbers, or API shapes — verify against the current repo.

## When in doubt

Open a draft PR with the work-in-progress and tag it `needs-discussion`. Don't guess on architecture.
