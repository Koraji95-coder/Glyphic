import { ArrowRight, Check, Cpu, Folder, Keyboard, Loader2, Mic, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useVault } from '../../hooks/useVault';
import { commands } from '../../lib/tauri/commands';
import { useOnboardingStore } from '../../stores/onboardingStore';

export function Onboarding() {
  const { isOpen, step, setStep, finish } = useOnboardingStore();
  const [vaultPath, setVaultPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openVault, createVault } = useVault();

  useEffect(() => {
    if (isOpen !== true) return;
    if (vaultPath) return;

    (async () => {
      try {
        const { homeDir } = await import('@tauri-apps/api/path');
        const home = await homeDir();
        const sep = home.endsWith('/') || home.endsWith('\\') ? '' : '/';
        setVaultPath(`${home}${sep}Glyphic`);
      } catch {
        setVaultPath('Glyphic');
      }
    })();
  }, [isOpen, vaultPath]);

  if (isOpen !== true) return null;

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({ directory: true, multiple: false, title: 'Choose vault folder' });
      if (typeof result === 'string') setVaultPath(result);
    } catch (e) {
      console.warn('Folder picker unavailable:', e);
    }
  };

  const handleContinue = async () => {
    if (!vaultPath.trim()) return;
    setBusy(true);
    setError(null);
    try {
      try {
        await openVault(vaultPath);
      } catch {
        await createVault(vaultPath, 'Glyphic');
      }
      await commands.addRecentVault(vaultPath).catch(() => {});
      setStep('ai');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[250] flex items-center justify-center">
      <div className="w-full max-w-[520px] mx-4 bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Step 1: Welcome + Vault */}
        {step === 'welcome' && (
          <div className="p-8 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-md flex items-center justify-center text-white font-bold text-2xl">
                G
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Welcome to Glyphic</h1>
                <p className="text-zinc-400 text-sm">Let's set up your first vault.</p>
              </div>
            </div>

            <p className="text-zinc-300 text-sm leading-relaxed">
              Your vault is where all your notes, screenshots, and data live. You can change this anytime in Settings.
            </p>

            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Vault location</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={vaultPath}
                  onChange={(e) => setVaultPath(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-md px-4 py-3 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="px-6 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-300 transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>

            {error && <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-md">{error}</div>}

            <div className="flex justify-end">
              <button
                onClick={handleContinue}
                disabled={busy || !vaultPath.trim()}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-500 disabled:opacity-50 rounded-md text-white font-medium flex items-center gap-2 transition-colors"
              >
                {busy ? 'Opening…' : 'Continue'}
                {!busy && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: AI Setup */}
        {step === 'ai' && <AiSetupStep onContinue={() => setStep('quickstart')} />}

        {/* Step 3: Quickstart Tips */}
        {step === 'quickstart' && (
          <div className="p-8 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Check size={24} className="text-emerald-400" />
              <h2 className="text-2xl font-semibold text-white">You're all set!</h2>
            </div>

            <p className="text-zinc-300">Here are three things to try first:</p>

            <div className="space-y-4">
              <Tip icon={<Keyboard size={18} />} title="Capture screenshots" body="Press Ctrl+Shift+S anywhere to grab a region." />
              <Tip icon={<Sparkles size={18} />} title="Slash menu" body="Type / inside a note to insert headings, callouts, etc." />
              <Tip icon={<Mic size={18} />} title="Lecture mode" body="Toggle lecture mode (Ctrl+Shift+L) to auto-stamp every new line." />
            </div>

            <div className="flex justify-end">
              <button
                onClick={finish}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-md text-white font-medium flex items-center gap-2"
              >
                Get started
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tip({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4 bg-zinc-800/50 border border-zinc-700 rounded-lg p-5">
      <div className="text-blue-400 mt-0.5">{icon}</div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="text-zinc-400 text-sm mt-1">{body}</div>
      </div>
    </div>
  );
}

type AiCheckState = { kind: 'checking' } | { kind: 'ok'; models: string[] } | { kind: 'fail'; error: string };

const AI_CHECK_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

function AiSetupStep({ onContinue }: { onContinue: () => void }) {
  const [state, setState] = useState<AiCheckState>({ kind: 'checking' });

  const runCheck = useCallback(async () => {
    setState({ kind: 'checking' });
    try {
      const ok = await withTimeout(
        commands.aiCheckConnection(),
        AI_CHECK_TIMEOUT_MS,
        'Timed out while checking Ollama connection.'
      );
      if (!ok) {
        setState({ kind: 'fail', error: 'Ollama is not reachable on http://localhost:11434.' });
        return;
      }
      try {
        const models = await withTimeout(
          commands.aiListModels(),
          AI_CHECK_TIMEOUT_MS,
          'Timed out while listing Ollama models.'
        );
        setState({ kind: 'ok', models });
      } catch {
        setState({ kind: 'ok', models: [] });
      }
    } catch (e) {
      setState({ kind: 'fail', error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const platform = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase() : '';
  const installCmd = platform.includes('mac')
    ? 'brew install ollama'
    : platform.includes('win')
    ? 'winget install Ollama.Ollama'
    : 'curl -fsSL https://ollama.com/install.sh | sh';

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Cpu size={20} className="text-blue-400" />
        <div>
          <h2 className="text-2xl font-semibold text-white">Set up local AI</h2>
          <p className="text-zinc-400 text-sm">Glyphic uses Ollama — no cloud, no API key.</p>
        </div>
      </div>

      {state.kind === 'checking' && (
        <div className="flex items-center gap-3 px-4 py-6 bg-zinc-800/50 border border-zinc-700 rounded-lg">
          <Loader2 size={18} className="animate-spin text-zinc-400" />
          <span className="text-zinc-300">Checking for Ollama…</span>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="px-4 py-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-300">
            <Check size={18} />
            <span className="font-medium">Ollama is running</span>
          </div>
          <div className="text-sm text-zinc-400 mt-2">
            {state.models.length > 0
              ? `${state.models.length} model${state.models.length === 1 ? '' : 's'} ready`
              : 'No models installed yet — you can pull one later in Settings → AI'}
          </div>
        </div>
      )}

      {state.kind === 'fail' && (
        <div className="px-4 py-6 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-300">
            <X size={18} />
            <span className="font-medium">Ollama is not running</span>
          </div>
          <div className="text-sm text-zinc-400 mt-3">
            Install from{' '}
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="underline text-emerald-300">
              ollama.com/download
            </a>
            , then run:
          </div>
          <pre className="mt-3 bg-zinc-900 p-3 rounded-md text-xs font-mono text-zinc-200 overflow-auto">
            {installCmd}
          </pre>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-4">
        {state.kind === 'fail' && (
          <button
            onClick={runCheck}
            className="px-6 py-3 text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors"
          >
            Retry
          </button>
        )}
        <button
          onClick={onContinue}
          className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onContinue}
          className="px-8 py-3 bg-blue-500 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2"
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}