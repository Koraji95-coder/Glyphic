import { useEffect, useState } from 'react';
import { commands } from '../../lib/tauri/commands';

const DISMISS_KEY = 'ocr-prompt-dismissed';

export function OcrBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    commands
      .ocrAvailable()
      .then((available) => {
        if (!available) setShow(true);
      })
      .catch(() => {
        // Not running in Tauri (dev browser) — silently skip
      });
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm shrink-0 bg-amber-500/10 border-b border-amber-500/20 text-amber-300">
      <span className="flex-1">
        OCR is unavailable — screenshot text won't be searchable. Install{' '}
        <span className="font-mono text-amber-200">tesseract</span> on your system.
      </span>

      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setShow(false);
        }}
        className="px-3 py-1 text-xs font-medium rounded-2xl hover:bg-amber-500/20 transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}