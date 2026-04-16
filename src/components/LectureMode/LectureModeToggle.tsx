import { Clock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLectureMode } from '../../hooks/useLectureMode';

export function LectureModeToggle() {
  const { lectureModeActive, lectureModeStartedAt, toggleLectureMode, getElapsedTime, getTimestamp } = useLectureMode();
  const [elapsed, setElapsed] = useState('00:00');
  const [startTime, setStartTime] = useState('');

  // Update timer every second when active
  useEffect(() => {
    if (!lectureModeActive) return;
    setStartTime(getTimestamp());
    const interval = setInterval(() => {
      setElapsed(getElapsedTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [lectureModeActive, getElapsedTime, getTimestamp]);

  if (!lectureModeActive) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 text-sm shrink-0"
      style={{
        backgroundColor: 'var(--accent-muted)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--accent)',
      }}
    >
      <div className="flex items-center gap-2">
        <Clock size={14} />
        <span className="font-medium">Lecture Mode active</span>
        <span style={{ color: 'var(--text-secondary)' }}>— started at {startTime}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono font-medium">{elapsed}</span>
        <button
          onClick={toggleLectureMode}
          className="p-0.5 rounded hover:bg-opacity-20 transition-colors"
          title="Stop Lecture Mode"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
