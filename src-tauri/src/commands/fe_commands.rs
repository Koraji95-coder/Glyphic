// NOTE: This module requires the following entries in Cargo.toml:
//
//   [dependencies]
//   rusqlite = { version = "0.31", features = ["bundled"] }
//   chrono   = { version = "0.4", features = ["serde"] }
//   serde    = { version = "1", features = ["derive"] }
//   serde_json = "1"
//
// The "bundled" feature for rusqlite compiles SQLite into the binary so no
// system SQLite is required on the target machine.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

// ── Database path ─────────────────────────────────────────────────────────────

/// Resolve the path to the FE progress database.
/// In Tauri 2.0 use app.path() not app.path_resolver().
fn fe_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app_data_dir: {e}"))?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("failed to create app_data_dir: {e}"))?;
    Ok(data_dir.join("glyphic.db"))
}

// ── Schema ────────────────────────────────────────────────────────────────────

/// Ensure all FE tables exist. Call before any FE command.
fn ensure_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS topics (
            id          INTEGER PRIMARY KEY,
            name        TEXT    NOT NULL,
            category    TEXT    NOT NULL,
            subcategory TEXT,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS attempts (
            id                 INTEGER PRIMARY KEY,
            topic_id           INTEGER REFERENCES topics(id),
            timestamp          TEXT    NOT NULL,
            result             TEXT    CHECK(result IN ('correct','incorrect','skipped')),
            time_taken_seconds INTEGER,
            difficulty         TEXT    CHECK(difficulty IN ('easy','medium','hard','')),
            problem_text       TEXT,
            my_answer          TEXT,
            correct_answer     TEXT,
            explanation        TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id              INTEGER PRIMARY KEY,
            session_type    TEXT    CHECK(session_type IN ('practice','timed','full-exam')),
            topics_covered  TEXT,
            started_at      TEXT,
            completed_at    TEXT,
            total_questions INTEGER,
            correct         INTEGER,
            score_percent   REAL
        );",
    )?;

    // ── FE Prep schema migration ──────────────────────────────────────────
    // Adds question bank, session-question linkage, mastery tracking, and
    // user-report tables. Adds question_id to attempts and timer fields to
    // sessions. Wrapped in a transaction so it's all-or-nothing.

    // Detect existing columns before ALTERing.
    let mut has_question_id = false;
    {
        let mut stmt = conn.prepare("PRAGMA table_info(attempts)")?;
        let cols = stmt.query_map([], |row| row.get::<usize, String>(1))?;
        for c in cols {
            if c? == "question_id" { has_question_id = true; break; }
        }
    }
    let (mut has_remaining, mut has_break) = (false, false);
    {
        let mut stmt = conn.prepare("PRAGMA table_info(sessions)")?;
        let cols = stmt.query_map([], |row| row.get::<usize, String>(1))?;
        for c in cols {
            match c?.as_str() {
                "remaining_seconds" => has_remaining = true,
                "break_taken"       => has_break = true,
                _ => {}
            }
        }
    }

    // Atomic migration. Explicit ROLLBACK on error so a half-applied schema
    // doesn't get left behind on a re-run.
    conn.execute("BEGIN", [])?;
    let migration: rusqlite::Result<()> = (|| {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS questions (
                id                     INTEGER PRIMARY KEY,
                topic_id               INTEGER NOT NULL REFERENCES topics(id),
                type                   TEXT    NOT NULL CHECK(type IN ('mc_single','mc_multi','numeric','drag_drop','hotspot')),
                question_text          TEXT    NOT NULL,
                choices                TEXT,
                correct_answer         TEXT    NOT NULL,
                explanation            TEXT,
                difficulty             TEXT    CHECK(difficulty IN ('easy','medium','hard','')),
                bloom_level            INTEGER,
                estimated_time         INTEGER,
                solvable_with_handbook INTEGER NOT NULL DEFAULT 1,
                handbook_section_ref   TEXT,
                needs_review           INTEGER NOT NULL DEFAULT 0,
                created_at             TEXT,
                updated_at             TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);

            CREATE TABLE IF NOT EXISTS question_tags (
                question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                tag         TEXT    NOT NULL,
                PRIMARY KEY (question_id, tag)
            );

            CREATE TABLE IF NOT EXISTS session_questions (
                id          INTEGER PRIMARY KEY,
                session_id  INTEGER NOT NULL REFERENCES sessions(id),
                question_id INTEGER NOT NULL REFERENCES questions(id),
                user_answer TEXT,
                result      TEXT    CHECK(result IN ('correct','partial','incorrect','skipped')),
                time_taken  INTEGER,
                answered_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_session_questions_session ON session_questions(session_id);

            CREATE TABLE IF NOT EXISTS topic_mastery (
                topic_id       INTEGER PRIMARY KEY REFERENCES topics(id),
                ability        REAL    NOT NULL DEFAULT 0.0,
                sm2_ease       REAL    NOT NULL DEFAULT 2.5,
                sm2_interval   REAL    NOT NULL DEFAULT 0.0,
                sm2_repetition INTEGER NOT NULL DEFAULT 0,
                due_at         TEXT
            );

            CREATE TABLE IF NOT EXISTS question_reports (
                id          INTEGER PRIMARY KEY,
                question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                reported_at TEXT,
                reason      TEXT
            );"
        )?;

        if !has_question_id {
            conn.execute("ALTER TABLE attempts ADD COLUMN question_id INTEGER", [])?;
        }
        if !has_remaining {
            conn.execute("ALTER TABLE sessions ADD COLUMN remaining_seconds INTEGER", [])?;
        }
        if !has_break {
            conn.execute("ALTER TABLE sessions ADD COLUMN break_taken INTEGER NOT NULL DEFAULT 0", [])?;
        }

        Ok(())
    })();

    match migration {
        Ok(()) => { conn.execute("COMMIT", [])?; }
        Err(e) => { let _ = conn.execute("ROLLBACK", []); return Err(e); }
    }

    Ok(())
}

