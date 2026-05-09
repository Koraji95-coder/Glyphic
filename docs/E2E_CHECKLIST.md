# Glyphic — End-to-End Smoke Test Checklist

Run this before every release (or after any change that touches the editor,
vault, capture, AI, or DB layers). Each item is independent; if one fails the
others can still be checked.

> **Goal:** prove that a fresh user can open the app, create a vault, take and
> annotate notes, search them, get help from a local LLM, and export — without
> any error dialogs or console errors.

## 0. Prep
- [ ] `npm install` succeeds.
- [ ] `cargo check` (in `src-tauri/`) finishes with 0 first-party warnings.
- [ ] `npm run build` finishes; main chunk < 200 KB pre-gzip.
- [ ] `npm run lint` exits 0 (no errors).
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm test` passes (vitest + Rust `#[cfg(test)]` modules under `cargo test`).

## 1. First-launch onboarding
- [ ] `npm run tauri dev` opens a single window with the onboarding modal.
- [ ] Default vault path defaults to `~/Glyphic`.
- [ ] **Browse…** opens a native folder picker.
- [ ] Clicking **Continue** creates the folder if missing and advances to the
      "Set up local AI" step (or quickstart if Ollama is unreachable).

## 2. Local LLM setup (Ollama)
- [ ] If Ollama is running, the onboarding "AI" step shows a green
      "Ollama detected" indicator with the endpoint and at least one model.
- [ ] If Ollama is *not* running, the step shows the install hint with a
      copy-pasteable command and a link to https://ollama.com/download.
- [ ] **Skip for now** advances to quickstart without erroring.

## 3. Vault on disk
- [ ] After onboarding, `~/Glyphic/.glyphic/index.db` exists.
- [ ] `~/Glyphic/.glyphic/vault.toml` exists and contains `name = "Glyphic"`.
- [ ] `~/Glyphic/Unsorted/notes/` exists and is empty.

## 4. Create / edit / save a note
- [ ] Right-click on **Unsorted** in the sidebar → **New Note** creates
      `~/Glyphic/Unsorted/notes/<title>.md` with YAML frontmatter
      (`title`, `created`, `modified`, `tags: []`, `lecture_timestamps: []`).
- [ ] Typing in the editor autosaves within ~600 ms — confirm by `cat`-ing
      the file from a terminal.
- [ ] Saving the same note twice does NOT change the note's `id` in the DB
      (`select id from notes where path = ?`).

## 5. Math (KaTeX)
- [ ] Inserting `$E = mc^2$` renders inline using KaTeX.
- [ ] Inserting `$$\int_0^\infty e^{-x^2}\,dx$$` renders as a centered block.
- [ ] Toolbar **Σ** button inserts an inline math placeholder.
- [ ] Toolbar **∫** button inserts a math block placeholder.
- [ ] Symbols picker (Ω) inserts the chosen symbol at the cursor.

## 6. Engineering content
- [ ] A ` ```mermaid ` block with `graph TD; A-->B` renders as a diagram.
- [ ] A ` ```python ` code block has syntax highlighting.

## 7. Screenshot capture
- [ ] Press the configured hotkey (default `Cmd/Ctrl+Shift+4`) → a region
      selector appears, dragging captures a region and inserts an image
      reference into the active note.
- [ ] The image file lands under `~/Glyphic/<folder>/attachments/`.
- [ ] Press the fullscreen hotkey (default `Cmd/Ctrl+Shift+3`) → captures
      the entire screen.
- [ ] **Repeat last capture** hotkey (default `Cmd/Ctrl+Shift+R`) re-runs
      the previous capture mode.

## 8. Annotation
- [ ] Click the pencil icon on a captured screenshot → annotation overlay
      opens with Fabric.js loaded only on demand.
- [ ] Drawing, arrows, text, and the colour picker all work.
- [ ] **Save** writes the annotated PNG back over the original file.

## 9. OCR
- [ ] On a screenshot containing readable text, **Extract text** returns
      a non-empty string.
- [ ] Inserting OCR result into the note works.

