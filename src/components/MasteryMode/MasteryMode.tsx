import { listen } from '@tauri-apps/api/event';
import { FC, Suspense, useCallback, useEffect, useState } from 'react';
import { commands } from '../../lib/tauri/commands';
import { KpiPanel } from './KpiPanel';
import { TopicCard } from './TopicCard';
import { RecentAttempts } from './RecentAttempts';
import type {
  MasteryLevelDto,
  StudyAttemptDto,
  TopicRelationshipCountsDto,
} from '../../types/mastery.types';
import { useMasteryStore } from '../../stores/masteryStore';

/**
 * MasteryMode — Full-screen learning dashboard
 *
 * Main container for mastery visualization
 * Loads data from SQLite and renders grid of topic cards
 * Includes KPI panel, recent attempts, and learning path visualization
 */

const MasteryModePlaceholder: FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
    <p className="text-lg font-semibold text-(--text-secondary)">
      Learning Path Visualization
    </p>
    <p className="text-sm text-(--text-tertiary) mt-2">
      D3.js dependency graph coming soon
    </p>
  </div>
);

const mapMasteryLevel = (
  row: MasteryLevelDto
): ReturnType<typeof useMasteryStore.getState>['masteryHistory'][number] => ({
  topic: row.topic,
  masteryLevel: row.mastery_level,
  lower95: row.lower_95,
  upper95: row.upper_95,
  attemptCount: row.attempt_count,
  lastStudied: row.last_studied,
  noteId: row.note_id,
  batchId: row.batch_id,
});

const mapStudyAttempt = (
  row: StudyAttemptDto
): ReturnType<typeof useMasteryStore.getState>['recentAttempts'][number] => ({
  id: row.id,
  noteId: row.note_id,
  topic: row.topic,
  question: row.question,
  studentResponse: row.student_response ?? '',
  score: row.score ?? 0,
  isCorrect: row.is_correct ?? false,
  timeToSolutionMs: row.time_to_solution_ms ?? 0,
  misconceptionsDetected: row.misconceptions_detected,
  createdAt: row.created_at,
  aiFeedback: row.ai_feedback,
  confidence: row.confidence,
});

