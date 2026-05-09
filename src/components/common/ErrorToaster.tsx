import { useEffect, useMemo, useState } from 'react';
import { type AppErrorEventDetail, onAppError } from '../../lib/errorReporter';

interface ToastItem extends AppErrorEventDetail {
  expiresAt: number;
}

const TOAST_LIFETIME_MS = 4500;

export function ErrorToaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return onAppError((detail) => {
      setItems((prev) => {
        const next = prev.slice(-2);
        return [...next, { ...detail, expiresAt: Date.now() + TOAST_LIFETIME_MS }];
      });
    });
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const now = Date.now();
    const nextExpiry = Math.min(...items.map((item) => item.expiresAt));
    const delay = Math.max(0, nextExpiry - now + 8);

    const timer = window.setTimeout(() => {
      const cutoff = Date.now();
      setItems((prev) => prev.filter((item) => item.expiresAt > cutoff));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [items]);

  const visible = useMemo(() => items.slice(-3), [items]);

  if (visible.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed top-4 right-4 z-9999 flex w-[min(92vw,380px)] flex-col gap-2"
    >
      {visible.map((item) => (
        <div
          key={item.id}
          role="status"
          className="rounded-md border px-3 py-2 shadow-lg"
          style={{
            background: 'color-mix(in oklab, var(--bg-card) 92%, #ffb3b3 8%)',
            borderColor: 'color-mix(in oklab, var(--border) 70%, #ef4444 30%)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {item.context}
          </div>
          <div className="mt-1 text-sm">{item.message}</div>
        </div>
      ))}
    </div>
  );
}
