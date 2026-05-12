import { FC, useMemo } from 'react';
import { MasteryBar } from './MasteryBar';

/**
 * KpiPanel — High-level metrics dashboard
 *
 * Displays:
 * - Average mastery percentage with animated bar
 * - Counts by status (Mastered, Review, Struggle)
 * - Pacing status (On Track, Ahead, At Risk)
 */

interface KpiPanelProps {
  totalTopics: number;
  averageMastery: number;
  masteredCount: number;
  reviewCount: number;
  struggleCount: number;
  onTrackCount?: number;
  aheadCount?: number;
  atRiskCount?: number;
}

export const KpiPanel: FC<KpiPanelProps> = ({
  totalTopics,
  averageMastery,
  masteredCount,
  reviewCount,
  struggleCount,
  onTrackCount = 0,
  aheadCount = 0,
  atRiskCount = 0,
}) => {
  // Compute percentages
  const percentages = useMemo(() => {
    if (totalTopics === 0) return { mastered: 0, review: 0, struggle: 0 };
    return {
      mastered: (masteredCount / totalTopics) * 100,
      review: (reviewCount / totalTopics) * 100,
      struggle: (struggleCount / totalTopics) * 100,
    };
  }, [totalTopics, masteredCount, reviewCount, struggleCount]);

  const pacingTotal = onTrackCount + aheadCount + atRiskCount;
  const pacingPercentage = pacingTotal > 0 ? (onTrackCount / pacingTotal) * 100 : 0;

  return (
    <section
      className={`
        p-6 md:p-7 rounded-2xl border border-(--border-subtle)
        bg-linear-to-br from-(--bg-mastery-panel) via-(--bg-card) to-(--bg-card)
        shadow-lg
      `}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-(--text-primary)">
            Overall Progress
          </h2>
          <p className="text-xs text-(--text-tertiary) mt-1">
            Live snapshot of current mastery distribution
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-full border border-(--border-subtle) bg-(--bg-input) text-xs text-(--text-secondary)">
          {totalTopics} total topics
        </div>
      </div>

      {/* Main Grid: Left (Average Mastery) | Right (Counts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-7">
        {/* Left: Average Mastery */}
        <div>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-3xl font-bold text-(--accent-mastery)">
              {Math.round(averageMastery * 100)}%
            </span>
            <span className="text-sm text-(--text-secondary)">Average Mastery</span>
          </div>
          <MasteryBar
            topic="Overall"
            masteryLevel={averageMastery}
            lower95={averageMastery - 0.1} // Placeholder CI
            upper95={averageMastery + 0.1}
            compact={true}
          />
        </div>

        {/* Right: Status Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-(--bg-input) border border-(--border-subtle)">
            <span className="text-sm text-(--text-secondary)">Mastered</span>
            <span className="text-base font-semibold text-(--accent-mastery)">
              {masteredCount}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-(--bg-input) border border-(--border-subtle)">
            <span className="text-sm text-(--text-secondary)">Review</span>
            <span className="text-base font-semibold text-(--accent-review)">
              {reviewCount}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-(--bg-input) border border-(--border-subtle)">
            <span className="text-sm text-(--text-secondary)">Struggle</span>
            <span className="text-base font-semibold text-(--accent-struggle)">
              {struggleCount}
            </span>
          </div>
        </div>
      </div>

      {/* Status Visualization */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Mastered Bar */}
        <div className="flex flex-col gap-1">
          <div className="h-12 rounded-lg bg-(--bg-card) relative overflow-hidden">
            <div
              className="h-full rounded-lg bg-(--accent-mastery) transition-all duration-500"
              style={{ width: `${percentages.mastered}%` }}
            />
          </div>
          <span className="text-xs text-(--text-secondary)">
            {Math.round(percentages.mastered)}% Mastered
          </span>
        </div>

        {/* Review Bar */}
        <div className="flex flex-col gap-1">
          <div className="h-12 rounded-lg bg-(--bg-card) relative overflow-hidden">
            <div
              className="h-full rounded-lg bg-(--accent-review) transition-all duration-500"
              style={{ width: `${percentages.review}%` }}
            />
          </div>
          <span className="text-xs text-(--text-secondary)">
            {Math.round(percentages.review)}% Review
          </span>
        </div>

        {/* Struggle Bar */}
        <div className="flex flex-col gap-1">
          <div className="h-12 rounded-lg bg-(--bg-card) relative overflow-hidden">
            <div
              className="h-full rounded-lg bg-(--accent-struggle) transition-all duration-500"
              style={{ width: `${percentages.struggle}%` }}
            />
          </div>
          <span className="text-xs text-(--text-secondary)">
            {Math.round(percentages.struggle)}% Struggle
          </span>
        </div>
      </div>

      {/* Pacing Status */}
      {pacingTotal > 0 && (
        <div className="pt-6 border-t border-(--border-subtle)">
          <h3 className="text-xs font-semibold text-(--text-secondary) mb-3 uppercase tracking-wider">
            Learning Pace
          </h3>
          <div className="flex gap-2 text-xs mb-2">
            {onTrackCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-(--accent-mastery) bg-opacity-20 text-(--accent-mastery)">
                On Track: {onTrackCount}
              </span>
            )}
            {aheadCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-blue-500 bg-opacity-20 text-blue-400">
                Ahead: {aheadCount}
              </span>
            )}
            {atRiskCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-(--accent-struggle) bg-opacity-20 text-(--accent-struggle)">
                At Risk: {atRiskCount}
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-(--bg-card) overflow-hidden">
            <div
              className="h-full rounded-full bg-(--accent-mastery) transition-all duration-500"
              style={{ width: `${pacingPercentage}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
};

KpiPanel.displayName = 'KpiPanel';
