import { useEffect } from 'react';
import { events } from '../lib/tauri/events';
import { commands } from '../lib/tauri/commands';
import { useCaptureStore } from '../stores/captureStore';

export function useCapture() {
  const { isCapturing, captureMode, setCapturing } = useCaptureStore();

  useEffect(() => {
    const unlisten = events.onScreenshotCaptured(() => {
      setCapturing(false);
      // The editor will handle insertion via its own listener
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setCapturing]);

  const triggerCapture = async () => {
    setCapturing(true);
    await commands.startCapture();
  };

  return { isCapturing, captureMode, triggerCapture };
}
