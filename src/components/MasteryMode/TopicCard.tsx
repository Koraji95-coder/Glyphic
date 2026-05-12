import { FC, useState } from 'react';
import { MasteryBar } from './MasteryBar';

/**
 * TopicCard — Card displaying single topic mastery state
 *
 * Shows:
 * - Topic name
 * - Mastery bar with status
 * - Recent attempt indicators
 * - Prerequisite/dependent counts
 * - Action buttons
 */

interface TopicCardProps {
  topicId: string;
  topicName: string;
  masteryLevel: number;
  lower95: number;
  upper95: number;
  recentAttempts: Array<{
    isCorrect: boolean;
    score: number;
  }>;
  prerequisiteCount: number;
  dependentCount: number;
  lastStudied?: string;
  onStudyNow?: (topicId: string) => void;
  onViewPath?: (topicId: string) => void;
  onSelect?: (topicId: string) => void;
}

export const TopicCard: FC<TopicCardProps> = ({
  topicId,
  topicName,
  masteryLevel,
  lower95,
  upper95,
  recentAttempts,
  prerequisiteCount,
  dependentCount,
  lastStudied,
  onStudyNow,
  onViewPath,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Format recent attempts as compact indicator
  const recentIndicator = recentAttempts.slice(0, 4).map((attempt, idx) => (
    <span
      key={idx}
      className={`inline-block w-2 h-2 rounded-full mx-0.5 ${
        attempt.isCorrect
          ? 'bg-(--accent-mastery)'
          : 'bg-(--accent-struggle)'
      }`}
    />
  ));

  const correctCount = recentAttempts.filter((a) => a.isCorrect).length;
  const totalCount = recentAttempts.length;

  return (
    <article
      className={`
        relative p-4 rounded-xl border border-(--border-subtle)
        bg-(--bg-card) hover:bg-(--bg-elevated)
        transition-all duration-200 cursor-pointer
        ${isHovered ? 'shadow-lg border-(--accent-dim) -translate-y-0.5' : 'shadow-sm'}
      `}
      onMouseEnter={() => {
        setIsHovered(true);
        onSelect?.(topicId);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-(--text-primary)">{topicName}</h3>
        {lastStudied && (
          <span className="text-xs text-(--text-tertiary)">
            {new Date(lastStudied).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Mastery Bar */}
      <div className="mb-3">
        <MasteryBar
          topic=""
          masteryLevel={masteryLevel}
          lower95={lower95}
          upper95={upper95}
          compact={false}
        />
      </div>

      {/* Recent Attempts Indicator */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-(--text-secondary)">Recent:</span>
          <div className="flex gap-1">{recentIndicator}</div>
          <span className="text-xs text-(--text-tertiary)">
            ({correctCount}/{totalCount} correct)
          </span>
        </div>
      )}

      {/* Context: Prerequisites & Dependents */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-(--bg-input) border border-(--border-subtle)">
          <span className="font-medium text-(--text-secondary)">
            {prerequisiteCount}
          </span>
          <span className="text-(--text-tertiary) ml-1">Prerequisites</span>
        </div>
        {dependentCount > 0 && (
          <div className="inline-flex items-center px-2.5 py-1 rounded-full border border-(--accent-struggle) text-(--accent-struggle)">
            <span className="font-medium">{dependentCount}</span>
            <span className="ml-1">Blocks</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t border-(--border-subtle)">
        <button
          onClick={() => onStudyNow?.(topicId)}
          className={`
            flex-1 py-1.5 px-3 rounded-md text-xs font-medium
            bg-(--accent) text-white
            hover:bg-(--accent-hover)
            transition-colors duration-150
            cursor-pointer
          `}
        >
          Practice
        </button>
        <button
          onClick={() => onViewPath?.(topicId)}
          className={`
            flex-1 py-1.5 px-3 rounded-md text-xs font-medium
            border border-(--border)
            text-(--text-secondary) hover:text-(--text-primary)
            bg-transparent hover:bg-(--bg-input)
            transition-colors duration-150
            cursor-pointer
          `}
        >
          Path
        </button>
      </div>
    </article>
  );
};

TopicCard.displayName = 'TopicCard';
