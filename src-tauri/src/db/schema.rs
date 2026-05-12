use rusqlite::Connection;
use std::path::Path;

pub fn init_database(vault_path: &Path) -> Result<Connection, String> {
    let db_path = vault_path.join(".glyphic").join("index.db");

    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {e}"))?;

    // Enable WAL mode for better concurrent access
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {e}"))?;

    conn.execute_batch(
        "
        -- Notes table
        CREATE TABLE IF NOT EXISTS notes (
            id          TEXT PRIMARY KEY,
            path        TEXT NOT NULL UNIQUE,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL DEFAULT '',
            tags        TEXT NOT NULL DEFAULT '',
            created_at  TEXT NOT NULL,
            modified_at TEXT NOT NULL
        );

        -- FTS5 virtual table for notes
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            content,
            tags,
            content='notes',
            content_rowid='rowid'
        );

        -- Screenshots table
        CREATE TABLE IF NOT EXISTS screenshots (
            id             TEXT PRIMARY KEY,
            note_id        TEXT,
            path           TEXT NOT NULL,
            thumbnail_path TEXT,
            width          INTEGER NOT NULL DEFAULT 0,
            height         INTEGER NOT NULL DEFAULT 0,
            ocr_text       TEXT NOT NULL DEFAULT '',
            captured_at    TEXT NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
        );

        -- FTS5 virtual table for screenshots
        CREATE VIRTUAL TABLE IF NOT EXISTS screenshots_fts USING fts5(
            ocr_text,
            content='screenshots',
            content_rowid='rowid'
        );

        -- Annotations table (legacy per-shape rows; kept for forward compat)
        CREATE TABLE IF NOT EXISTS annotations (
            id            TEXT PRIMARY KEY,
            screenshot_id TEXT NOT NULL,
            annotation    TEXT NOT NULL DEFAULT '',
            x             REAL NOT NULL DEFAULT 0,
            y             REAL NOT NULL DEFAULT 0,
            width         REAL NOT NULL DEFAULT 0,
            height        REAL NOT NULL DEFAULT 0,
            created_at    TEXT NOT NULL,
            FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
        );

        -- Per-image Fabric.js annotation blobs (sidecar mirror).
        -- One row per image; the JSON blob is the same payload that lives in
        -- the `<image>.annotations.json` sidecar file (the source of truth).
        -- We keep this table so search can hit text annotations via FTS.
        CREATE TABLE IF NOT EXISTS annotation_blobs (
            image_path  TEXT PRIMARY KEY,
            data        TEXT NOT NULL DEFAULT '',
            text_index  TEXT NOT NULL DEFAULT '',
            updated_at  TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS annotation_blobs_fts USING fts5(
            text_index,
            content='annotation_blobs',
            content_rowid='rowid'
        );

        -- Tags table
        CREATE TABLE IF NOT EXISTS tags (
            id   TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );

        -- Backlinks table
        CREATE TABLE IF NOT EXISTS backlinks (
            id             TEXT PRIMARY KEY,
            source_note_id TEXT NOT NULL,
            target_note_id TEXT NOT NULL,
            context        TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
            FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        -- Backup metadata table for Dropbox sync tracking
        CREATE TABLE IF NOT EXISTS backup_history (
            id               TEXT PRIMARY KEY,
            timestamp        TEXT NOT NULL,
            status           TEXT NOT NULL DEFAULT 'pending',
            error_message    TEXT,
            dropbox_path     TEXT,
            size_bytes       INTEGER DEFAULT 0,
            notes_count      INTEGER DEFAULT 0,
            screenshots_count INTEGER DEFAULT 0,
            created_at       TEXT NOT NULL
        );

        -- Settings for backup (encryption key, dropbox token, last sync time)
        CREATE TABLE IF NOT EXISTS backup_settings (
            key              TEXT PRIMARY KEY,
            value            TEXT NOT NULL,
            updated_at       TEXT NOT NULL
        );

        -- Phase 3: Study Attempts (practice problems and responses)
        CREATE TABLE IF NOT EXISTS study_attempts (
            id                 TEXT PRIMARY KEY,
            note_id            TEXT NOT NULL,
            problem_type       TEXT NOT NULL DEFAULT 'solve',
            attempt_number     INTEGER NOT NULL DEFAULT 1,
            created_at         TEXT NOT NULL,
            completed_at       TEXT,
            question           TEXT NOT NULL,
            student_response   TEXT,
            ai_feedback        TEXT,
            score              REAL,
            confidence         REAL,
            is_correct         BOOLEAN,
            time_to_solution_ms INTEGER,
            misconceptions_detected TEXT,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        -- FTS5 virtual table for study attempts (search by question, feedback)
        CREATE VIRTUAL TABLE IF NOT EXISTS study_attempts_fts USING fts5(
            question,
            ai_feedback,
            content='study_attempts',
            content_rowid='rowid'
        );

        -- Phase 3: Mastery History (Bayesian posterior tracking)
        CREATE TABLE IF NOT EXISTS mastery_history (
            id                    TEXT PRIMARY KEY,
            note_id               TEXT,
            topic                 TEXT NOT NULL,
            mastery_level         REAL NOT NULL,
            confidence_lower_95   REAL,
            confidence_upper_95   REAL,
            attempt_count         INTEGER DEFAULT 0,
            batch_id              TEXT,
            created_at            TEXT NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        -- Triggers: keep study_attempts_fts in sync with study_attempts
        CREATE TRIGGER IF NOT EXISTS study_attempts_ai AFTER INSERT ON study_attempts BEGIN
            INSERT INTO study_attempts_fts(rowid, question, ai_feedback)
            VALUES (new.rowid, new.question, new.ai_feedback);
        END;

        CREATE TRIGGER IF NOT EXISTS study_attempts_ad AFTER DELETE ON study_attempts BEGIN
            INSERT INTO study_attempts_fts(study_attempts_fts, rowid, question, ai_feedback)
            VALUES ('delete', old.rowid, old.question, old.ai_feedback);
        END;

        CREATE TRIGGER IF NOT EXISTS study_attempts_au AFTER UPDATE ON study_attempts BEGIN
            INSERT INTO study_attempts_fts(study_attempts_fts, rowid, question, ai_feedback)
            VALUES ('delete', old.rowid, old.question, old.ai_feedback);
            INSERT INTO study_attempts_fts(rowid, question, ai_feedback)
            VALUES (new.rowid, new.question, new.ai_feedback);
        END;

        -- Triggers: keep backup_settings and phase 3 tables in sync
        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content, tags)
            VALUES (new.rowid, new.title, new.content, new.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
            VALUES ('delete', old.rowid, old.title, old.content, old.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content, tags)
            VALUES ('delete', old.rowid, old.title, old.content, old.tags);
            INSERT INTO notes_fts(rowid, title, content, tags)
            VALUES (new.rowid, new.title, new.content, new.tags);
        END;

        -- Triggers: keep screenshots_fts in sync with screenshots
        CREATE TRIGGER IF NOT EXISTS screenshots_ai AFTER INSERT ON screenshots BEGIN
            INSERT INTO screenshots_fts(rowid, ocr_text)
            VALUES (new.rowid, new.ocr_text);
        END;

        CREATE TRIGGER IF NOT EXISTS screenshots_ad AFTER DELETE ON screenshots BEGIN
            INSERT INTO screenshots_fts(screenshots_fts, rowid, ocr_text)
            VALUES ('delete', old.rowid, old.ocr_text);
        END;

        CREATE TRIGGER IF NOT EXISTS screenshots_au AFTER UPDATE ON screenshots BEGIN
            INSERT INTO screenshots_fts(screenshots_fts, rowid, ocr_text)
            VALUES ('delete', old.rowid, old.ocr_text);
            INSERT INTO screenshots_fts(rowid, ocr_text)
            VALUES (new.rowid, new.ocr_text);
        END;

        -- Triggers: keep annotation_blobs_fts in sync with annotation_blobs
        CREATE TRIGGER IF NOT EXISTS annotation_blobs_ai AFTER INSERT ON annotation_blobs BEGIN
            INSERT INTO annotation_blobs_fts(rowid, text_index)
            VALUES (new.rowid, new.text_index);
        END;

        CREATE TRIGGER IF NOT EXISTS annotation_blobs_ad AFTER DELETE ON annotation_blobs BEGIN
            INSERT INTO annotation_blobs_fts(annotation_blobs_fts, rowid, text_index)
            VALUES ('delete', old.rowid, old.text_index);
        END;

        CREATE TRIGGER IF NOT EXISTS annotation_blobs_au AFTER UPDATE ON annotation_blobs BEGIN
            INSERT INTO annotation_blobs_fts(annotation_blobs_fts, rowid, text_index)
            VALUES ('delete', old.rowid, old.text_index);
            INSERT INTO annotation_blobs_fts(rowid, text_index)
            VALUES (new.rowid, new.text_index);
        END;
        ",
    )
    .map_err(|e| format!("Failed to initialize schema: {e}"))?;

    Ok(conn)
}
