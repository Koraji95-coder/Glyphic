export interface ReportErrorOptions {
  context?: string;
  message?: string;
  error?: unknown;
}

export interface AppErrorEventDetail {
  id: string;
  context: string;
  message: string;
  details?: string;
  timestamp: number;
}

const APP_ERROR_EVENT = 'glyphic:error';

function toErrorString(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function reportError({ context, message, error }: ReportErrorOptions): void {
  const safeContext = context ?? 'Unexpected error';
  const safeMessage = message ?? (error ? toErrorString(error) : 'Unknown error');

  if (error !== undefined) {
    console.error(`[${safeContext}] ${safeMessage}`, error);
  } else {
    console.error(`[${safeContext}] ${safeMessage}`);
  }

  if (typeof window === 'undefined') return;

  const detail: AppErrorEventDetail = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    context: safeContext,
    message: safeMessage,
    details: error ? toErrorString(error) : undefined,
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent<AppErrorEventDetail>(APP_ERROR_EVENT, { detail }));
}

export function onAppError(listener: (detail: AppErrorEventDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const custom = event as CustomEvent<AppErrorEventDetail>;
    listener(custom.detail);
  };

  window.addEventListener(APP_ERROR_EVENT, handler);
  return () => window.removeEventListener(APP_ERROR_EVENT, handler);
}
