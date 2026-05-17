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
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-5 py-2 text-xs text-amber-300">
      <span className="flex-1">
        OCR is unavailable -- screenshot text won't be searchable. Install{' '}
        <span className="font-mono text-amber-200">tesseract</span> on your system.
      </span>

      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setShow(false);
        }}
        className="rounded-md px-2.5 py-1 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/15"
      >
        Dismiss
      </button>
    </div>
  );
}