/// mastery_commands.rs — MasteryMode dashboard data queries
///
/// Provides Tauri commands for fetching mastery data from SQLite:
///   • `get_mastery_history` — All topics with latest posteriors
///   • `get_recent_attempts` — Latest practice attempts (paginated)
///   • `get_mastery_by_topics` — Re-fetch for specific topics (real-time updates)
///   • `get_topic_prerequisites` — Prerequisite graph for learning path

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::DbState;

/// Represents a single topic's mastery state (from mastery_history table)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasteryLevel {
    pub id: String,
    pub topic: String,
    pub mastery_level: f64,           // 0.0 to 1.0 (posterior mean)
    pub lower_95: f64,                // confidence interval lower bound
    pub upper_95: f64,                // confidence interval upper bound
    pub attempt_count: i32,           // how many attempts for this topic
    pub last_studied: String,         // ISO 8601 timestamp
    pub note_id: Option<String>,      // which note (topic) this is from
    pub batch_id: Option<String>,     // which update batch this came from
}

/// Represents a single practice attempt (from study_attempts table)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyAttempt {
    pub id: String,
    pub note_id: String,
    pub topic: String,               // derived from question context
    pub question: String,
    pub student_response: Option<String>,
    pub score: Option<f64>,          // 0.0 to 1.0
    pub is_correct: Option<bool>,
    pub time_to_solution_ms: Option<i32>,
    pub misconceptions_detected: Vec<String>,  // ["Sign error", "Integration limits", ...]
    pub created_at: String,          // ISO 8601 timestamp
    pub ai_feedback: Option<String>,
    pub confidence: Option<f64>,     // AI's confidence in its grading
}

/// Relationship counts for a topic card context row
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicRelationshipCounts {
    pub topic: String,
    pub prerequisite_count: i32,
    pub dependent_count: i32,
}

/// Fetch all topics with their latest mastery estimates
/// Returns the most recent mastery_history entry for each topic
#[tauri::command]
pub async fn get_mastery_history(
    db_state: State<'_, DbState>,
) -> Result<Vec<MasteryLevel>, String> {
    let conn = db_state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock database: {e}"))?;

    let mut stmt = conn
        .prepare(
            "
            SELECT
                id,
                topic,
                mastery_level,
                confidence_lower_95,
                confidence_upper_95,
                attempt_count,
                created_at,
                note_id,
                batch_id
            FROM mastery_history
            WHERE batch_id = (
                SELECT MAX(batch_id) FROM mastery_history AS mh2
                WHERE mh2.topic = mastery_history.topic
            )
            ORDER BY topic ASC
            ",
        )
        .map_err(|e| format!("Failed to prepare statement: {e}"))?;

    let mastery_iter = stmt
        .query_map([], |row| {
            Ok(MasteryLevel {
                id: row.get(0)?,
                topic: row.get(1)?,
                mastery_level: row.get(2)?,
                lower_95: row.get(3).unwrap_or(0.0),
                upper_95: row.get(4).unwrap_or(1.0),
                attempt_count: row.get(5).unwrap_or(0),
                last_studied: row.get(6)?,
                note_id: row.get(7).ok(),
                batch_id: row.get(8).ok(),
            })
        })
        .map_err(|e| format!("Failed to query mastery history: {e}"))?;

    let mut results = Vec::new();
    for item in mastery_iter {
        results.push(item.map_err(|e| format!("Failed to read row: {e}"))?);
    }

    Ok(results)
}