export const MasteryMode: FC = () => {
  const [relationshipCounts, setRelationshipCounts] = useState<
    Record<string, { prerequisiteCount: number; dependentCount: number }>
  >({});

  const {
    masteryHistory,
    recentAttempts,
    filterByStatus,
    sortBy,
    viewMode,
    isLoading,
    error,
    selectedTopicId,
    setFilterByStatus,
    setSortBy,
    setViewMode,
    setMasteryHistory,
    setRecentAttempts,
    setLoading,
    setError,
    selectTopic,
    getFilteredTopics,
    getSortedTopics,
    getTopicStats,
  } = useMasteryStore();

  const mergeRelationshipCounts = useCallback((rows: TopicRelationshipCountsDto[]) => {
    if (rows.length === 0) {
      return;
    }

    const updates = rows.reduce<
      Record<string, { prerequisiteCount: number; dependentCount: number }>
    >((acc, row) => {
      acc[row.topic] = {
        prerequisiteCount: row.prerequisite_count,
        dependentCount: row.dependent_count,
      };
      return acc;
    }, {});

    setRelationshipCounts((prev) => ({ ...prev, ...updates }));
  }, []);

  // Load mastery data from SQLite on component mount
  useEffect(() => {
    let cancelled = false;

    const loadMasteryData = async () => {
      try {
        setLoading(true);
        const [masteryRows, attemptRows] = await Promise.all([
          commands.getMasteryHistory(),
          commands.getRecentAttempts(100),
        ]);

        if (cancelled) {
          return;
        }

        setMasteryHistory(masteryRows.map(mapMasteryLevel));
        setRecentAttempts(attemptRows.map(mapStudyAttempt));

        const topics = masteryRows.map((row) => row.topic);
        const relationshipRows = await commands.getTopicRelationshipCounts(topics);
        if (!cancelled) {
          mergeRelationshipCounts(relationshipRows);
        }

        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to load mastery data: ${errorMessage}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMasteryData();

    return () => {
      cancelled = true;
    };
  }, [setMasteryHistory, setRecentAttempts, setLoading, setError, mergeRelationshipCounts]);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlistenFn = await listen<{ topics?: string[] }>('mastery_updated', async (event) => {
          const topics = event.payload?.topics ?? [];
          if (topics.length === 0) {
            return;
          }

          const updatedRows = await commands.getMasteryByTopics(topics);
          const updatedTopics = updatedRows.map(mapMasteryLevel);
          const updatedByTopic = new Map(updatedTopics.map((topic) => [topic.topic, topic]));

          const relationshipRows = await commands.getTopicRelationshipCounts(topics);
          mergeRelationshipCounts(relationshipRows);

          const current = useMasteryStore.getState().masteryHistory;
          const merged = current.map((topic) => updatedByTopic.get(topic.topic) ?? topic);
          for (const topic of updatedTopics) {
            if (!current.some((currentTopic) => currentTopic.topic === topic.topic)) {
              merged.push(topic);
            }
          }

          setMasteryHistory(merged);
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to subscribe to mastery updates: ${errorMessage}`);
      }
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [setMasteryHistory, setError, mergeRelationshipCounts]);

  const filteredTopics = getFilteredTopics();
  const sortedTopics = getSortedTopics(filteredTopics);
  const stats = getTopicStats();

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-(--accent-struggle) mb-2">
            ⚠️ Error loading mastery data
          </p>
          <p className="text-sm text-(--text-tertiary)">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-linear-to-b from-(--bg-app) to-(--bg-editor)">
      {/* Header */}
      <div className="px-8 py-6 border-b border-(--border-subtle)">
        <h1 className="text-2xl font-semibold text-(--text-primary)">
          Learning Dashboard
        </h1>
        <p className="text-sm text-(--text-secondary) mt-1">
          Track your mastery progress across topics
        </p>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-8">
          {/* KPI Panel */}
          <Suspense fallback={<div className="h-32 bg-(--bg-card) rounded-lg animate-pulse" />}>
            <KpiPanel
              totalTopics={stats.total}
              averageMastery={stats.averageMastery}
              masteredCount={stats.mastered}
              reviewCount={stats.review}
              struggleCount={stats.struggle}
              onTrackCount={Math.floor(stats.total * 0.6)}
              aheadCount={Math.floor(stats.total * 0.2)}
              atRiskCount={Math.ceil(stats.total * 0.2)}
            />
          </Suspense>

          {/* Toolbar */}
          <div className="flex items-center gap-4 pb-4">
            {/* Filter */}
            <select
              value={filterByStatus}
              onChange={(e) => setFilterByStatus(e.target.value as any)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium
                border border-(--border)
                bg-(--bg-input) text-(--text-primary)
                hover:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)
                cursor-pointer
              `}
            >
              <option value="all">All Topics</option>
              <option value="mastered">Mastered Only</option>
              <option value="review">Review Only</option>
              <option value="struggle">Struggle Only</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium
                border border-(--border)
                bg-(--bg-input) text-(--text-primary)
                hover:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)
                cursor-pointer
              `}
            >
              <option value="mastery">Sort by Mastery</option>
              <option value="recent">Sort by Recent</option>
              <option value="name">Sort by Name</option>
            </select>

            {/* View Mode (Grid/List toggle) */}
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium
                border border-(--border)
                bg-(--bg-input) text-(--text-primary)
                hover:border-(--accent) hover:bg-(--bg-elevated)
                transition-all duration-150
                cursor-pointer
              `}
            >
              {viewMode === 'grid' ? '📊 Grid' : '📝 List'}
            </button>

            {/* Stats */}
            <div className="ml-auto text-sm text-(--text-secondary)">
              Showing {sortedTopics.length} of {stats.total} topics
            </div>
          </div>

          {/* Content Grid (Topics + Visualization) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Topic Cards Grid */}
            <div className="lg:col-span-2">
              {sortedTopics.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-(--text-tertiary)">
                    No topics found matching your filters
                  </p>
                </div>
              ) : (
                <div
                  className={`grid gap-4 ${
                    viewMode === 'grid'
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1'
                  }`}
                >
                  {sortedTopics.map((topic) => (
                    <TopicCard
                      key={topic.topic}
                      topicId={topic.topic}
                      topicName={topic.topic}
                      masteryLevel={topic.masteryLevel}
                      lower95={topic.lower95}
                      upper95={topic.upper95}
                      recentAttempts={recentAttempts.filter(
                        (a) => a.topic === topic.topic
                      )}
                      prerequisiteCount={relationshipCounts[topic.topic]?.prerequisiteCount ?? 0}
                      dependentCount={relationshipCounts[topic.topic]?.dependentCount ?? 0}
                      lastStudied={topic.lastStudied}
                      onSelect={(id) => selectTopic(id)}
                      onStudyNow={(id) => {
                        console.log('TODO: Navigate to study for topic', id);
                      }}
                      onViewPath={(id) => {
                        console.log('TODO: Show learning path for topic', id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: Sidebar (Visualization + Recent Attempts) */}
            <div className="lg:col-span-1 space-y-6">
              {/* Learning Path Placeholder */}
              <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) overflow-hidden">
                <div className="p-6 border-b border-(--border-subtle)">
                  <h3 className="text-sm font-semibold text-(--text-primary)">
                    Learning Path
                  </h3>
                </div>
                <Suspense fallback={<div className="h-64 bg-(--bg-input) animate-pulse" />}>
                  <MasteryModePlaceholder />
                </Suspense>
              </div>

              {/* Recent Attempts */}
              <RecentAttempts
                attempts={recentAttempts}
                maxItems={5}
                onAttemptSelect={(id) => {
                  console.log('TODO: Show attempt details for', id);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

MasteryMode.displayName = 'MasteryMode';
