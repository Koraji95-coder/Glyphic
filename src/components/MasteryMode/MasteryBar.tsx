import { FC, useMemo } from 'react';

/**
 * MasteryBar — Visual mastery indicator with credible interval
 *
 * Shows:
 * - Posterior mean (filled bar)
 * - 95% credible interval (markers)
 * - Status badge (Mastered, Review, Struggle)
 * - Interactive tooltip on hover
 */

interface MasteryBarProps {
  topic: string;
  masteryLevel: number; // 0.0-1.0 (posterior mean)
  lower95: number; // Credible interval lower
  upper95: number; // Credible interval upper
  thresholdMastery?: number; // Default 0.7
  compact?: boolean;
  onHover?: (show: boolean) => void;
}

type MasteryStatus = 'mastered' | 'review' | 'struggle';

export const MasteryBar: FC<MasteryBarProps> = ({
  topic,
  masteryLevel,
  lower95,
  upper95,
  thresholdMastery = 0.7,
  compact = false,
  onHover,
}) => {
  // Compute status and colors
  const status: MasteryStatus = useMemo(() => {
    if (masteryLevel >= thresholdMastery) return 'mastered';
    if (masteryLevel >= 0.5) return 'review';
    return 'struggle';
  }, [masteryLevel, thresholdMastery]);

  const statusColors = {
    mastered: 'bg-[var(--accent-mastery)] text-[var(--accent-mastery)]',
    review: 'bg-[var(--accent-review)] text-[var(--accent-review)]',
    struggle: 'bg-[var(--accent-struggle)] text-[var(--accent-struggle)]',
  };

  const statusBadgeText = {
    mastered: 'Mastered',
    review: 'Review',
    struggle: 'Struggle',
  };

  // Clamp percentages to 0-100
  const meanPercent = Math.max(0, Math.min(100, masteryLevel * 100));
  const lowerPercent = Math.max(0, Math.min(100, lower95 * 100));
  const upperPercent = Math.max(0, Math.min(100, upper95 * 100));

  const containerHeight = compact ? 'h-4' : 'h-6';
  const labelSize = compact ? 'text-xs' : 'text-sm';
  const labelMargin = compact ? 'mb-1' : 'mb-2';

  return (
    <div
      className="w-full"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {/* Label */}
      {!compact && (
        <div className={`flex items-center justify-between ${labelMargin}`}>
          <span className="text-xs font-medium text-[var(--text-secondary)]">{topic}</span>
          <span className={`text-xs font-semibold ${statusColors[status].split(' ')[1]}`}>
            {Math.round(masteryLevel * 100)}%
          </span>
        </div>
      )}

      {/* Bar container */}
      <div className={`relative w-full bg-[var(--bg-card)] rounded-full overflow-hidden ${containerHeight}`}>
        {/* Background track (full range 0-1) */}
        <div className="absolute inset-0 bg-[var(--bg-input)]" />

        {/* Credible interval background (shaded region) */}
        <div
          className={`absolute h-full ${statusColors[status].split(' ')[0]} opacity-20`}
          style={{
            left: `${lowerPercent}%`,
            right: `${100 - upperPercent}%`,
          }}
        />

        {/* Filled bar (posterior mean) */}
        <div
          className={`h-full rounded-full ${statusColors[status].split(' ')[0]} transition-all duration-300 ease-out`}
          style={{ width: `${meanPercent}%` }}
        />

        {/* CI tick markers (95% interval bounds) */}
        <div
          className="absolute top-0 h-full w-px bg-current opacity-60"
          style={{ left: `${lowerPercent}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-current opacity-60"
          style={{ left: `${upperPercent}%` }}
        />
      </div>

      {/* Status badge and interval (below bar) */}
      {!compact && (
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs font-medium text-[var(--text-secondary)]`}>
            {statusBadgeText[status]}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            [{Math.round(lower95 * 100)}–{Math.round(upper95 * 100)}]
          </span>
        </div>
      )}
    </div>
  );
};

MasteryBar.displayName = 'MasteryBar';
