use chrono::{Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const PLAN_ID: i64 = 1;
const DEFAULT_EXAM_NAME: &str = "FE Electrical and Computer";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyPlan {
    pub id: i64,
    pub exam_name: String,
    pub target_exam_date: Option<String>,
    pub daily_minutes: i64,
    pub weekly_minutes: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyPlanSession {
    pub id: i64,
    pub plan_id: i64,
    pub planned_date: String,
    pub topic_id: i64,
    pub topic_name: String,
    pub duration_minutes: i64,
    pub question_target: i64,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub total_questions: i64,
    pub correct: i64,
    pub reflection: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyPlanOverview {
    pub plan: Option<StudyPlan>,
    pub today_session: Option<StudyPlanSession>,
    pub upcoming_sessions: Vec<StudyPlanSession>,
    pub completed_this_week: i64,
    pub planned_minutes_this_week: i64,
    pub completed_minutes_this_week: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertStudyPlanInput {
    pub target_exam_date: Option<String>,
    pub daily_minutes: i64,
    pub weekly_minutes: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CompleteStudyPlanSessionInput {
    pub session_id: i64,
    pub total_questions: i64,
    pub correct: i64,
    pub reflection: Option<String>,
}

fn study_plan_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app_data_dir: {e}"))?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("failed to create app_data_dir: {e}"))?;
    Ok(data_dir.join("glyphic.db"))
}

fn open_conn(app: &AppHandle) -> Result<Connection, String> {
    let path = study_plan_db_path(app)?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    crate::commands::fe_commands::ensure_schema(&conn).map_err(|e| e.to_string())?;
    crate::commands::fe_commands::seed_fe_topics(&conn).map_err(|e| e.to_string())?;
    ensure_study_plan_schema(&conn).map_err(|e| e.to_string())?;
    Ok(conn)
}

fn ensure_study_plan_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS study_plans (
            id               INTEGER PRIMARY KEY CHECK (id = 1),
            exam_name        TEXT NOT NULL DEFAULT 'FE Electrical and Computer',
            target_exam_date TEXT,
            daily_minutes    INTEGER NOT NULL DEFAULT 45,
            weekly_minutes   INTEGER NOT NULL DEFAULT 240,
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS study_plan_sessions (
            id               INTEGER PRIMARY KEY,
            plan_id          INTEGER NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
            planned_date     TEXT NOT NULL,
            topic_id         INTEGER NOT NULL DEFAULT 0,
            topic_name       TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            question_target  INTEGER NOT NULL,
            status           TEXT NOT NULL CHECK(status IN ('planned','in_progress','completed','skipped')),
            started_at       TEXT,
            completed_at     TEXT,
            total_questions  INTEGER NOT NULL DEFAULT 0,
            correct          INTEGER NOT NULL DEFAULT 0,
            reflection       TEXT NOT NULL DEFAULT '',
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_study_plan_sessions_date
            ON study_plan_sessions(planned_date);
        CREATE INDEX IF NOT EXISTS idx_study_plan_sessions_status
            ON study_plan_sessions(status);",
    )
}

fn now_string() -> String {
    Utc::now().to_rfc3339()
}

fn today_string() -> String {
    Utc::now().date_naive().format("%Y-%m-%d").to_string()
}

fn week_start_string() -> String {
    (Utc::now().date_naive() - Duration::days(6))
        .format("%Y-%m-%d")
        .to_string()
}

fn normalize_target_date(value: Option<String>) -> Option<String> {
    value.and_then(|date| {
        let trimmed = date.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn row_to_plan(row: &Row<'_>) -> rusqlite::Result<StudyPlan> {
    Ok(StudyPlan {
        id: row.get(0)?,
        exam_name: row.get(1)?,
        target_exam_date: row.get(2)?,
        daily_minutes: row.get(3)?,
        weekly_minutes: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn row_to_session(row: &Row<'_>) -> rusqlite::Result<StudyPlanSession> {
    Ok(StudyPlanSession {
        id: row.get(0)?,
        plan_id: row.get(1)?,
        planned_date: row.get(2)?,
        topic_id: row.get(3)?,
        topic_name: row.get(4)?,
        duration_minutes: row.get(5)?,
        question_target: row.get(6)?,
        status: row.get(7)?,
        started_at: row.get(8)?,
        completed_at: row.get(9)?,
        total_questions: row.get(10)?,
        correct: row.get(11)?,
        reflection: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn select_plan_by_id(conn: &Connection, plan_id: i64) -> rusqlite::Result<StudyPlan> {
    conn.query_row(
        "SELECT id, exam_name, target_exam_date, daily_minutes, weekly_minutes, created_at, updated_at
         FROM study_plans
         WHERE id = ?1",
        params![plan_id],
        row_to_plan,
    )
}

fn get_active_plan_in_conn(conn: &Connection) -> rusqlite::Result<Option<StudyPlan>> {
    conn.query_row(
        "SELECT id, exam_name, target_exam_date, daily_minutes, weekly_minutes, created_at, updated_at
         FROM study_plans
         WHERE id = ?1",
        params![PLAN_ID],
        row_to_plan,
    )
    .optional()
}

fn upsert_plan_in_conn(
    conn: &Connection,
    input: UpsertStudyPlanInput,
) -> rusqlite::Result<StudyPlan> {
    let daily_minutes = input.daily_minutes.clamp(15, 240);
    let weekly_minutes = input.weekly_minutes.clamp(60, 2400);
    let target_exam_date = normalize_target_date(input.target_exam_date);
    let now = now_string();

    conn.execute(
        "INSERT INTO study_plans (
             id, exam_name, target_exam_date, daily_minutes, weekly_minutes, created_at, updated_at
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
         ON CONFLICT(id) DO UPDATE SET
             target_exam_date = excluded.target_exam_date,
             daily_minutes = excluded.daily_minutes,
             weekly_minutes = excluded.weekly_minutes,
             updated_at = excluded.updated_at",
        params![
            PLAN_ID,
            DEFAULT_EXAM_NAME,
            target_exam_date,
            daily_minutes,
            weekly_minutes,
            now
        ],
    )?;

    select_plan_by_id(conn, PLAN_ID)
}

fn select_topic_for_session(conn: &Connection) -> rusqlite::Result<(i64, String)> {
    let weak_topic = conn
        .query_row(
            "SELECT a.topic_id, t.name
             FROM attempts a
             JOIN topics t ON t.id = a.topic_id
             GROUP BY a.topic_id
             HAVING COUNT(*) >= 5
                AND (SUM(CASE WHEN a.result = 'correct' THEN 1.0 ELSE 0.0 END) / COUNT(*)) < 0.70
             ORDER BY
                (SUM(CASE WHEN a.result = 'correct' THEN 1.0 ELSE 0.0 END) / COUNT(*)) ASC,
                COUNT(*) DESC,
                t.id ASC
             LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;

    if let Some(topic) = weak_topic {
        return Ok(topic);
    }

    conn.query_row(
        "SELECT t.id, t.name
         FROM topics t
         LEFT JOIN attempts a ON a.topic_id = t.id
         GROUP BY t.id
         ORDER BY COUNT(a.id) ASC, t.id ASC
         LIMIT 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map(|topic| topic.unwrap_or((0, "FE Electrical Review".to_string())))
}

fn select_session_by_id(conn: &Connection, session_id: i64) -> rusqlite::Result<StudyPlanSession> {
    conn.query_row(
        "SELECT id, plan_id, planned_date, topic_id, topic_name, duration_minutes, question_target,
                status, started_at, completed_at, total_questions, correct, reflection, created_at, updated_at
         FROM study_plan_sessions
         WHERE id = ?1",
        params![session_id],
        row_to_session,
    )
}

fn select_today_session(
    conn: &Connection,
    plan_id: i64,
) -> rusqlite::Result<Option<StudyPlanSession>> {
    let today = today_string();
    conn.query_row(
        "SELECT id, plan_id, planned_date, topic_id, topic_name, duration_minutes, question_target,
                status, started_at, completed_at, total_questions, correct, reflection, created_at, updated_at
         FROM study_plan_sessions
         WHERE plan_id = ?1 AND planned_date = ?2
         ORDER BY id DESC
         LIMIT 1",
        params![plan_id, today],
        row_to_session,
    )
    .optional()
}

fn generate_today_session_in_conn(
    conn: &Connection,
    plan_id: i64,
) -> rusqlite::Result<StudyPlanSession> {
    if let Some(session) = select_today_session(conn, plan_id)? {
        if session.status != "skipped" {
            return Ok(session);
        }
    }

    let plan = select_plan_by_id(conn, plan_id)?;
    let (topic_id, topic_name) = select_topic_for_session(conn)?;
    let now = now_string();
    let planned_date = today_string();
    let question_target = (plan.daily_minutes / 3).clamp(5, 80);

    conn.execute(
        "INSERT INTO study_plan_sessions (
             plan_id, planned_date, topic_id, topic_name, duration_minutes, question_target,
             status, created_at, updated_at
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'planned', ?7, ?7)",
        params![
            plan_id,
            planned_date,
            topic_id,
            topic_name,
            plan.daily_minutes,
            question_target,
            now
        ],
    )?;

    select_session_by_id(conn, conn.last_insert_rowid())
}

fn start_session_in_conn(conn: &Connection, session_id: i64) -> rusqlite::Result<StudyPlanSession> {
    let now = now_string();
    conn.execute(
        "UPDATE study_plan_sessions
         SET status = 'in_progress',
             started_at = COALESCE(started_at, ?2),
             updated_at = ?2
         WHERE id = ?1 AND status IN ('planned', 'in_progress')",
        params![session_id, now],
    )?;
    select_session_by_id(conn, session_id)
}

fn complete_session_in_conn(
    conn: &Connection,
    input: CompleteStudyPlanSessionInput,
) -> rusqlite::Result<StudyPlanSession> {
    let total_questions = input.total_questions.max(0);
    let correct = input.correct.clamp(0, total_questions);
    let reflection = input.reflection.unwrap_or_default().trim().to_string();
    let now = now_string();

    conn.execute(
        "UPDATE study_plan_sessions
         SET status = 'completed',
             completed_at = ?2,
             total_questions = ?3,
             correct = ?4,
             reflection = ?5,
             updated_at = ?2
         WHERE id = ?1",
        params![input.session_id, now, total_questions, correct, reflection],
    )?;

    select_session_by_id(conn, input.session_id)
}

fn skip_session_in_conn(conn: &Connection, session_id: i64) -> rusqlite::Result<StudyPlanSession> {
    let now = now_string();
    conn.execute(
        "UPDATE study_plan_sessions
         SET status = 'skipped',
             completed_at = ?2,
             updated_at = ?2
         WHERE id = ?1 AND status IN ('planned', 'in_progress')",
        params![session_id, now],
    )?;
    select_session_by_id(conn, session_id)
}

fn get_overview_in_conn(conn: &Connection) -> rusqlite::Result<StudyPlanOverview> {
    let Some(plan) = get_active_plan_in_conn(conn)? else {
        return Ok(StudyPlanOverview {
            plan: None,
            today_session: None,
            upcoming_sessions: Vec::new(),
            completed_this_week: 0,
            planned_minutes_this_week: 0,
            completed_minutes_this_week: 0,
        });
    };

    let today_session = select_today_session(conn, plan.id)?;
    let today = today_string();
    let mut upcoming_stmt = conn.prepare(
        "SELECT id, plan_id, planned_date, topic_id, topic_name, duration_minutes, question_target,
                status, started_at, completed_at, total_questions, correct, reflection, created_at, updated_at
         FROM study_plan_sessions
         WHERE plan_id = ?1
           AND planned_date >= ?2
           AND status IN ('planned', 'in_progress')
         ORDER BY planned_date ASC, id ASC
         LIMIT 5",
    )?;
    let upcoming_sessions = upcoming_stmt
        .query_map(params![plan.id, today], row_to_session)?
        .collect::<Result<Vec<_>, _>>()?;

    let week_start = week_start_string();
    let (completed_this_week, planned_minutes_this_week, completed_minutes_this_week) = conn
        .query_row(
            "SELECT
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
                SUM(duration_minutes),
                SUM(CASE WHEN status = 'completed' THEN duration_minutes ELSE 0 END)
             FROM study_plan_sessions
             WHERE plan_id = ?1 AND planned_date >= ?2",
            params![plan.id, week_start],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>(0)?.unwrap_or(0),
                    row.get::<_, Option<i64>>(1)?.unwrap_or(0),
                    row.get::<_, Option<i64>>(2)?.unwrap_or(0),
                ))
            },
        )?;

    Ok(StudyPlanOverview {
        plan: Some(plan),
        today_session,
        upcoming_sessions,
        completed_this_week,
        planned_minutes_this_week,
        completed_minutes_this_week,
    })
}

#[tauri::command]
pub async fn get_active_study_plan(app: AppHandle) -> Result<Option<StudyPlan>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        get_active_plan_in_conn(&conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[tauri::command]
pub async fn upsert_study_plan(
    app: AppHandle,
    input: UpsertStudyPlanInput,
) -> Result<StudyPlan, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        upsert_plan_in_conn(&conn, input).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[tauri::command]
pub async fn get_study_plan_overview(app: AppHandle) -> Result<StudyPlanOverview, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        get_overview_in_conn(&conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[tauri::command]
pub async fn generate_today_study_session(app: AppHandle) -> Result<StudyPlanSession, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let plan = get_active_plan_in_conn(&conn)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "create a study plan before generating a session".to_string())?;
        generate_today_session_in_conn(&conn, plan.id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[tauri::command]
pub async fn start_study_plan_session(
    app: AppHandle,
    session_id: i64,
) -> Result<StudyPlanSession, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        start_session_in_conn(&conn, session_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[tauri::command]
pub async fn complete_study_plan_session(
    app: AppHandle,
    input: CompleteStudyPlanSessionInput,
) -> Result<StudyPlanSession, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        complete_session_in_conn(&conn, input).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[tauri::command]
pub async fn skip_study_plan_session(
    app: AppHandle,
    session_id: i64,
) -> Result<StudyPlanSession, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        skip_session_in_conn(&conn, session_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};

    fn in_memory_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        ensure_study_plan_schema(&conn).expect("schema");
        seed_test_topics(&conn).expect("topics");
        conn
    }

    fn seed_test_topics(conn: &Connection) -> rusqlite::Result<()> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                subcategory TEXT,
                description TEXT
            );
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY,
                topic_id INTEGER REFERENCES topics(id),
                timestamp TEXT NOT NULL,
                result TEXT,
                time_taken_seconds INTEGER,
                difficulty TEXT,
                problem_text TEXT,
                my_answer TEXT,
                correct_answer TEXT,
                explanation TEXT,
                question_id INTEGER
            );",
        )?;

        conn.execute(
            "INSERT INTO topics (id, name, category) VALUES (?1, ?2, ?3)",
            params![1, "DC Circuits", "Circuit Analysis"],
        )?;
        conn.execute(
            "INSERT INTO topics (id, name, category) VALUES (?1, ?2, ?3)",
            params![2, "AC Circuits", "Circuit Analysis"],
        )?;
        Ok(())
    }

    #[test]
    fn schema_creation_is_idempotent() {
        let conn = in_memory_conn();
        ensure_study_plan_schema(&conn).expect("second schema");

        let plan_tables: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('study_plans','study_plan_sessions')",
                [],
                |row| row.get(0),
            )
            .expect("table count");

        assert_eq!(plan_tables, 2);
    }

    #[test]
    fn generated_session_prefers_weak_topic() {
        let conn = in_memory_conn();
        let plan = upsert_plan_in_conn(
            &conn,
            UpsertStudyPlanInput {
                target_exam_date: Some("2026-08-01".to_string()),
                daily_minutes: 45,
                weekly_minutes: 240,
            },
        )
        .expect("plan");

        for result in [
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "correct",
        ] {
            conn.execute(
                "INSERT INTO attempts (topic_id, timestamp, result, time_taken_seconds) VALUES (2, '2026-05-17T00:00:00Z', ?1, 60)",
                params![result],
            )
            .expect("attempt");
        }

        let session = generate_today_session_in_conn(&conn, plan.id).expect("session");

        assert_eq!(session.topic_id, 2);
        assert_eq!(session.topic_name, "AC Circuits");
    }

    #[test]
    fn generated_session_falls_back_to_least_practiced_topic() {
        let conn = in_memory_conn();
        let plan = upsert_plan_in_conn(
            &conn,
            UpsertStudyPlanInput {
                target_exam_date: None,
                daily_minutes: 30,
                weekly_minutes: 180,
            },
        )
        .expect("plan");

        conn.execute(
            "INSERT INTO attempts (topic_id, timestamp, result, time_taken_seconds) VALUES (1, '2026-05-17T00:00:00Z', 'correct', 60)",
            [],
        )
        .expect("attempt");

        let session = generate_today_session_in_conn(&conn, plan.id).expect("session");

        assert_eq!(session.topic_id, 2);
        assert_eq!(session.topic_name, "AC Circuits");
    }

    #[test]
    fn completing_session_stores_counts_and_status() {
        let conn = in_memory_conn();
        let plan = upsert_plan_in_conn(
            &conn,
            UpsertStudyPlanInput {
                target_exam_date: None,
                daily_minutes: 30,
                weekly_minutes: 180,
            },
        )
        .expect("plan");
        let session = generate_today_session_in_conn(&conn, plan.id).expect("session");

        complete_session_in_conn(
            &conn,
            CompleteStudyPlanSessionInput {
                session_id: session.id,
                total_questions: 12,
                correct: 9,
                reflection: Some("Need more impedance practice.".to_string()),
            },
        )
        .expect("complete");

        let stored: (String, i64, i64, String) = conn
            .query_row(
                "SELECT status, total_questions, correct, reflection FROM study_plan_sessions WHERE id = ?1",
                params![session.id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("stored session");

        assert_eq!(stored.0, "completed");
        assert_eq!(stored.1, 12);
        assert_eq!(stored.2, 9);
        assert_eq!(stored.3, "Need more impedance practice.");
    }
}
