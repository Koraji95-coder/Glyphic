use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

// ── Database path ─────────────────────────────────────────────────────────────

fn flashcard_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app_data_dir: {e}"))?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("failed to create app_data_dir: {e}"))?;
    Ok(data_dir.join("glyphic.db"))
}

// ── Schema ────────────────────────────────────────────────────────────────────

fn ensure_flashcard_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS flashcard_reviews (
            id            INTEGER PRIMARY KEY,
            card_id       TEXT    NOT NULL,
            note_path     TEXT    NOT NULL,
            question      TEXT    NOT NULL,
            answer        TEXT    NOT NULL,
            rating        TEXT    CHECK(rating IN ('again','good','easy')),
            reviewed_at   TEXT    NOT NULL,
            due_at        TEXT    NOT NULL,
            interval_days INTEGER DEFAULT 1
        );",
    )
}

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct FlashcardReview {
    pub id:            i64,
    pub card_id:       String,
    pub note_path:     String,
    pub question:      String,
    pub answer:        String,
    pub rating:        String,
    pub reviewed_at:   String,
    pub due_at:        String,
    pub interval_days: i64,
}

#[derive(Serialize, Deserialize)]
pub struct FlashcardStats {
    pub total_cards:   i64,
    pub due_today:     i64,
    pub due_this_week: i64,
    pub mastered:      i64,
}

// ── Helper ────────────────────────────────────────────────────────────────────

fn open_conn(app: &AppHandle) -> Result<Connection, String> {
    let path = flashcard_db_path(app)?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    ensure_flashcard_schema(&conn).map_err(|e| e.to_string())?;
    Ok(conn)
}

/// SM-2 lite interval multipliers.
const SM2_GOOD_MULTIPLIER: f64 = 2.5;
const SM2_EASY_MULTIPLIER: f64 = 4.0;

