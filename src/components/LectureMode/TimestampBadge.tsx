import { useState } from 'react';

interface TimestampBadgeProps {
  elapsed: string;
  absolute: string;
}

export function TimestampBadge({ elapsed, absolute }: TimestampBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const parts = elapsed.split(':');
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  const tooltipText = `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''} — ${absolute}`;

  return (
    <span className="relative inline-flex items-center">
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-3xl text-xs font-mono select-none bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/40 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {elapsed}
      </span>

      {showTooltip && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-2xl text-xs whitespace-nowrap bg-zinc-900 border border-zinc-700 shadow-2xl z-50"
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}