## 10. Search (FTS5)
- [ ] Cmd+P opens the quick switcher.
- [ ] Typing partial text from a note finds it.
- [ ] Selecting a result jumps to the note.

## 11. Tags & backlinks
- [ ] Adding `tags: [physics, lab]` to frontmatter and saving → the tag
      chips show up in the editor header.
- [ ] Linking with `[[Other Note]]` creates a backlink visible from the
      target note's panel.

## 12. AI / chat
- [ ] **Open chat panel** → a message round-trips against the configured
      Ollama model.
- [ ] **Cancel** during streaming stops mid-response (no zombie tokens).
- [ ] **Explain selection** sends highlighted text to the explain model
      (defaults to a math-tuned model) and inserts the response.
- [ ] **Generate flashcards** from a note returns valid JSON and lands in
      the flashcards review queue.
- [ ] **Explain screenshot** with a `llava` model produces a description.

## 13. Flashcard review
- [ ] Cards flip on Space / click; arrow keys navigate.
- [ ] Marking a card as "knew it" / "again" updates SRS state in the DB.

## 14. Lecture mode
- [ ] Toggling lecture mode (`Cmd/Ctrl+Shift+L`) starts a timer.
- [ ] Pressing Enter inserts a `[mm:ss / h:mm AM]` timestamp at the new line.

## 15. Export
- [ ] **Export → Markdown** with attachments produces a `.md` file plus an
      `attachments/` folder containing copied images, with rewritten image
      `src` attributes.
- [ ] **Export → PDF** opens a print-preview window; printing produces a
      legible PDF (math, code, images all visible).

## 16. Settings
- [ ] Changing capture hotkey persists to `vault.toml` and re-binds.
- [ ] Switching themes updates colours immediately.
- [ ] AI provider toggle (`Ollama` / `OpenAI`) persists to
      `~/Glyphic/.glyphic/ai.toml`.
- [ ] Pulling a new Ollama model from the recommended list shows real-time
      progress %.

## 17. Reload / restart
- [ ] Closing the app and re-opening it reloads the previously-active vault
      (no onboarding re-shown).
- [ ] Recent vaults list shows the path.
- [ ] No console errors during reload.

## 18. FE Prep regression checklist

- [ ] Start an FE practice session from a seeded bank topic and answer one banked question.
- [ ] Record the attempt and confirm the latest row stores a non-null question id:
      `sqlite3 glyphic.db "SELECT question_id FROM attempts ORDER BY id DESC LIMIT 1"`
- [ ] Confirm banked attempts keep `problem_text` null:
      `sqlite3 glyphic.db "SELECT question_id, problem_text FROM attempts ORDER BY id DESC LIMIT 1"`
- [ ] Confirm topic mastery row is created/updated for that topic:
      `sqlite3 glyphic.db "SELECT topic_id, sm2_ease, sm2_interval, sm2_repetition, due_at FROM topic_mastery ORDER BY rowid DESC LIMIT 1"`
- [ ] Submit an incorrect answer for the same topic and verify interval resets to 1 day.
- [ ] Force fallback (no bank question available) and confirm legacy free-text attempts still save with `question_id` null and `problem_text` populated.
- [ ] Start a timed exam on a Mathematics topic using a custom 5-minute duration.
- [ ] Confirm timer counts down in-session and color shifts to amber at <=10% and red at <=5%.
- [ ] Use the 5-minute break once and verify the timer pauses; verify a second break attempt is disabled and backend returns already-used.
- [ ] Confirm exam mode has no reveal-answer flow while active; answers are only evaluated into final score at submit/end.
- [ ] Let timer reach zero and verify auto-submit/finalize occurs, UI locks, and summary score is shown.
- [ ] Confirm no repeated bank question ids within one timed session (each question appears at most once).

---

## "Did I break it?" mini-checklist (5-minute version)

1. App opens, last vault loads.
2. Open existing note, type a character — autosaves.
3. Insert `$x^2$` — renders.
4. Open chat panel, send "hi" — get a streamed response.
5. Take a screenshot via hotkey — image inserts.
6. Cmd+P → search a known word — finds it.

If all six pass, the core experience is intact.
