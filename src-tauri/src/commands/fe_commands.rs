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
use serde_json::json;
use tauri::{AppHandle, Manager};

const FE_SCHEMA_VERSION: i64 = 1;

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
    // sessions. Guarded with PRAGMA user_version and executed atomically.
    let user_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if user_version < FE_SCHEMA_VERSION {
        // Detect existing columns before ALTERing.
        let mut has_question_id = false;
        {
            let mut stmt = conn.prepare("PRAGMA table_info(attempts)")?;
            let cols = stmt.query_map([], |row| row.get::<usize, String>(1))?;
            for c in cols {
                if c? == "question_id" {
                    has_question_id = true;
                    break;
                }
            }
        }
        let (mut has_remaining, mut has_break, mut has_last_tick) = (false, false, false);
        {
            let mut stmt = conn.prepare("PRAGMA table_info(sessions)")?;
            let cols = stmt.query_map([], |row| row.get::<usize, String>(1))?;
            for c in cols {
                match c?.as_str() {
                    "remaining_seconds" => has_remaining = true,
                    "break_taken" => has_break = true,
                    "last_tick_at" => has_last_tick = true,
                    _ => {}
                }
            }
        }

        // Atomic migration. Explicit ROLLBACK on error so a half-applied
        // schema doesn't get left behind on a re-run.
        conn.execute("BEGIN IMMEDIATE", [])?;
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
            if !has_last_tick {
                conn.execute("ALTER TABLE sessions ADD COLUMN last_tick_at TEXT", [])?;
            }

            conn.execute(&format!("PRAGMA user_version = {FE_SCHEMA_VERSION}"), [])?;
            Ok(())
        })();

        match migration {
            Ok(()) => {
                conn.execute("COMMIT", [])?;
            }
            Err(e) => {
                let _ = conn.execute("ROLLBACK", []);
                return Err(e);
            }
        }
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
            "INSERT INTO topics (name, category, subcategory, description)
             SELECT ?1, ?2, ?3, ?4
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM topics
                 WHERE name = ?1
                   AND category = ?2
                   AND COALESCE(subcategory, '') = COALESCE(?3, '')
             )",
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

#[derive(Serialize, Deserialize)]
pub struct SessionTick {
    pub remaining_seconds: i64,
    pub expired: bool,
}

// ── Question Bank data types ──────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct QuestionListItem {
    pub id: i64,
    pub prompt_truncated: String,
    pub q_type: String,
    pub difficulty: Option<String>,
    pub needs_review: i64,
    pub last_attempted: Option<String>,
    pub success_rate: f64,
}

