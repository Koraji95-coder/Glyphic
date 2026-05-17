# Glyphic Product/UI Audit

## What Works

- Glyphic already has a useful local-first desktop shape: React/Vite UI, Tauri commands, Rust state, SQLite-backed study data, and Python sidecars.
- The app has real study surfaces rather than only a chat demo: FE Prep, a question bank, mastery tracking, flashcard review, notes, vault search, diagrams, and capture.
- FE Prep has a practical foundation with session modes, topic stats, weak-topic detection, timed exam flow, and a question bank parser with tests.
- The editor/vault model gives study work a place to live, and Zustand stores keep most UI state easy to reason about.
- The command wrapper in `src/lib/tauri/commands.ts` gives the frontend a single integration point for Tauri commands.
- The existing visual identity has a clear dark desktop-app direction and enough shared variables to support a cleaner token pass later.

## What Does Not Work

- The dashboard was mostly an empty-note fallback, not a primary study planning surface.
- Study actions were scattered across the title bar, sidebar, FE Prep mode, mastery mode, and editor instead of being gathered into a clear "what should I do next?" view.
- The old dashboard showed a `Documents ingested` metric that was hardcoded to zero and did not represent a real product signal.
- Visual language is inconsistent: some surfaces use semantic variables, while others use hardcoded zinc/violet/cyan utility classes, gradients, large radii, and inline colors.
- Glyphic duplicates shell, topbar, sidebar, theme, and navigation concepts locally instead of consuming Chamber 19 shared primitives.
- Several FE Prep controls lacked stable `id` and `name` attributes, which weakens accessibility and form tooling.
- The README and architecture docs are behind the app: they do not fully describe the current FE Prep, mastery, flashcard, and provider state.
- Existing OpenAI surfaces and CSP allowances create a product-policy risk for a local-first study app. This audit does not remove them, but future work should clarify provider policy.

## User Experience Gaps

- Creating a study plan is not yet a first-class workflow. The app has practice and review pieces, but no calendar, planned session, or daily target model.
- Progress tracking exists in FE statistics and mastery components, but the user has to discover it across modes.
- Quiz and review workflows exist, but the path from weak topic to practice session to flashcard review is still loose.
- FE Electrical preparation needs a fuller topic map, formula/reference mode, practice exam mode, and clearer review sequencing.
- AI-assisted study should be framed as provider-neutral and local-first, with clear mock/local fallbacks before any real provider adapters are added.
- Study sessions need stronger organization around today's focus, recent notes, weak topics, and next action.

## Chamber 19 Integration Gaps

- Glyphic does not currently consume `@chamber-19/desktop-toolkit` or the Rust `desktop-toolkit` crate.
- Glyphic does not use Chamber 19 `--ch-*` theme tokens. It has local variables such as `--bg-app`, `--bg-card`, `--text-primary`, and `--accent`.
- Glyphic duplicates app shell/sidebar/topbar logic in local components. This is acceptable temporarily because no exported desktop-toolkit AppShell/sidebar/topbar primitive was found.
- `desktop-toolkit` theme utilities, window readiness, updater, activation, and release-note pieces should be evaluated in a separate toolkit integration PR.
- Launcher registration is not ready for this PR. Launcher currently routes backend-service apps through hardcoded app metadata and `backends.json`; Glyphic is a standalone Tauri app.
- The shared `.github` UI/CSS/TypeScript/Tauri guidance should be followed immediately for touched code.

### Shared Dependency Classification

| Dependency | Classification | Rationale |
| --- | --- | --- |
| `.github` UI/CSS/TypeScript/Tauri docs | Use now | Applies directly to touched UI, accessibility, Biome, and Tauri discipline. |
| `desktop-toolkit` theme provider/tokens | Use later | Real package exists, but adoption should be a dedicated dependency/pin PR. |
| `desktop-toolkit` window readiness/updater/release notes | Use later | Useful shared infrastructure, but outside this dashboard PR. |
| `desktop-toolkit` AppShell/sidebar/topbar | Not ready | Shell concepts exist, but no exported React primitive was found. |
| `desktop-toolkit` AI broker/chat primitives | Needs research | Could conflict with Glyphic's local Ollama sidecars and provider policy. |
| Launcher app registration | Needs research | Current launcher model targets backend services, not full standalone Tauri apps. |
| `deepdive` reference material | Do not use directly | Useful design inspiration only; code should not be copied. |

## Implementation Plan In Stages

### Stage 1 - Quick Polish/Fixes

- Make the dashboard a practical study home with real note, folder, FE attempt, accuracy, and weak-topic signals.
- Add quick actions for new note, new folder, FE Prep, and Mastery using existing stores/events.
- Remove fake metrics and improve basic accessibility in touched FE Prep controls.
- Add focused dashboard coverage.

### Stage 2 - Chamber 19 Toolkit/Launcher Alignment

- Evaluate a dedicated desktop-toolkit dependency PR for theme provider, window readiness, updater, and release notes.
- Map Glyphic tokens toward Chamber 19 `--ch-*` semantics after the dependency strategy is settled.
- Decide whether Launcher should open Glyphic as a standalone desktop app or only route to Glyphic-backed services.

### Stage 3 - Study Workflow Improvements

- Add an explicit study-plan model with daily targets, scheduled sessions, and session history.
- Connect notes, FE topics, and weak-topic recommendations into a single planning loop.
- Add better empty states for first-run study setup.

### Stage 4 - Quiz/Review System Improvements

- Expand FE Electrical topic coverage and question-bank metadata.
- Add adaptive quiz selection based on weak topics and recent misses.
- Connect flashcard review to FE topics and note references.

### Stage 5 - Provider-Neutral AI-Assisted Study Features

- Introduce an AI Study Layer with a provider adapter interface and a mock/local adapter first.
- Keep real provider adapters out until local-first policy and safe abstractions are explicit.
- Clarify or remove existing cloud-provider UI surfaces if they conflict with Chamber 19 rules.

### Stage 6 - Long-Term Product Upgrades

- Add a full FE Electrical topic map, study calendar, spaced repetition, practice exam mode, progress analytics, and formula/reference sheet mode.
- Add note summary workflows that are local-first and provider-neutral.
- Align shell and theme consumption with desktop-toolkit when the shared primitives are mature.

## Future Upgrades

- FE Electrical topic map with categories, formulas, and known weak areas.
- Study calendar with planned sessions, due reviews, and exam countdown.
- Adaptive quizzes that prefer weak topics and stale topics.
- Weak-topic review queue tied to explanations and note links.
- Spaced repetition for flashcards and missed FE concepts.
- AI study coach using a provider-neutral adapter and mock/local default.
- Formula/reference sheet mode for quick FE Electrical review.
- Practice exam mode with pacing, break handling, and post-exam review.
- Progress analytics for accuracy, attempts, time, streaks, and topic confidence.
- Local-first vault study mode with transparent indexing status.
- Launcher registration after the standalone-app vs backend-service model is decided.
- Direct desktop-toolkit theme/shell consumption after shared primitives are available.
