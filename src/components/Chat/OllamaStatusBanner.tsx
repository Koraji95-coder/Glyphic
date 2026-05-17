import { useCallback, useEffect, useRef, useState } from 'react';

import { useChatStore } from '../../stores/chatStore';

const POLL_MS = 30_000;

export function OllamaStatusBanner() {
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
    if (provider === 'ollama') {
      intervalRef.current = setInterval(checkNow, POLL_MS);
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkNow, provider]);

  if (provider !== 'ollama') return null;

  // Disconnected
  if (connected === false) {
    return (
      <div className="flex items-center justify-between gap-3 px-6 py-3 text-sm shrink-0 bg-amber-500/10 border-b border-amber-500/20 text-amber-300">
        <span className="text-zinc-300">
          Ollama is not running{' '}
          <span className="font-mono text-xs">({endpoint || 'http://localhost:11434'})</span>
        </span>
        <button
          onClick={checkNow}
          disabled={checking}
          className="px-4 py-1 text-xs font-medium bg-transparent border border-amber-400 text-amber-300 hover:bg-amber-500/10 rounded-md transition-colors disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Retry'}
        </button>
      </div>
    );
  }

  // Connected but model not installed
  if (connected === true && modelInstalled === false && model) {
    return (
      <div className="flex items-center justify-between gap-3 px-6 py-3 text-sm shrink-0 bg-blue-500/10 border-b border-violet-500/20 text-blue-300">
        <span>
          Model <span className="font-medium text-violet-200">{model}</span> is not installed
        </span>
        <button
          onClick={checkNow}
          disabled={checking}
          className="px-4 py-1 text-xs font-medium bg-transparent border border-violet-400 text-blue-300 hover:bg-blue-500/10 rounded-md transition-colors disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Recheck'}
        </button>
      </div>
    );
  }

  return null;
}