import { listen } from '@tauri-apps/api/event';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { useChatStore } from '../../stores/chatStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { AiConfig } from '../../types/ai';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface PullProgressPayload {
  model: string;
  status: string;
  completed?: number;
  total?: number;
}

interface ModelPullState {
  status: string;
  completed?: number;
  total?: number;
}

const RECOMMENDED_MODELS = [
  'llama3.1:8b',
  'qwen2.5:7b',
  'qwen2.5-coder:7b',
  'deepseek-r1:7b',
  'mathstral:7b',
  'llava:7b',
];

type TestResult =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; models: string[] }
  | { kind: 'connected_no_listing' }
  | { kind: 'fail'; error: string };

interface AiSettingsPanelProps {
  onClose: () => void;
  embedded?: boolean;
}

export function AiSettingsPanel({ onClose, embedded = false }: AiSettingsPanelProps) {
  const { updateConfig } = useChatStore();
  const vaultPath = useVaultStore((s) => s.vaultPath);

  const [config, setConfig] = useState<AiConfig>({
    provider: 'ollama',
    ollama: { endpoint: 'http://localhost:11434', model: 'llama3.1:8b' },
    openai: { api_key: '', model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1' },
    model_routing: {
      chat: 'llama3.1:8b',
      summarize: 'llama3.1:8b',
      flashcards: 'qwen2.5:7b',
      explain: 'qwen2.5:7b',
      vision: 'llava:7b',
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>({ kind: 'idle' });
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Pull model state
  const [pullInput, setPullInput] = useState('');
  const [pullingModels, setPullingModels] = useState<Set<string>>(new Set());
  const [pullProgress, setPullProgress] = useState<Record<string, ModelPullState>>({});
  const [pullErrors, setPullErrors] = useState<Record<string, string>>({});
  const unlistenPullRef = useRef<(() => void) | null>(null);

  const isOllama = config.provider === 'ollama';

  const refreshModels = useCallback(async () => {
    if (!isOllama) return;
    setLoadingModels(true);
    setModelsError(null);
    try {
      const list = await commands.aiListModels();
      setModels(list);
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [isOllama]);

  useEffect(() => {
    commands.aiGetConfig().then(setConfig).catch(console.error);
  }, []);

  useEffect(() => {
    if (isOllama) void refreshModels();
  }, [refreshModels, isOllama]);

  // Listen for Ollama pull progress
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;

    listen<PullProgressPayload>('ollama-pull-progress', (event) => {
      const { model, status, completed, total } = event.payload;
      setPullProgress((prev) => ({
        ...prev,
        [model]: { status, completed, total },
      }));
      if (status === 'success') {
        setPullingModels((prev) => {
          const next = new Set(prev);
          next.delete(model);
          return next;
        });
        setTimeout(() => {
          setPullProgress((prev) => {
            const next = { ...prev };
            delete next[model];
            return next;
          });
        }, 1500);
        void refreshModels();
      }
    }).then((fn) => {
      if (!cancelled) unlistenPullRef.current = fn;
    });

    return () => {
      cancelled = true;
      unlistenPullRef.current?.();
    };
  }, [refreshModels]);

  const handlePull = async (modelName: string) => {
    const name = modelName.trim();
    if (!name || pullingModels.has(name)) return;
    setPullInput('');
    setPullingModels((prev) => new Set([...prev, name]));
    setPullErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setPullProgress((prev) => ({ ...prev, [name]: { status: 'starting…' } }));

    try {
      await commands.pullModel(name);
    } catch (e) {
      setPullErrors((prev) => ({ ...prev, [name]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setPullingModels((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  const runTest = async () => {
    setTestResult({ kind: 'testing' });
    try {
      const ok = await commands.aiCheckConnection();
      if (!ok) {
        setTestResult({ kind: 'fail', error: 'Connection check returned false.' });
        return;
      }
      const modelList = await commands.aiListModels();
      setTestResult({ kind: 'ok', models: modelList });
    } catch (e) {
      setTestResult({ kind: 'fail', error: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig(vaultPath ?? '', config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      reportError({ context: 'AI settings', message: 'Failed to save', error: e });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={embedded ? 'flex flex-col gap-8' : 'fixed inset-0 bg-[#050507] z-50 flex flex-col'}>
      {/* Header (only when not embedded) */}
      {!embedded && (
        <div className="flex items-center justify-between px-6 h-12 border-b border-zinc-700 shrink-0">
          <span className="font-semibold text-white">AI Settings</span>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div className={embedded ? '' : 'flex-1 overflow-y-auto p-6 space-y-8'}>
        {/* Provider Selector */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
          <div className="text-xs font-medium text-zinc-400 tracking-widest mb-4">PROVIDER</div>
          <div className="flex gap-2">
            {(['ollama', 'open_ai'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setConfig((c) => ({ ...c, provider: p }))}
                className={`flex-1 py-3 rounded-3xl text-sm font-medium transition-all ${
                  config.provider === p
                    ? 'bg-violet-500 text-white shadow-inner'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {p === 'ollama' ? 'Ollama (Local)' : 'OpenAI (Cloud)'}
              </button>
            ))}
          </div>
        </div>

        {/* Ollama Config */}
        {isOllama && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-6">
            <div className="text-xs font-medium text-zinc-400 tracking-widest">OLLAMA</div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Endpoint</label>
              <input
                type="text"
                value={config.ollama.endpoint}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    ollama: { ...c.ollama, endpoint: e.target.value },
                  }))
                }
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-3xl px-5 py-4 text-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Default Model</label>
              <input
                type="text"
                value={config.ollama.model}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    ollama: { ...c.ollama, model: e.target.value },
                  }))
                }
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-3xl px-5 py-4 text-white outline-none"
                placeholder="llama3.1:8b"
              />
            </div>
          </div>
        )}

        {/* OpenAI Config */}
        {config.provider === 'open_ai' && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-6">
            <div className="text-xs font-medium text-zinc-400 tracking-widest">OPENAI</div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">API Key</label>
              <input
                type="password"
                value={config.openai.api_key}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    openai: { ...c.openai, api_key: e.target.value },
                  }))
                }
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-3xl px-5 py-4 text-white outline-none"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Model</label>
              <input
                type="text"
                value={config.openai.model}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    openai: { ...c.openai, model: e.target.value },
                  }))
                }
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-3xl px-5 py-4 text-white outline-none"
                placeholder="gpt-4o-mini"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Endpoint</label>
              <input
                type="text"
                value={config.openai.endpoint}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    openai: { ...c.openai, endpoint: e.target.value },
                  }))
                }
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-3xl px-5 py-4 text-white outline-none"
              />
            </div>
          </div>
        )}

        {/* Pull New Model (Ollama only) */}
        {isOllama && isTauri && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-6">
            <div className="text-xs font-medium text-zinc-400 tracking-widest">PULL NEW MODEL</div>

            {/* Recommended models */}
            <div className="grid grid-cols-1 gap-3">
              {RECOMMENDED_MODELS.map((name) => {
                const isInstalled = models.includes(name);
                const isPulling = pullingModels.has(name);
                const prog = pullProgress[name];
                const pct =
                  prog?.total && prog.completed != null && prog.total > 0
                    ? Math.round((prog.completed / prog.total) * 100)
                    : null;

                return (
                  <div
                    key={name}
                    className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-3xl px-5 py-4"
                  >
                    <div>
                      <div className="font-medium text-white">{name}</div>
                      <div className="text-xs text-zinc-400">Recommended for STEM / coding</div>
                    </div>
                    <button
                      onClick={() => void handlePull(name)}
                      disabled={isPulling || isInstalled}
                      className={`px-6 py-2 rounded-3xl text-sm font-medium transition-all ${
                        isInstalled
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : isPulling
                            ? 'bg-violet-500/10 text-violet-300'
                            : 'bg-violet-500 hover:bg-violet-400 text-white'
                      }`}
                    >
                      {isInstalled ? '✓ Installed' : isPulling ? (pct != null ? `${pct}%` : 'Pulling…') : 'Pull'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Custom pull */}
            <div className="flex gap-3">
              <input
                type="text"
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePull(pullInput)}
                placeholder="e.g. llama3.2:3b"
                className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-3xl px-5 py-4 text-white outline-none"
              />
              <button
                onClick={() => void handlePull(pullInput)}
                disabled={!pullInput.trim() || pullingModels.has(pullInput.trim())}
                className="px-8 bg-violet-500 hover:bg-violet-400 text-white rounded-3xl font-medium disabled:opacity-50"
              >
                Pull
              </button>
            </div>
          </div>
        )}

        {/* Model Routing */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs font-medium text-zinc-400 tracking-widest">MODEL ROUTING</div>
            {isOllama && (
              <button
                onClick={() => void refreshModels()}
                disabled={loadingModels}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
              >
                {loadingModels && <Loader2 size={14} className="animate-spin" />}
                Refresh models
              </button>
            )}
          </div>

          <div className="space-y-5">
            {[
              { key: 'chat', label: 'Chat' },
              { key: 'summarize', label: 'Summarize' },
              { key: 'flashcards', label: 'Flashcards' },
              { key: 'explain', label: 'Explain' },
              { key: 'vision', label: 'Vision (Screenshots)' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">{label}</span>
                <select
                  value={config.model_routing[key as keyof typeof config.model_routing]}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      model_routing: { ...c.model_routing, [key]: e.target.value },
                    }))
                  }
                  className="bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-3xl px-5 py-3 text-white outline-none"
                >
                  {models.length > 0
                    ? models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    : (
                        <option value={config.model_routing[key as keyof typeof config.model_routing]}>
                          {config.model_routing[key as keyof typeof config.model_routing]}
                        </option>
                      )}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Test Connection */}
        <div className="flex justify-end">
          <button
            onClick={runTest}
            disabled={testResult.kind === 'testing'}
            className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-3xl text-sm font-medium flex items-center gap-2"
          >
            {testResult.kind === 'testing' && <Loader2 size={16} className="animate-spin" />}
            Test Connection
          </button>
        </div>

        {testResult.kind === 'ok' && (
          <div className="text-emerald-300 text-sm">✓ Connected — {testResult.models.length} models found</div>
        )}
        {testResult.kind === 'fail' && (
          <div className="text-red-400 text-sm">✗ {testResult.error}</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-6 border-t border-zinc-700 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-8 py-3 text-zinc-400 hover:bg-zinc-800 rounded-3xl font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !vaultPath}
          className="px-8 py-3 bg-violet-500 hover:bg-violet-400 text-white rounded-3xl font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving && <Loader2 size={16} className="animate-spin" />}
          {saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}