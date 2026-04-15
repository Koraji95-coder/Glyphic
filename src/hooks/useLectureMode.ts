import { useEditorStore } from '../stores/editorStore';
import { format } from 'date-fns';

export function useLectureMode() {
  const { lectureModeActive, lectureModeStartedAt, toggleLectureMode } = useEditorStore();

  const getElapsedTime = (): string => {
    if (!lectureModeStartedAt) return '00:00';
    const elapsed = Math.floor((Date.now() - lectureModeStartedAt.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getTimestamp = (): string => {
    return format(new Date(), 'h:mm a');
  };

  return { lectureModeActive, lectureModeStartedAt, toggleLectureMode, getElapsedTime, getTimestamp };
}