/// Fetch recent study attempts (paginated)
/// Useful for the "Recent Attempts" sidebar widget
#[tauri::command]
pub async fn get_recent_attempts(
    limit: Option<i32>,
    db_state: State<'_, DbState>,
) -> Result<Vec<StudyAttempt>, String> {
    let conn = db_state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock database: {e}"))?;

    let limit_val = limit.unwrap_or(50);

    let mut stmt = conn
        .prepare(
            "
            SELECT
                id,
                note_id,
                question,
                student_response,
                score,
                is_correct,
                time_to_solution_ms,
                misconceptions_detected,
                created_at,
                ai_feedback,
                confidence
            FROM study_attempts
            ORDER BY created_at DESC
            LIMIT ?1
            ",
        )
        .map_err(|e| format!("Failed to prepare statement: {e}"))?;

    let attempt_iter = stmt
        .query_map([limit_val], |row| {
            let misconceptions_json: Option<String> = row.get(7).ok();
            let misconceptions: Vec<String> = misconceptions_json
                .and_then(|json| serde_json::from_str(&json).ok())
                .unwrap_or_default();

            Ok(StudyAttempt {
                id: row.get(0)?,
                note_id: row.get(1)?,
                topic: "Unknown".to_string(), // TODO: extract from question or add topic column
                question: row.get(2)?,
                student_response: row.get(3).ok(),
                score: row.get(4).ok(),
                is_correct: row.get(5).ok(),
                time_to_solution_ms: row.get(6).ok(),
                misconceptions_detected: misconceptions,
                created_at: row.get(8)?,
                ai_feedback: row.get(9).ok(),
                confidence: row.get(10).ok(),
            })
        })
        .map_err(|e| format!("Failed to query study attempts: {e}"))?;

    let mut results = Vec::new();
    for item in attempt_iter {
        results.push(item.map_err(|e| format!("Failed to read row: {e}"))?);
    }

    Ok(results)
}