#[derive(Serialize, Deserialize)]
pub struct QuestionDetail {
    pub id: i64,
    pub topic_id: i64,
    pub question_text: String,
    pub choices: Option<Vec<String>>,
    pub correct_answer: String,
    pub explanation: Option<String>,
    pub q_type: String,
    pub difficulty: Option<String>,
    pub bloom_level: Option<i64>,
    pub estimated_time: Option<i64>,
    pub handbook_section_ref: Option<String>,
    pub needs_review: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct TopicWithQuestionCount {
    pub id: i64,
    pub name: String,
    pub question_count: i64,
    pub needs_review_count: i64,
}

// ── Helper — open connection ──────────────────────────────────────────────────

fn open_conn(app: &AppHandle) -> Result<Connection, String> {
    let path = fe_db_path(app)?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    ensure_schema(&conn).map_err(|e| e.to_string())?;
    seed_fe_topics(&conn).map_err(|e| e.to_string())?;
    Ok(conn)
}

fn update_topic_mastery(
    tx: &rusqlite::Transaction<'_>,
    topic_id: i64,
    result: &str,
    now: &chrono::DateTime<chrono::Utc>,
) -> rusqlite::Result<()> {
    if result != "correct" && result != "incorrect" {
        return Ok(());
    }

    let existing = tx.query_row(
        "SELECT sm2_ease, sm2_interval, sm2_repetition, ability FROM topic_mastery WHERE topic_id = ?1",
        params![topic_id],
        |row| {
            Ok((
                row.get::<_, f64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, f64>(3)?,
            ))
        },
    );

    let (prev_ease, prev_interval, prev_repetition, prev_ability) =
        existing.unwrap_or((2.5, 0.0, 0, 0.0));

    let (next_ease, next_interval, next_repetition, next_ability) = if result == "correct" {
        let bumped_ease = (prev_ease + 0.1).min(3.0);
        let repetition = prev_repetition + 1;
        let interval = if repetition <= 1 {
            1.0
        } else if repetition == 2 {
            6.0
        } else {
            (prev_interval.max(1.0) * bumped_ease).round().max(1.0)
        };
        (bumped_ease, interval, repetition, (prev_ability + 0.05).min(1.0))
    } else {
        (prev_ease.max(1.3), 1.0, 0, (prev_ability - 0.05).max(0.0))
    };

    let due_at = (*now + chrono::Duration::days(next_interval as i64)).to_rfc3339();

    tx.execute(
        "INSERT INTO topic_mastery (topic_id, ability, sm2_ease, sm2_interval, sm2_repetition, due_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(topic_id) DO UPDATE SET
           ability = excluded.ability,
           sm2_ease = excluded.sm2_ease,
           sm2_interval = excluded.sm2_interval,
           sm2_repetition = excluded.sm2_repetition,
           due_at = excluded.due_at",
        params![
            topic_id,
            next_ability,
            next_ease,
            next_interval,
            next_repetition,
            due_at,
        ],
    )?;

    Ok(())
}

fn record_attempt_and_update_mastery(
    conn: &mut Connection,
    topic_id: i64,
    result: String,
    time_taken_seconds: i64,
    question_id: Option<i64>,
    difficulty: Option<String>,
    problem_text: Option<String>,
    my_answer: Option<String>,
    correct_answer: Option<String>,
    explanation: Option<String>,
) -> Result<(), String> {
    let now = chrono::Utc::now();
    let ts = now.to_rfc3339();
    let stored_problem_text = if question_id.is_some() {
        None
    } else {
        problem_text
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO attempts \
         (topic_id, question_id, timestamp, result, time_taken_seconds, difficulty, \
          problem_text, my_answer, correct_answer, explanation) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            topic_id,
            question_id,
            ts,
            result,
            time_taken_seconds,
            difficulty.unwrap_or_default(),
            stored_problem_text,
            my_answer,
            correct_answer,
            explanation,
        ],
    )
    .map_err(|e| e.to_string())?;

