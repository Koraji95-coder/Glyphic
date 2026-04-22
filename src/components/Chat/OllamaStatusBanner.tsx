import { useCallback, useEffect, useRef, useState } from 'react';
import { commands } from '../../lib/tauri/commands';

const POLL_MS = 30_000;

export function OllamaStatusBanner() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const cfg = await commands.aiGetConfig();
      const providerLower = (cfg.provider ?? '').toLowerCase();
      setProvider(providerLower);
      // Only probe connectivity when on Ollama.
      if (providerLower === 'ollama') {
        const ok = await commands.aiCheckConnection();
        setConnected(ok);
      } else {
        setConnected(true);
      }
    } catch {
      setConnected(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkNow();
    intervalRef.current = setInterval(checkNow, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkNow]);

  // Hide when on any non-Ollama provider, or when connected/unknown.
  if (provider !== 'ollama') return null;
  if (connected === true || connected === null) return null;

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
        Ollama is not running. Install from{' '}
        <a
          href="https://ollama.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--warning)', textDecoration: 'underline' }}
        >
          ollama.com
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