/// Fetch mastery for specific topics (used for real-time updates)
/// Called after Prism grades a batch of problems
#[tauri::command]
pub async fn get_mastery_by_topics(
    topics: Vec<String>,
    db_state: State<'_, DbState>,
) -> Result<Vec<MasteryLevel>, String> {
    let conn = db_state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock database: {e}"))?;

    if topics.is_empty() {
        return Ok(Vec::new());
    }

    // Build placeholders for topics list
    let placeholders = vec!["?"; topics.len()].join(",");
    let query = format!(
        "
        SELECT
            id,
            topic,
            mastery_level,
            confidence_lower_95,
            confidence_upper_95,
            attempt_count,
            created_at,
            note_id,
            batch_id
        FROM mastery_history
        WHERE topic IN ({})
        AND batch_id = (
            SELECT MAX(batch_id) FROM mastery_history AS mh2
            WHERE mh2.topic = mastery_history.topic
        )
        ORDER BY topic ASC
        ",
        placeholders
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare statement: {e}"))?;

    let params: Vec<&dyn rusqlite::ToSql> = topics.iter().map(|t| t as &dyn rusqlite::ToSql).collect();

    let mastery_iter = stmt
        .query_map(params.as_slice(), |row| {
            Ok(MasteryLevel {
                id: row.get(0)?,
                topic: row.get(1)?,
                mastery_level: row.get(2)?,
                lower_95: row.get(3).unwrap_or(0.0),
                upper_95: row.get(4).unwrap_or(1.0),
                attempt_count: row.get(5).unwrap_or(0),
                last_studied: row.get(6)?,
                note_id: row.get(7).ok(),
                batch_id: row.get(8).ok(),
            })
        })
        .map_err(|e| format!("Failed to query mastery for topics: {e}"))?;

    let mut results = Vec::new();
    for item in mastery_iter {
        results.push(item.map_err(|e| format!("Failed to read row: {e}"))?);
    }

    Ok(results)
}

/// Fetch prerequisite topics for a given topic.
///
/// Current source of truth is note backlinks:
/// topic(note A) -> note B means A depends on B.
#[tauri::command]
pub async fn get_topic_prerequisites(
    topic: String,
    db_state: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    let conn = db_state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock database: {e}"))?;

    let mut stmt = conn
        .prepare(
            "
            SELECT n.title
            FROM backlinks b
            JOIN notes n ON n.id = b.target_note_id
            WHERE b.source_note_id = (
                SELECT mh.note_id
                FROM mastery_history mh
                WHERE mh.topic = ?1
                ORDER BY mh.created_at DESC
                LIMIT 1
            )
            ORDER BY n.title ASC
            ",
        )
        .map_err(|e| format!("Failed to prepare statement: {e}"))?;

    let prereq_iter = stmt
        .query_map([topic], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query prerequisites: {e}"))?;

    let mut prerequisites = Vec::new();
    for item in prereq_iter {
        prerequisites.push(item.map_err(|e| format!("Failed to read row: {e}"))?);
    }

    Ok(prerequisites)
}

/// Fetch prerequisite/dependent counts for a batch of topics.
///
/// Used by MasteryMode topic cards to avoid one command call per row.
#[tauri::command]
pub async fn get_topic_relationship_counts(
    topics: Vec<String>,
    db_state: State<'_, DbState>,
) -> Result<Vec<TopicRelationshipCounts>, String> {
    if topics.is_empty() {
        return Ok(Vec::new());
    }

    let conn = db_state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock database: {e}"))?;

    let placeholders = vec!["?"; topics.len()].join(",");
    let query = format!(
        "
        WITH latest AS (
            SELECT mh.topic, mh.note_id
            FROM mastery_history mh
            JOIN (
                SELECT topic, MAX(created_at) AS max_created_at
                FROM mastery_history
                WHERE topic IN ({})
                GROUP BY topic
            ) grouped
                ON grouped.topic = mh.topic
                AND grouped.max_created_at = mh.created_at
            GROUP BY mh.topic
        )
        SELECT
            latest.topic,
            COALESCE((
                SELECT COUNT(DISTINCT b.target_note_id)
                FROM backlinks b
                WHERE b.source_note_id = latest.note_id
            ), 0) AS prerequisite_count,
            COALESCE((
                SELECT COUNT(DISTINCT b.source_note_id)
                FROM backlinks b
                WHERE b.target_note_id = latest.note_id
            ), 0) AS dependent_count
        FROM latest
        ORDER BY latest.topic ASC
        ",
        placeholders
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare statement: {e}"))?;

    let params: Vec<&dyn rusqlite::ToSql> = topics
        .iter()
        .map(|topic| topic as &dyn rusqlite::ToSql)
        .collect();

    let rel_iter = stmt
        .query_map(params.as_slice(), |row| {
            Ok(TopicRelationshipCounts {
                topic: row.get(0)?,
                prerequisite_count: row.get(1).unwrap_or(0),
                dependent_count: row.get(2).unwrap_or(0),
            })
        })
        .map_err(|e| format!("Failed to query relationship counts: {e}"))?;

    let mut results = Vec::new();
    for item in rel_iter {
        results.push(item.map_err(|e| format!("Failed to read row: {e}"))?);
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mastery_level_serialize() {
        let mastery = MasteryLevel {
            id: "test-1".to_string(),
            topic: "Calculus: Integration".to_string(),
            mastery_level: 0.68,
            lower_95: 0.45,
            upper_95: 0.85,
            attempt_count: 15,
            last_studied: "2026-05-11T14:30:00Z".to_string(),
            note_id: Some("note-123".to_string()),
            batch_id: Some("batch-1".to_string()),
        };

        let json = serde_json::to_string(&mastery).unwrap();
        assert!(json.contains("\"topic\":\"Calculus: Integration\""));
        assert!(json.contains("\"mastery_level\":0.68"));
    }

    #[test]
    fn test_study_attempt_deserialize() {
        let json = r#"{
            "id": "attempt-1",
            "note_id": "note-123",
            "topic": "Calculus: Integration",
            "question": "Integrate x^2 cos(x) dx",
            "student_response": "x^2 sin(x) + 2x cos(x) - 2 sin(x) + C",
            "score": 1.0,
            "is_correct": true,
            "time_to_solution_ms": 154000,
            "misconceptions_detected": [],
            "created_at": "2026-05-11T14:30:00Z",
            "ai_feedback": "Correct! Well done.",
            "confidence": 0.95
        }"#;

        let attempt: StudyAttempt = serde_json::from_str(json).unwrap();
        assert_eq!(attempt.topic, "Calculus: Integration");
        assert_eq!(attempt.score, Some(1.0));
        assert!(attempt.is_correct.unwrap());
    }
}
