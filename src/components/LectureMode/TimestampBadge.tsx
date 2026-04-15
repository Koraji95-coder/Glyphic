import { useState } from 'react';

interface TimestampBadgeProps {
  elapsed: string;
  absolute: string;
}

export function TimestampBadge({ elapsed, absolute }: TimestampBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Parse elapsed time for tooltip
  const parts = elapsed.split(':');
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  const tooltipText = `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''} — ${absolute}`;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-mono select-none"
        contentEditable={false}
        style={{
          backgroundColor: 'var(--accent-muted)',
          color: 'var(--accent)',
          fontSize: '0.7rem',
          lineHeight: 1.2,
          verticalAlign: 'middle',
        }}
      >
        {elapsed}
      </span>
      {showTooltip && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-xs whitespace-nowrap z-50"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border)',
          }}
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}
