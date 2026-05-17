import { FC } from 'react';

/**
 * RecentAttempts — List of recent study attempts
 *
 * Shows:
 * - Topic name, question, result (correct/incorrect)
 * - Time to solution, score percentage
 * - Misconceptions detected (if any)
 * - Timestamp (relative)
 */

interface StudyAttempt {
  id: string;
  topic: string;
  question: string;
  score: number;
  isCorrect: boolean;
  timeToSolutionMs: number;
  misconceptionsDetected?: string[];
  createdAt: string;
  aiFeedback?: string;
}

interface RecentAttemptsProps {
  attempts: StudyAttempt[];
  maxItems?: number;
  onAttemptSelect?: (attemptId: string) => void;
}

const formatTime = (ms: number) => {
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`;
  }
  const minutes = Math.round(ms / 60000);
  return `${minutes}m`;
};

const formatRelativeTime = (isoString: string) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const RecentAttempts: FC<RecentAttemptsProps> = ({
  attempts,
  maxItems = 10,
  onAttemptSelect,
}) => {
  if (attempts.length === 0) {
    return (
      <section className="p-6 rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-sm">
        <h3 className="text-sm font-semibold text-(--text-secondary) mb-4">
          Recent Attempts
        </h3>
        <div className="text-center py-8">
          <p className="text-sm text-(--text-tertiary)">
            No attempts yet. Start studying to see your progress here.
          </p>
        </div>
      </section>
    );
  }

  const displayedAttempts = attempts.slice(0, maxItems);

  return (
    <section className="p-6 rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-(--text-primary)">
          Recent Attempts
        </h3>
        <span className="text-xs px-2 py-1 rounded-full bg-(--bg-input) text-(--text-secondary) border border-(--border-subtle)">
          {attempts.length}
        </span>
      </div>

      <h4 className="sr-only">
        Recent Attempts ({attempts.length})
      </h4>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {displayedAttempts.map((attempt) => (
          <button
            key={attempt.id}
            onClick={() => onAttemptSelect?.(attempt.id)}
            className={`
              w-full p-3 rounded-lg text-left
              border border-(--border-subtle)
              bg-(--bg-input) hover:bg-(--bg-elevated)
              transition-all duration-150 hover:border-(--accent-dim)
              cursor-pointer group
            `}
          >
            {/* Header: Topic + Status */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-(--text-secondary) group-hover:text-(--text-primary)">
                {attempt.topic}
              </span>
              <div className="flex items-center gap-2">
                <span className={`
                  inline-block w-2 h-2 rounded-full
                  ${attempt.isCorrect ? 'bg-(--accent-mastery)' : 'bg-(--accent-struggle)'}
                `} />
                <span className={`
                  text-xs font-medium
                  ${attempt.isCorrect ? 'text-(--accent-mastery)' : 'text-(--accent-struggle)'}
                `}>
                  {attempt.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </div>
            </div>

            {/* Question preview */}
            <p className="text-xs text-(--text-secondary) mb-2 line-clamp-2">
              {attempt.question}
            </p>

            {/* Footer: Metrics + Timestamp */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-3">
                <span className="text-(--text-tertiary)">
                  {Math.round(attempt.score * 100)}%
                </span>
                <span className="text-(--text-tertiary)">
                  {formatTime(attempt.timeToSolutionMs)}
                </span>
              </div>
              <span className="text-(--text-tertiary)">
                {formatRelativeTime(attempt.createdAt)}
              </span>
            </div>

            {/* Misconceptions if present */}
            {attempt.misconceptionsDetected && attempt.misconceptionsDetected.length > 0 && (
              <div className="mt-2 pt-2 border-t border-(--border-subtle)">
                <p className="text-xs font-medium text-(--accent-struggle) mb-1">
                  Misconceptions detected:
                </p>
                <div className="flex flex-wrap gap-1">
                  {attempt.misconceptionsDetected.slice(0, 3).map((misconception, idx) => (
                    <span
                      key={idx}
                      className={`
                        text-xs px-2 py-1 rounded
                        bg-(--accent-struggle) bg-opacity-10
                        text-(--accent-struggle)
                      `}
                    >
                      {misconception}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {attempts.length > maxItems && (
        <div className="mt-3 pt-3 border-t border-(--border-subtle) text-center">
          <button className="text-xs font-medium text-(--accent) hover:underline">
            View all attempts →
          </button>
        </div>
      )}
    </section>
  );
};

RecentAttempts.displayName = 'RecentAttempts';
