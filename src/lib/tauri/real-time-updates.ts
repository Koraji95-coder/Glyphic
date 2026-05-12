/// real-time-updates.ts — Real-time Mastery Updates from Prism Agent
///
/// When Prism grades a batch of problems, it emits a Tauri event.
/// MasteryMode subscribes to this event and re-fetches the affected topics.
///
/// Implementation guide:

import { listen } from '@tauri-apps/api/event';

/**
 * Event emitted by Prism agent after grading problems
 * Triggers re-fetch of mastery data for the affected topics
 */
export interface MasteryUpdatedEvent {
  batch_id: string;
  topics: string[];
  timestamp: string;
}

/**
 * Setup real-time mastery updates in MasteryMode component
 * Call this once when the component mounts
 */
export async function setupMasteryUpdatesListener(
  onUpdate: (topics: string[]) => Promise<void>
): Promise<() => Promise<void>> {
  try {
    // Subscribe to the 'mastery_updated' event from Tauri
    const unlisten = await listen<MasteryUpdatedEvent>('mastery_updated', async (event) => {
      console.log('[MasteryMode] Mastery update received:', event.payload);

      try {
        // Re-fetch mastery data for the updated topics
        await onUpdate(event.payload.topics);
      } catch (err) {
        console.error('[MasteryMode] Error updating mastery data:', err);
      }
    });

    // Return unsubscribe function for cleanup
    return unlisten;
  } catch (err) {
    console.error('[MasteryMode] Failed to setup mastery updates listener:', err);
    // Return no-op function if listener setup fails
    return () => Promise.resolve();
  }
}

/**
 * Example integration in MasteryMode component:
 *
 * export const MasteryMode: FC = () => {
 *   const { setMasteryHistory, getMasteryByTopics } = useMasteryStore();
 *
 *   // Setup real-time updates
 *   useEffect(() => {
 *     const handleMasteryUpdate = async (topics: string[]) => {
 *       const updated = await commands.getMasteryByTopics(topics);
 *       setMasteryHistory(updated);
 *     };
 *
 *     setupMasteryUpdatesListener(handleMasteryUpdate).then((unsubscribe) => {
 *       return () => {
 *         // Cleanup on unmount
 *         unsubscribe();
 *       };
 *     });
 *   }, [setMasteryHistory]);
 *
 *   // ... rest of component
 * };
 */

/**
 * Emit mastery update event from Rust (Prism agent integration)
 *
 * In src-tauri/src/commands/prism.rs or wherever grading happens:
 *
 * use tauri::Manager;
 *
 * #[tauri::command]
 * async fn grade_problems(
 *   problems: Vec<ProblemResponse>,
 *   app: tauri::AppHandle,
 * ) -> Result<Vec<GradeResult>, String> {
 *   // ... grade the problems
 *
 *   // Get the topics that were graded
 *   let topics: Vec<String> = problems
 *     .iter()
 *     .map(|p| p.topic.clone())
 *     .collect::<std::collections::HashSet<_>>()
 *     .into_iter()
 *     .collect();
 *
 *   // Update mastery_history table with new posteriors
 *   // (implementation depends on mastery_engine results)
 *
 *   // Emit event to notify UI
 *   let _ = app.emit_all(
 *     "mastery_updated",
 *     MasteryUpdatedEvent {
 *       batch_id: uuid::Uuid::new_v4().to_string(),
 *       topics,
 *       timestamp: chrono::Utc::now().to_rfc3339(),
 *     },
 *   );
 *
 *   Ok(results)
 * }
 */
