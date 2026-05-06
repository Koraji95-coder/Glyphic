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
    )
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