/// Seed the official NCEES FE Electrical & Computer topics.
/// Uses INSERT OR IGNORE so it is safe to call on every startup.
fn seed_fe_topics(conn: &Connection) -> rusqlite::Result<()> {
    // (name, category, subcategory, description)
    let topics: &[(&str, &str, &str, &str)] = &[
        // Mathematics
        ("Linear Algebra", "Mathematics", "Mathematics", "Matrices, eigenvalues, vector spaces, and linear transformations."),
        ("Differential Equations", "Mathematics", "Mathematics", "Ordinary and partial differential equations; initial and boundary value problems."),
        ("Complex Numbers", "Mathematics", "Mathematics", "Arithmetic, polar form, Euler's formula, and phasors."),
        ("Probability & Statistics", "Mathematics", "Mathematics", "Probability distributions, mean, variance, hypothesis testing, and reliability."),
        ("Numerical Methods", "Mathematics", "Mathematics", "Root finding, numerical integration, interpolation, and error analysis."),
        // Circuit Analysis
        ("DC Circuits", "Circuit Analysis", "Circuit Analysis", "KVL, KCL, Thevenin/Norton equivalents, nodal and mesh analysis."),
        ("AC Circuits", "Circuit Analysis", "Circuit Analysis", "Phasors, impedance, power factor, resonance, and AC power."),
        ("Transient Response", "Circuit Analysis", "Circuit Analysis", "RL, RC, and RLC transient analysis; time constants."),
        ("Three-Phase Circuits", "Circuit Analysis", "Circuit Analysis", "Balanced and unbalanced three-phase systems; delta and wye configurations."),
        // Electronics
        ("Diodes", "Electronics", "Electronics", "PN junction, rectifiers, clippers, clampers, and Zener diodes."),
        ("BJT Amplifiers", "Electronics", "Electronics", "Biasing, small-signal models, common-emitter/base/collector configurations."),
        ("Op-Amps", "Electronics", "Electronics", "Ideal op-amp analysis, inverting/non-inverting amplifiers, integrators, and comparators."),
        ("Digital Logic", "Electronics", "Electronics", "Boolean algebra, logic gates, combinational and sequential circuits, Karnaugh maps."),
        // Signal Processing
        ("Fourier Series", "Signal Processing", "Signal Processing", "Harmonic analysis, Fourier coefficients, and spectrum of periodic signals."),
        ("Laplace Transforms", "Signal Processing", "Signal Processing", "Transform pairs, inverse Laplace, transfer functions, and stability analysis."),
        ("Z-Transforms", "Signal Processing", "Signal Processing", "Discrete-time signals, Z-transform pairs, and digital filter analysis."),
        ("Filters", "Signal Processing", "Signal Processing", "Passive and active low/high/band-pass filters; Bode plots and frequency response."),
        // Electromagnetics
        ("Maxwell's Equations", "Electromagnetics", "Electromagnetics", "Gauss, Faraday, Ampere laws; divergence and curl; wave equations."),
        ("Transmission Lines", "Electromagnetics", "Electromagnetics", "Characteristic impedance, reflections, standing waves, and Smith chart."),
        ("Antennas", "Electromagnetics", "Electromagnetics", "Radiation patterns, gain, directivity, and Friis transmission equation."),
        // Communications
        ("Modulation", "Communications", "Communications", "AM, FM, PM, ASK, FSK, PSK, and QAM modulation schemes."),
        // Computer Systems
        ("Microprocessors", "Computer Systems", "Computer Systems", "CPU architecture, instruction sets, memory hierarchy, and I/O interfaces."),
        ("Embedded Systems", "Computer Systems", "Computer Systems", "Real-time constraints, peripherals, interrupts, and firmware design patterns."),
    ];

    for (name, category, subcategory, description) in topics {
        conn.execute(
            "INSERT OR IGNORE INTO topics (name, category, subcategory, description) \
             VALUES (?1, ?2, ?3, ?4)",
            params![name, category, subcategory, description],
        )?;
    }
    Ok(())
}

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct Topic {
    pub id:          i64,
    pub name:        String,
    pub category:    String,
    pub subcategory: Option<String>,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct TopicStats {
    pub topic_id: i64,
    pub attempts: i64,
    pub correct:  i64,
    pub accuracy: f64,
}

#[derive(Serialize, Deserialize)]
pub struct WeakTopic {
    pub topic_id: i64,
    pub name:     String,
    pub category: String,
    pub accuracy: f64,
    pub attempts: i64,
}

// ── Helper — open connection ──────────────────────────────────────────────────

fn open_conn(app: &AppHandle) -> Result<Connection, String> {
    let path = fe_db_path(app)?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    ensure_schema(&conn).map_err(|e| e.to_string())?;
    seed_fe_topics(&conn).map_err(|e| e.to_string())?;
    Ok(conn)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Return all topics ordered by id.
#[tauri::command]
pub async fn list_fe_topics(app: AppHandle) -> Result<Vec<Topic>, String> {
    // SQLite calls are blocking — run in a dedicated thread so we don't block
    // the Tokio async executor.
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, category, subcategory, description \
                 FROM topics ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Topic {
                    id:          row.get(0)?,
                    name:        row.get(1)?,
                    category:    row.get(2)?,
                    subcategory: row.get(3)?,
                    description: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Record one practice attempt.
#[tauri::command]
pub async fn record_fe_attempt(
    app: AppHandle,
    topic_id: i64,
    result: String,
    time_taken_seconds: i64,
    difficulty: Option<String>,
    problem_text: Option<String>,
    my_answer: Option<String>,
    correct_answer: Option<String>,
    explanation: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        // chrono::Utc::now() requires `chrono` in Cargo.toml — see file header
        let ts = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO attempts \
             (topic_id, timestamp, result, time_taken_seconds, difficulty, \
              problem_text, my_answer, correct_answer, explanation) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                topic_id,
                ts,
                result,
                time_taken_seconds,
                difficulty.unwrap_or_default(),
                problem_text.unwrap_or_default(),
                my_answer.unwrap_or_default(),
                correct_answer.unwrap_or_default(),
                explanation.unwrap_or_default(),
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Return per-topic accuracy statistics.
#[tauri::command]
pub async fn get_fe_statistics(app: AppHandle) -> Result<Vec<TopicStats>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let mut stmt = conn
            .prepare(
                "SELECT topic_id,
                        COUNT(*) AS attempts,
                        SUM(CASE WHEN result = 'correct' THEN 1 ELSE 0 END) AS correct
                 FROM attempts
                 GROUP BY topic_id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let attempts: i64 = row.get(1)?;
                let correct: i64  = row.get(2)?;
                let accuracy = if attempts > 0 {
                    correct as f64 / attempts as f64
                } else {
                    0.0
                };
                Ok(TopicStats { topic_id: row.get(0)?, attempts, correct, accuracy })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Return topics where accuracy is below the threshold (default 0.70) over
/// the last `min_attempts` attempts (default 10).
/// Used by the FE Prep dashboard to highlight weak areas.
#[tauri::command]
pub async fn get_weak_fe_topics(
    app: AppHandle,
    accuracy_threshold: Option<f64>,
    min_attempts: Option<i64>,
) -> Result<Vec<WeakTopic>, String> {
    let threshold    = accuracy_threshold.unwrap_or(0.70);
    let min_attempts = min_attempts.unwrap_or(5);

    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let mut stmt = conn
            .prepare(
                "SELECT a.topic_id, t.name, t.category,
                        COUNT(*) AS attempts,
                        SUM(CASE WHEN a.result = 'correct' THEN 1.0 ELSE 0.0 END) / COUNT(*) AS accuracy
                 FROM attempts a
                 JOIN topics t ON t.id = a.topic_id
                 GROUP BY a.topic_id
                 HAVING attempts >= ?1 AND accuracy < ?2
                 ORDER BY accuracy ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![min_attempts, threshold], |row| {
                Ok(WeakTopic {
                    topic_id: row.get(0)?,
                    name:     row.get(1)?,
                    category: row.get(2)?,
                    attempts: row.get(3)?,
                    accuracy: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Start a new session and return its id.
#[tauri::command]
pub async fn start_fe_session(
    app: AppHandle,
    session_type: String,
    topics_covered: Vec<String>,
) -> Result<i64, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let ts = chrono::Utc::now().to_rfc3339();
        let topics_json = serde_json::to_string(&topics_covered).unwrap_or_default();
        conn.execute(
            "INSERT INTO sessions (session_type, topics_covered, started_at) \
             VALUES (?1, ?2, ?3)",
            params![session_type, topics_json, ts],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Complete a session with final results.
#[tauri::command]
pub async fn complete_fe_session(
    app: AppHandle,
    session_id: i64,
    total_questions: i64,
    correct: i64,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let ts = chrono::Utc::now().to_rfc3339();
        let score = if total_questions > 0 {
            correct as f64 / total_questions as f64 * 100.0
        } else {
            0.0
        };
        conn.execute(
            "UPDATE sessions \
             SET completed_at = ?1, total_questions = ?2, correct = ?3, score_percent = ?4 \
             WHERE id = ?5",
            params![ts, total_questions, correct, score, session_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn in_memory_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        ensure_schema(&conn).expect("schema");
        conn
    }

    #[test]
    fn seed_inserts_23_topics() {
        let conn = in_memory_conn();
        seed_fe_topics(&conn).expect("seed");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM topics", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 23, "expected 23 FE E&C topics after seeding");
    }

    #[test]
    fn seed_is_idempotent() {
        let conn = in_memory_conn();
        seed_fe_topics(&conn).expect("first seed");
        seed_fe_topics(&conn).expect("second seed");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM topics", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 23, "seeding twice must not duplicate rows");
    }

    #[test]
    fn all_required_categories_present() {
        let conn = in_memory_conn();
        seed_fe_topics(&conn).expect("seed");
        for cat in &[
            "Mathematics",
            "Circuit Analysis",
            "Electronics",
            "Signal Processing",
            "Electromagnetics",
            "Communications",
            "Computer Systems",
        ] {
            let n: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM topics WHERE category = ?1",
                    params![cat],
                    |r| r.get(0),
                )
                .expect("count");
            assert!(n > 0, "category '{cat}' missing after seed");
        }
    }
}
