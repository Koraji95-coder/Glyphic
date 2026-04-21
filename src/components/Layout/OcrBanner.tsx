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
        // Not running in Tauri (dev browser) — silently skip.
      });
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm shrink-0"
      style={{
        backgroundColor: 'rgba(224, 160, 80, 0.08)',
        color: 'var(--warning)',
        borderBottom: '1px solid rgba(224, 160, 80, 0.2)',
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>
        OCR is unavailable — screenshot text won&apos;t be searchable. Install tesseract:{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>brew install tesseract</code> (macOS),{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>apt install tesseract-ocr</code>{' '}
        (Linux),{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>choco install tesseract</code>{' '}
        (Windows).
      </span>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setShow(false);
        }}
        aria-label="Dismiss OCR install banner"
        className="px-2 py-0.5 rounded shrink-0"
        style={{ background: 'transparent', border: 'none', color: 'var(--warning)', cursor: 'pointer' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(224, 160, 80, 0.12)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        ✕
      </button>
    </div>
  );
}