/// Simple SM-2 lite: compute new interval and due date from the current best
/// interval for this card plus the new rating.
fn compute_due(rating: &str, current_interval: i64) -> (i64, String) {
    let new_interval = match rating {
        "again" => 1,
        "good"  => ((current_interval as f64) * SM2_GOOD_MULTIPLIER).ceil() as i64,
        "easy"  => ((current_interval as f64) * SM2_EASY_MULTIPLIER).ceil() as i64,
        _       => 1,
    };
    let new_interval = new_interval.max(1);
    let due = chrono::Utc::now() + chrono::Duration::days(new_interval);
    (new_interval, due.to_rfc3339())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Record a flashcard review rating and compute the next due date via SM-2 lite.
#[tauri::command]
pub async fn record_flashcard_review(
    app: AppHandle,
    card_id: String,
    note_path: String,
    question: String,
    answer: String,
    rating: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let now = chrono::Utc::now().to_rfc3339();

        // Look up the most recent interval for this card to feed into SM-2.
        let current_interval: i64 = conn
            .query_row(
                "SELECT interval_days FROM flashcard_reviews \
                 WHERE card_id = ?1 ORDER BY reviewed_at DESC LIMIT 1",
                params![card_id],
                |row| row.get(0),
            )
            .unwrap_or(1);

        let (new_interval, due_at) = compute_due(&rating, current_interval);

        conn.execute(
            "INSERT INTO flashcard_reviews \
             (card_id, note_path, question, answer, rating, reviewed_at, due_at, interval_days) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![card_id, note_path, question, answer, rating, now, due_at, new_interval],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Return flashcard reviews that are due (due_at <= now).
/// Optionally filter by note_path. Returns at most `limit` rows (default 50).
#[tauri::command]
pub async fn get_due_flashcards(
    app: AppHandle,
    note_path: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<FlashcardReview>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let now = chrono::Utc::now().to_rfc3339();
        let limit = limit.unwrap_or(50) as i64;

        // For each card_id, keep only the most recent review, then filter by due_at.
        let sql_with_path = "SELECT r.id, r.card_id, r.note_path, r.question, r.answer, r.rating, \
                r.reviewed_at, r.due_at, r.interval_days \
         FROM flashcard_reviews r \
         INNER JOIN ( \
             SELECT card_id, MAX(reviewed_at) AS latest \
             FROM flashcard_reviews \
             GROUP BY card_id \
         ) latest ON r.card_id = latest.card_id AND r.reviewed_at = latest.latest \
         WHERE r.due_at <= ?1 AND r.note_path = ?2 \
         ORDER BY r.due_at ASC \
         LIMIT ?3";

        let sql_all = "SELECT r.id, r.card_id, r.note_path, r.question, r.answer, r.rating, \
                r.reviewed_at, r.due_at, r.interval_days \
         FROM flashcard_reviews r \
         INNER JOIN ( \
             SELECT card_id, MAX(reviewed_at) AS latest \
             FROM flashcard_reviews \
             GROUP BY card_id \
         ) latest ON r.card_id = latest.card_id AND r.reviewed_at = latest.latest \
         WHERE r.due_at <= ?1 \
         ORDER BY r.due_at ASC \
         LIMIT ?2";

        let map_row = |row: &rusqlite::Row<'_>| {
            Ok(FlashcardReview {
                id:            row.get(0)?,
                card_id:       row.get(1)?,
                note_path:     row.get(2)?,
                question:      row.get(3)?,
                answer:        row.get(4)?,
                rating:        row.get(5)?,
                reviewed_at:   row.get(6)?,
                due_at:        row.get(7)?,
                interval_days: row.get(8)?,
            })
        };

        let rows = if let Some(ref np) = note_path {
            let mut stmt = conn.prepare(sql_with_path).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![now, np, limit], map_row).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        } else {
            let mut stmt = conn.prepare(sql_all).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![now, limit], map_row).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        };

        Ok(rows)
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Return aggregate flashcard statistics.
#[tauri::command]
pub async fn get_flashcard_stats(app: AppHandle) -> Result<FlashcardStats, String> {
    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&app)?;
        let now = chrono::Utc::now().to_rfc3339();
        let week_later = (chrono::Utc::now() + chrono::Duration::days(7)).to_rfc3339();

        // Unique card count = distinct card_ids ever reviewed.
        let total_cards: i64 = conn
            .query_row(
                "SELECT COUNT(DISTINCT card_id) FROM flashcard_reviews",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        // Due today = distinct cards whose latest review has due_at <= now.
        let due_today: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ( \
                     SELECT card_id FROM flashcard_reviews r \
                     INNER JOIN ( \
                         SELECT card_id, MAX(reviewed_at) AS latest FROM flashcard_reviews GROUP BY card_id \
                     ) lat ON r.card_id = lat.card_id AND r.reviewed_at = lat.latest \
                     WHERE r.due_at <= ?1 \
                 )",
                params![now],
                |r| r.get(0),
            )
            .unwrap_or(0);

        // Due this week = distinct cards due within 7 days.
        let due_this_week: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ( \
                     SELECT card_id FROM flashcard_reviews r \
                     INNER JOIN ( \
                         SELECT card_id, MAX(reviewed_at) AS latest FROM flashcard_reviews GROUP BY card_id \
                     ) lat ON r.card_id = lat.card_id AND r.reviewed_at = lat.latest \
                     WHERE r.due_at <= ?1 \
                 )",
                params![week_later],
                |r| r.get(0),
            )
            .unwrap_or(0);

        // Mastered = cards with interval_days >= 21 on their latest review.
        let mastered: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ( \
                     SELECT card_id FROM flashcard_reviews r \
                     INNER JOIN ( \
                         SELECT card_id, MAX(reviewed_at) AS latest FROM flashcard_reviews GROUP BY card_id \
                     ) lat ON r.card_id = lat.card_id AND r.reviewed_at = lat.latest \
                     WHERE r.interval_days >= 21 \
                 )",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        Ok(FlashcardStats { total_cards, due_today, due_this_week, mastered })
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}
