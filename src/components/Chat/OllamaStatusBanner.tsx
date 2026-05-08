import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';

const POLL_MS = 30_000;

export function OllamaStatusBanner() {
  // Read all AI status from the shared chatStore — avoids duplicate Ollama calls
  // that ChatPanel already triggers via refreshAiStatus() when the panel opens.
  const refreshAiStatus = useChatStore((s) => s.refreshAiStatus);
  const provider = useChatStore((s) => s.aiProvider);
  const endpoint = useChatStore((s) => s.aiEndpoint);
  const model = useChatStore((s) => s.aiOllamaModel);
  const connected = useChatStore((s) => s.isConnected);
  const modelInstalled = useChatStore((s) => s.aiModelInstalled);

  const [checking, setChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const checkNow = useCallback(async () => {
    if (!mountedRef.current) return;
    setChecking(true);
    try {
      await refreshAiStatus();
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, [refreshAiStatus]);

  useEffect(() => {
    mountedRef.current = true;
    intervalRef.current = setInterval(checkNow, POLL_MS);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkNow]);

  if (provider !== 'ollama') return null;

  // Disconnected — warning banner.
  if (connected === false) {
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
          Ollama is not running ({endpoint || 'http://localhost:11434'}). Install from{' '}
          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--warning)', textDecoration: 'underline' }}
          >
            ollama.com/download
          </a>
          , then start it.
        </span>
        <button
          type="button"
          onClick={checkNow}
          disabled={checking}
          className="px-2 py-0.5 rounded shrink-0 text-xs"
          style={{
            background: 'transparent',
            border: '1px solid var(--warning)',
            color: 'var(--warning)',
            cursor: checking ? 'not-allowed' : 'pointer',
            opacity: checking ? 0.5 : 1,
          }}
        >
          {checking ? 'Checking…' : 'Retry'}
        </button>
      </div>
    );
  }

  // Connected but the configured model isn't pulled yet — actionable hint.
  if (connected === true && modelInstalled === false && model) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 px-4 py-2 text-xs shrink-0"
        style={{
          backgroundColor: 'rgba(124, 109, 240, 0.08)',
          borderBottom: '1px solid rgba(124, 109, 240, 0.2)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          Ollama is running, but model <strong style={{ color: 'var(--accent)' }}>{model}</strong> isn't installed. Pull
          it from Settings → AI.
        </span>
        <button
          type="button"
          onClick={checkNow}
          disabled={checking}
          className="px-2 py-0.5 rounded shrink-0 text-xs"
          style={{
            background: 'transparent',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            cursor: checking ? 'not-allowed' : 'pointer',
            opacity: checking ? 0.5 : 1,
          }}
        >
          {checking ? 'Checking…' : 'Recheck'}
        </button>
      </div>
    );
  }

  // Connected and model is installed — silent (don't add chrome).
  return null;
}
