import { useCallback, useEffect, useRef, useState } from 'react';
import { commands } from '../../lib/tauri/commands';

const POLL_MS = 30_000;

export function OllamaStatusBanner() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [endpoint, setEndpoint] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [modelInstalled, setModelInstalled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const cfg = await commands.aiGetConfig();
      const providerLower = (cfg.provider ?? '').toLowerCase();
      setProvider(providerLower);
      setEndpoint(cfg.ollama?.endpoint ?? '');
      setModel(cfg.ollama?.model ?? '');
      // Only probe connectivity when on Ollama.
      if (providerLower === 'ollama') {
        const ok = await commands.aiCheckConnection();
        setConnected(ok);
        if (ok) {
          try {
            const installed = await commands.aiListModels();
            // A model is considered installed if any installed name starts with
            // the configured base name (handles `llama3.1` matching `llama3.1:8b`).
            const base = (cfg.ollama?.model ?? '').toLowerCase();
            setModelInstalled(installed.some((m) => m.toLowerCase().startsWith(base)));
          } catch {
            setModelInstalled(null);
          }
        }
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