    update_topic_mastery(&tx, topic_id, &result, &now).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())
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
    question_id: Option<i64>,
    difficulty: Option<String>,
    problem_text: Option<String>,
    my_answer: Option<String>,
    correct_answer: Option<String>,
    explanation: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut conn = open_conn(&app)?;
        record_attempt_and_update_mastery(
            &mut conn,
            topic_id,
            result,
            time_taken_seconds,
            question_id,
            difficulty,
            problem_text,
            my_answer,
            correct_answer,
            explanation,
        )
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
    duration_seconds: Option<i64>,
) -> Result<i64, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let ts = chrono::Utc::now().to_rfc3339();
        let topics_json = serde_json::to_string(&topics_covered).unwrap_or_default();

        let normalized = session_type.trim().to_lowercase();
        let canonical_session_type = match normalized.as_str() {
            // Keep compatibility with the existing DB CHECK constraint that already
            // allows "timed" while still accepting "exam" at the API boundary.
            "exam" | "timed" => "timed",
            "full-exam" => "full-exam",
            _ => "practice",
        };

        let default_duration = if canonical_session_type == "timed" { 21_600 } else { 3_600 };
        let effective_duration = duration_seconds.unwrap_or(default_duration).max(60);
        let initial_remaining = if canonical_session_type == "practice" {
            None
        } else {
            Some(effective_duration)
        };

        conn.execute(
            "INSERT INTO sessions \
             (session_type, topics_covered, started_at, remaining_seconds, break_taken, last_tick_at) \
             VALUES (?1, ?2, ?3, ?4, 0, ?5)",
            params![canonical_session_type, topics_json, ts, initial_remaining, ts],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Tick down an active timed session based on elapsed wall time since last tick.
#[tauri::command]
pub async fn tick_session(
    app: AppHandle,
    session_id: i64,
) -> Result<SessionTick, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let now = chrono::Utc::now();
        let now_rfc = now.to_rfc3339();

        let (remaining_opt, break_taken, completed_at, last_tick_at_opt): (Option<i64>, i64, Option<String>, Option<String>) = conn
            .query_row(
                "SELECT remaining_seconds, break_taken, completed_at, last_tick_at FROM sessions WHERE id = ?1",
                params![session_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| e.to_string())?;

        if completed_at.is_some() {
            return Ok(SessionTick {
                remaining_seconds: remaining_opt.unwrap_or(0).max(0),
                expired: true,
            });
        }

        let Some(mut remaining) = remaining_opt else {
            return Ok(SessionTick { remaining_seconds: 0, expired: false });
        };

        if break_taken == 1 {
            let break_resume_at = last_tick_at_opt
                .as_deref()
                .and_then(|ts| chrono::DateTime::parse_from_rfc3339(ts).ok())
                .map(|dt| dt.with_timezone(&chrono::Utc));

            if let Some(resume_at) = break_resume_at {
                if now < resume_at {
                    return Ok(SessionTick { remaining_seconds: remaining.max(0), expired: false });
                }
            }
        }

        let baseline = last_tick_at_opt
            .as_deref()
            .and_then(|ts| chrono::DateTime::parse_from_rfc3339(ts).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or(now);
        let elapsed = (now - baseline).num_seconds().max(0);

        if elapsed > 0 {
            remaining = (remaining - elapsed).max(0);
            conn.execute(
                "UPDATE sessions SET remaining_seconds = ?1, last_tick_at = ?2 WHERE id = ?3",
                params![remaining, now_rfc, session_id],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(SessionTick {
            remaining_seconds: remaining,
            expired: remaining <= 0,
        })
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Consume a one-time 5-minute break for a timed session.
#[tauri::command]
pub async fn take_break(
    app: AppHandle,
    session_id: i64,
) -> Result<SessionTick, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let now = chrono::Utc::now();

        let (remaining_opt, break_taken, completed_at): (Option<i64>, i64, Option<String>) = conn
            .query_row(
                "SELECT remaining_seconds, break_taken, completed_at FROM sessions WHERE id = ?1",
                params![session_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| e.to_string())?;

        if completed_at.is_some() {
            return Err("session already completed".to_string());
        }
        if break_taken == 1 {
            return Err("break already used".to_string());
        }

        let Some(remaining) = remaining_opt else {
            return Err("break is only available for timed sessions".to_string());
        };

        let resume_at = (now + chrono::Duration::minutes(5)).to_rfc3339();
        conn.execute(
            "UPDATE sessions SET break_taken = 1, last_tick_at = ?1 WHERE id = ?2",
            params![resume_at, session_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(SessionTick {
            remaining_seconds: remaining.max(0),
            expired: remaining <= 0,
        })
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

// ── Question Bank management commands ─────────────────────────────────────────

/// List all topics with their question counts and needs_review counts.
#[tauri::command]
pub async fn list_topics_with_question_counts(app: AppHandle) -> Result<Vec<TopicWithQuestionCount>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.name,
                        COUNT(q.id) AS question_count,
                        SUM(CASE WHEN q.needs_review = 1 THEN 1 ELSE 0 END) AS needs_review_count
                 FROM topics t
                 LEFT JOIN questions q ON q.topic_id = t.id
                 GROUP BY t.id
                 ORDER BY t.id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(TopicWithQuestionCount {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    question_count: row.get(2).unwrap_or(0),
                    needs_review_count: row.get(3).unwrap_or(0),
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// List questions for a given topic with stats.
#[tauri::command]
pub async fn list_questions_by_topic(app: AppHandle, topic_id: i64) -> Result<Vec<QuestionListItem>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let mut stmt = conn
            .prepare(
                "SELECT q.id,
                        SUBSTR(q.question_text, 1, 100) AS prompt_truncated,
                        q.type,
                        q.difficulty,
                        q.needs_review,
                        MAX(a.timestamp) AS last_attempted,
                        AVG(CASE WHEN a.result = 'correct' THEN 1.0 ELSE 0.0 END) AS success_rate
                 FROM questions q
                 LEFT JOIN attempts a ON a.question_id = q.id
                 WHERE q.topic_id = ?1
                 GROUP BY q.id
                 ORDER BY q.id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![topic_id], |row| {
                Ok(QuestionListItem {
                    id: row.get(0)?,
                    prompt_truncated: row.get(1)?,
                    q_type: row.get(2)?,
                    difficulty: row.get(3)?,
                    needs_review: row.get(4)?,
                    last_attempted: row.get(5)?,
                    success_rate: row.get(6).unwrap_or(0.0),
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Get full details of a single question.
#[tauri::command]
pub async fn get_question_detail(app: AppHandle, question_id: i64) -> Result<QuestionDetail, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        conn.query_row(
            "SELECT id, topic_id, question_text, choices, correct_answer, explanation,
                    type, difficulty, bloom_level, estimated_time, handbook_section_ref,
                    needs_review, created_at, updated_at
             FROM questions WHERE id = ?1",
            params![question_id],
            |row| {
                let choices_str: Option<String> = row.get(3)?;
                let choices = choices_str
                    .as_deref()
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok());
                Ok(QuestionDetail {
                    id: row.get(0)?,
                    topic_id: row.get(1)?,
                    question_text: row.get(2)?,
                    choices,
                    correct_answer: row.get(4)?,
                    explanation: row.get(5)?,
                    q_type: row.get(6)?,
                    difficulty: row.get(7)?,
                    bloom_level: row.get(8)?,
                    estimated_time: row.get(9)?,
                    handbook_section_ref: row.get(10)?,
                    needs_review: row.get(11)?,
                    created_at: row.get(12)?,
                    updated_at: row.get(13)?,
                })
            },
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Add a new question to the question bank.
#[tauri::command]
pub async fn add_fe_question(
    app: AppHandle,
    topic_id: i64,
    question_text: String,
    correct_answer: String,
    explanation: Option<String>,
    q_type: String,
    difficulty: Option<String>,
    handbook_section_ref: Option<String>,
    choices: Option<Vec<String>>,
) -> Result<i64, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let ts = chrono::Utc::now().to_rfc3339();
        let choices_json = choices
            .and_then(|c| serde_json::to_string(&c).ok());

        conn.execute(
            "INSERT INTO questions \
             (topic_id, type, question_text, choices, correct_answer, explanation, \
              difficulty, handbook_section_ref, needs_review, created_at, updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0,?9,?9)",
            params![
                topic_id,
                q_type,
                question_text,
                choices_json,
                correct_answer,
                explanation,
                difficulty,
                handbook_section_ref,
                ts
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(conn.last_insert_rowid())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Update an existing question.
#[tauri::command]
pub async fn update_fe_question(
    app: AppHandle,
    question_id: i64,
    question_text: Option<String>,
    correct_answer: Option<String>,
    explanation: Option<String>,
    difficulty: Option<String>,
    handbook_section_ref: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let ts = chrono::Utc::now().to_rfc3339();

        // Update only the provided fields
        if let Some(q) = question_text {
            conn.execute(
                "UPDATE questions SET question_text = ?1, updated_at = ?2 WHERE id = ?3",
                params![q, ts, question_id],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some(a) = correct_answer {
            conn.execute(
                "UPDATE questions SET correct_answer = ?1, updated_at = ?2 WHERE id = ?3",
                params![a, ts, question_id],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some(e) = explanation {
            conn.execute(
                "UPDATE questions SET explanation = ?1, updated_at = ?2 WHERE id = ?3",
                params![e, ts, question_id],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some(d) = difficulty {
            conn.execute(
                "UPDATE questions SET difficulty = ?1, updated_at = ?2 WHERE id = ?3",
                params![d, ts, question_id],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some(h) = handbook_section_ref {
            conn.execute(
                "UPDATE questions SET handbook_section_ref = ?1, updated_at = ?2 WHERE id = ?3",
                params![h, ts, question_id],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Flag/report a question with a reason.
#[tauri::command]
pub async fn flag_question(
    app: AppHandle,
    question_id: i64,
    reason: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let ts = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO question_reports (question_id, reported_at, reason) VALUES (?1, ?2, ?3)",
            params![question_id, ts, reason],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Mark a question as reviewed (human verified).
#[tauri::command]
pub async fn mark_question_reviewed(
    app: AppHandle,
    question_id: i64,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let ts = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE questions SET needs_review = 0, updated_at = ?1 WHERE id = ?2",
            params![ts, question_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

// ── Question bank structs ─────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct SeedQuestion {
    #[serde(rename = "type")]
    q_type: String,
    prompt: String,
    choices: Option<Vec<String>>,
    correct_answer: String,
    unit: Option<String>,
    tolerance: Option<f64>,
    explanation: Option<String>,
    difficulty: Option<String>,
    bloom_level: Option<i64>,
    estimated_seconds: Option<i64>,
    handbook_ref: Option<String>,
    review_status: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SeedFile {
    topic: String,
    questions: Vec<SeedQuestion>,
}

#[derive(Serialize, Deserialize)]
pub struct FeQuestion {
    pub id: i64,
    pub topic_id: i64,
    #[serde(rename = "type")]
    pub q_type: String,
    pub question_text: String,
    pub choices: Option<Vec<String>>,
    pub correct_answer: String,
    pub explanation: Option<String>,
    pub difficulty: Option<String>,
    pub bloom_level: Option<i64>,
    pub estimated_time: Option<i64>,
    pub handbook_section_ref: Option<String>,
}

// ── Question bank commands ────────────────────────────────────────────────────

/// Seed the question bank from JSON files bundled under sidecars/study_engine/seed_questions/.
/// Idempotent: returns early if questions table already has rows.
#[tauri::command]
pub async fn seed_question_bank(app: AppHandle) -> Result<usize, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM questions", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if count > 0 {
            return Ok(count as usize);
        }

        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("resource_dir: {e}"))?;
        let seed_dir = resource_dir
            .join("sidecars")
            .join("study_engine")
            .join("seed_questions");

        let entries = std::fs::read_dir(&seed_dir)
            .map_err(|e| format!("read_dir {:?}: {e}", seed_dir))?;

        let mut total = 0usize;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let file: SeedFile = serde_json::from_str(&text)
                .map_err(|e| format!("parse {:?}: {e}", path))?;

            let topic_id: i64 = conn
                .query_row(
                    "SELECT id FROM topics WHERE name = ?1",
                    params![file.topic],
                    |r| r.get(0),
                )
                .map_err(|e| format!("topic '{}' not found: {e}", file.topic))?;

            for q in &file.questions {
                let choices_json = q
                    .choices
                    .as_ref()
                    .map(|c| serde_json::to_string(c).unwrap_or_default());
                let ts = chrono::Utc::now().to_rfc3339();
                let needs_review =
                    if q.review_status.as_deref() == Some("ai_draft") { 1 } else { 0 };
                conn.execute(
                    "INSERT OR IGNORE INTO questions \
                     (topic_id, type, question_text, choices, correct_answer, explanation, \
                      difficulty, bloom_level, estimated_time, handbook_section_ref, \
                      needs_review, created_at, updated_at) \
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)",
                    params![
                        topic_id,
                        q.q_type,
                        q.prompt,
                        choices_json,
                        q.correct_answer,
                        q.explanation,
                        q.difficulty,
                        q.bloom_level,
                        q.estimated_seconds,
                        q.handbook_ref,
                        needs_review,
                        ts
                    ],
                )
                .map_err(|e| e.to_string())?;
                total += 1;
            }
        }
        Ok(total)
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Return one random question for a topic, excluding recently-seen IDs.
/// Returns None when no questions exist for the topic (caller should fall back
/// to Ollama generation).
#[tauri::command]
pub async fn get_question_for_session(
    app: AppHandle,
    topic_id: i64,
    exclude_recent_ids: Vec<i64>,
) -> Result<Option<FeQuestion>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let select_one = |exclude_sql: &str| -> Result<Option<FeQuestion>, String> {
            let sql = format!(
                "SELECT q.id, q.topic_id, q.type, q.question_text, q.choices, q.correct_answer, \
                 q.explanation, q.difficulty, q.bloom_level, q.estimated_time, q.handbook_section_ref \
                 FROM questions q \
                 LEFT JOIN ( \
                     SELECT \
                         question_id, \
                         MAX(timestamp) AS last_seen, \
                         COUNT(*) AS attempt_count, \
                         AVG(CASE WHEN result = 'correct' THEN 1.0 ELSE 0.0 END) AS correct_rate \
                     FROM attempts \
                     WHERE question_id IS NOT NULL \
                     GROUP BY question_id \
                 ) qa ON qa.question_id = q.id \
                 WHERE q.topic_id = ?1 {} \
                                 ORDER BY q.id ASC \
                 LIMIT 1",
                exclude_sql
            );

            let result = conn.query_row(&sql, params![topic_id], |row| {
                let choices_str: Option<String> = row.get(4)?;
                let choices = choices_str
                    .as_deref()
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok());
                Ok(FeQuestion {
                    id: row.get(0)?,
                    topic_id: row.get(1)?,
                    q_type: row.get(2)?,
                    question_text: row.get(3)?,
                    choices,
                    correct_answer: row.get(5)?,
                    explanation: row.get(6)?,
                    difficulty: row.get(7)?,
                    bloom_level: row.get(8)?,
                    estimated_time: row.get(9)?,
                    handbook_section_ref: row.get(10)?,
                })
            });

            match result {
                Ok(q) => Ok(Some(q)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.to_string()),
            }
        };

        let with_exclusions = if exclude_recent_ids.is_empty() {
            "".to_string()
        } else {
            format!(
                "AND q.id NOT IN ({})",
                exclude_recent_ids
                    .iter()
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
                    .join(",")
            )
        };

        if let Some(q) = select_one(&with_exclusions)? {
            Ok(Some(q))
        } else if !exclude_recent_ids.is_empty() {
            // If exclusions filter out all questions, retry without exclusions.
            select_one("")
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

// ── FE Engine sidecar — reference materials (formulas, unit conversion, handbook Q&A) ────

/// Response types for fe_engine commands
#[derive(Serialize, Deserialize)]
pub struct FormulaResult {
    pub id: String,
    pub name: String,
    pub formula_latex: String,
    pub variables: std::collections::HashMap<String, String>,
    pub description: String,
    pub topic: String,
    pub handbook_page: i64,
}

#[derive(Serialize, Deserialize)]
pub struct UnitConversionResult {
    pub value: f64,
    pub unit: String,
}

#[derive(Serialize, Deserialize)]
pub struct HandbookQAResult {
    pub answer: String,
    pub citations: Vec<String>,
}

/// Spawn the fe_engine sidecar, send one JSON request on stdin and collect
/// the JSON response from stdout.
async fn run_fe_engine(
    app: &AppHandle,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::process::Command;

    // Determine the Python interpreter and sidecar path
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {e}"))?;
    let fe_engine_path = resource_dir.join("sidecars").join("fe_engine").join("main.py");

    let mut child = Command::new("python")
        .arg(fe_engine_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn fe_engine: {e}"))?;

    // Write request then close stdin
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "failed to open sidecar stdin".to_string())?;
        let req_str = request.to_string() + "\n";
        stdin
            .write_all(req_str.as_bytes())
            .await
            .map_err(|e| format!("failed to write to sidecar: {e}"))?;
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to open sidecar stdout".to_string())?;

    // Drain stderr in background
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(_)) = lines.next_line().await {}
        });
    }

    let mut lines = BufReader::new(stdout).lines();
    let mut last_obj: Option<serde_json::Value> = None;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim_end().to_string();
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(obj) => last_obj = Some(obj),
            Err(_) => continue,
        }
    }

    let _ = child.wait().await;
    last_obj.ok_or_else(|| "no response from fe_engine".to_string())
}

#[tauri::command]
pub async fn fe_formula_lookup(
    app: AppHandle,
    query: String,
    topic: Option<String>,
) -> Result<Vec<FormulaResult>, String> {
    let req = json!({
        "action": "formula_lookup",
        "query": query,
        "topic": topic,
    });
    let response = run_fe_engine(&app, req).await?;

    // Check for error response
    if response.get("event").and_then(|e| e.as_str()) == Some("error") {
        let msg = response
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown error");
        return Err(msg.to_string());
    }

    // Extract payload and parse formulas
    response
        .get("payload")
        .and_then(|p| p.get("formulas"))
        .and_then(|f| f.as_array())
        .ok_or_else(|| "invalid response format".to_string())?
        .iter()
        .map(|item| {
            serde_json::from_value::<FormulaResult>(item.clone())
                .map_err(|e| format!("formula parse error: {e}"))
        })
        .collect()
}

#[tauri::command]
pub async fn fe_unit_convert(
    app: AppHandle,
    value: f64,
    from_unit: String,
    to_unit: String,
) -> Result<UnitConversionResult, String> {
    let req = json!({
        "action": "unit_convert",
        "value": value,
        "from_unit": from_unit,
        "to_unit": to_unit,
    });
    let response = run_fe_engine(&app, req).await?;

    // Check for error response
    if response.get("event").and_then(|e| e.as_str()) == Some("error") {
        let msg = response
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown error");
        return Err(msg.to_string());
    }

    // Extract and parse result
    response
        .get("payload")
        .ok_or_else(|| "invalid response format".to_string())
        .and_then(|p| serde_json::from_value::<UnitConversionResult>(p.clone())
            .map_err(|e| format!("parse error: {e}")))
}

#[tauri::command]
pub async fn fe_handbook_qa(
    app: AppHandle,
    question: String,
) -> Result<HandbookQAResult, String> {
    let req = json!({
        "action": "handbook_qa",
        "question": question,
    });
    let response = run_fe_engine(&app, req).await?;

    // Check for error response
    if response.get("event").and_then(|e| e.as_str()) == Some("error") {
        let msg = response
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown error");
        return Err(msg.to_string());
    }

    // Extract and parse result
    response
        .get("payload")
        .ok_or_else(|| "invalid response format".to_string())
        .and_then(|p| serde_json::from_value::<HandbookQAResult>(p.clone())
            .map_err(|e| format!("parse error: {e}")))
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

    #[test]
    fn records_banked_question_with_question_id_and_null_problem_text() {
        let mut conn = in_memory_conn();
        seed_fe_topics(&conn).expect("seed");

        record_attempt_and_update_mastery(
            &mut conn,
            1,
            "correct".to_string(),
            42,
            Some(123),
            None,
            Some("free-text that should be ignored".to_string()),
            Some("user".to_string()),
            Some("correct".to_string()),
            None,
        )
        .expect("record attempt");

        let (question_id, problem_text): (Option<i64>, Option<String>) = conn
            .query_row(
                "SELECT question_id, problem_text FROM attempts ORDER BY id DESC LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("attempt row");

        assert_eq!(question_id, Some(123));
        assert!(problem_text.is_none(), "problem_text should be NULL for banked questions");
    }

    #[test]
    fn updates_topic_mastery_for_correct_and_incorrect_results() {
        let mut conn = in_memory_conn();
        seed_fe_topics(&conn).expect("seed");

        record_attempt_and_update_mastery(
            &mut conn,
            1,
            "correct".to_string(),
            30,
            Some(1),
            None,
            None,
            Some("user".to_string()),
            Some("correct".to_string()),
            None,
        )
        .expect("first attempt");

        let (interval_correct, repetition_correct): (f64, i64) = conn
            .query_row(
                "SELECT sm2_interval, sm2_repetition FROM topic_mastery WHERE topic_id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("mastery after correct");
        assert!(interval_correct >= 1.0);
        assert_eq!(repetition_correct, 1);

        record_attempt_and_update_mastery(
            &mut conn,
            1,
            "incorrect".to_string(),
            20,
            Some(2),
            None,
            None,
            Some("user".to_string()),
            Some("correct".to_string()),
            None,
        )
        .expect("second attempt");

        let (interval_incorrect, repetition_incorrect): (f64, i64) = conn
            .query_row(
                "SELECT sm2_interval, sm2_repetition FROM topic_mastery WHERE topic_id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("mastery after incorrect");
        assert_eq!(interval_incorrect, 1.0);
        assert_eq!(repetition_incorrect, 0);
    }

    #[test]
    fn migrates_legacy_schema_to_current_version() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        conn.execute_batch(
            "CREATE TABLE topics (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                subcategory TEXT,
                description TEXT
            );
            CREATE TABLE attempts (
                id INTEGER PRIMARY KEY,
                topic_id INTEGER REFERENCES topics(id),
                timestamp TEXT NOT NULL,
                result TEXT,
                time_taken_seconds INTEGER,
                difficulty TEXT,
                problem_text TEXT,
                my_answer TEXT,
                correct_answer TEXT,
                explanation TEXT
            );
            CREATE TABLE sessions (
                id INTEGER PRIMARY KEY,
                session_type TEXT,
                topics_covered TEXT,
                started_at TEXT,
                completed_at TEXT,
                total_questions INTEGER,
                correct INTEGER,
                score_percent REAL
            );
            PRAGMA user_version = 0;",
        )
        .expect("legacy schema");

        ensure_schema(&conn).expect("migration");

        let user_version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("user_version");
        assert_eq!(user_version, FE_SCHEMA_VERSION);

        let attempts_question_id_cols: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('attempts') WHERE name = 'question_id'",
                [],
                |row| row.get(0),
            )
            .expect("attempts question_id column check");
        assert_eq!(attempts_question_id_cols, 1);

        let sessions_timer_cols: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('sessions') WHERE name IN ('remaining_seconds','break_taken','last_tick_at')",
                [],
                |row| row.get(0),
            )
            .expect("sessions timer column check");
        assert_eq!(sessions_timer_cols, 3);

        for table in ["questions", "question_tags", "session_questions", "topic_mastery", "question_reports"] {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    params![table],
                    |row| row.get(0),
                )
                .expect("table existence check");
            assert_eq!(count, 1, "table {table} should exist after migration");
        }
    }

    #[test]
    fn ensure_schema_is_idempotent_for_current_schema() {
        let conn = Connection::open_in_memory().expect("in-memory db");

        ensure_schema(&conn).expect("first ensure");
        ensure_schema(&conn).expect("second ensure");

        let user_version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("user_version");
        assert_eq!(user_version, FE_SCHEMA_VERSION);

        let question_id_cols: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('attempts') WHERE name = 'question_id'",
                [],
                |row| row.get(0),
            )
            .expect("attempts question_id count");
        assert_eq!(question_id_cols, 1);

        let break_taken_cols: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('sessions') WHERE name = 'break_taken'",
                [],
                |row| row.get(0),
            )
            .expect("sessions break_taken count");
        assert_eq!(break_taken_cols, 1);
    }
}
