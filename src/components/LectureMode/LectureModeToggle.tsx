import { Clock, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useLectureMode } from '../../hooks/useLectureMode';

export function LectureModeToggle() {
  const { lectureModeActive, toggleLectureMode, getElapsedTime, getTimestamp } = useLectureMode();
  const [elapsed, setElapsed] = useState('00:00');
  const [startTime, setStartTime] = useState('');

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
    <div className="flex items-center justify-between px-5 py-2.5 text-sm shrink-0 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300">
      <div className="flex items-center gap-2">
        <Clock size={16} />
        <span className="font-medium">Lecture Mode active</span>
        <span className="text-emerald-400/80">— started at {startTime}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono font-medium text-emerald-200">{elapsed}</span>
        <button
          type="button"
          onClick={toggleLectureMode}
          className="p-1 hover:bg-emerald-500/20 rounded-md transition-colors"
          title="Stop Lecture Mode"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}