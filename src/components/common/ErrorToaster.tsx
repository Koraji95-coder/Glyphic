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
      className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-[min(92vw,380px)] flex-col gap-3"
    >
      {visible.map((item) => (
        <div
          key={item.id}
          role="status"
          className="rounded-3xl border bg-zinc-900/95 backdrop-blur-2xl px-5 py-4 shadow-2xl border-red-500/30 text-white"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-red-400">
            {item.context}
          </div>
          <div className="mt-1 text-sm leading-tight">{item.message}</div>
        </div>
      ))}
    </div>
  );
}