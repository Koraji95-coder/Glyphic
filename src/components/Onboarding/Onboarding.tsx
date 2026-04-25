import { ArrowRight, Check, Cpu, Folder, Keyboard, Loader2, Mic, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useVault } from '../../hooks/useVault';
import { commands } from '../../lib/tauri/commands';
import { useOnboardingStore } from '../../stores/onboardingStore';

/**
 * First-launch onboarding: welcome → pick vault → quickstart tips.
 * Triggered from `App.tsx` when `get_recent_vaults` returns an empty list.
 */
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
      try {
        await commands.addRecentVault(vaultPath);
      } catch {
        // Non-fatal: state file write may fail on locked-down filesystems.
      }
      setStep('ai');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Glyphic"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 'min(520px, 92vw)',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          padding: '32px 28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'auto',
        }}
      >
        {step === 'welcome' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--accent-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '18px',
                }}
              >
                G
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Welcome to Glyphic
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Let's set up your vault.</p>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Your vault is the folder where Glyphic stores notes, screenshots, and settings. You can change this later
              in Settings → General.
            </p>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Vault location</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={vaultPath}
                  onChange={(e) => setVaultPath(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    padding: '8px 10px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    padding: '0 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Folder size={13} />
                  Browse…
                </button>
              </div>
            </label>

            {error && (
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--red, #f87171)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                disabled={busy || !vaultPath.trim()}
                onClick={handleContinue}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy || !vaultPath.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {busy ? 'Opening…' : 'Continue'}
                {!busy && <ArrowRight size={14} />}
              </button>
            </div>
          </>
        )}

        {step === 'ai' && <AiSetupStep onContinue={() => setStep('quickstart')} />}

        {step === 'quickstart' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Check size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                You're all set
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Three things to try first:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Tip
                icon={<Keyboard size={14} />}
                title="Capture screenshots"
                body="Press Ctrl+Shift+S anywhere to grab a region. Captures are inserted into the active note."
              />
              <Tip
                icon={<Sparkles size={14} />}
                title="Slash menu"
                body="Type / inside a note to insert headings, callouts, code blocks, and more."
              />
              <Tip
                icon={<Mic size={14} />}
                title="Lecture mode"
                body="Toggle lecture mode (Ctrl+Shift+L) to auto-stamp every new line with elapsed time."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={finish}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Get started
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tip({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        padding: '10px 12px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
      }}
    >
      <span style={{ color: 'var(--accent)', marginTop: '1px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{body}</div>
      </div>
    </div>
  );
}

type AiCheckState = { kind: 'checking' } | { kind: 'ok'; models: string[] } | { kind: 'fail'; error: string };

function AiSetupStep({ onContinue }: { onContinue: () => void }) {
  const [state, setState] = useState<AiCheckState>({ kind: 'checking' });

  const runCheck = useCallback(async () => {
    setState({ kind: 'checking' });
    try {
      const ok = await commands.aiCheckConnection();
      if (!ok) {
        setState({ kind: 'fail', error: 'Ollama is not reachable on http://localhost:11434.' });
        return;
      }
      try {
        const models = await commands.aiListModels();
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

  // Detect platform for a friendlier install command.
  const platform = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase() : '';
  const installCmd = platform.includes('mac')
    ? 'brew install ollama'
    : platform.includes('win')
      ? 'winget install Ollama.Ollama'
      : 'curl -fsSL https://ollama.com/install.sh | sh';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Cpu size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Set up local AI
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Glyphic uses Ollama to run language models on your machine — no cloud, no key.
          </p>
        </div>
      </div>

      {state.kind === 'checking' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <Loader2 size={14} className="animate-spin" />
          Checking for Ollama…
        </div>
      )}

      {state.kind === 'ok' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '10px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-muted, var(--accent))',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
            <Check size={14} /> Ollama detected on http://localhost:11434
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {state.models.length > 0
              ? `${state.models.length} model${state.models.length === 1 ? '' : 's'} installed: ${state.models.slice(0, 3).join(', ')}${state.models.length > 3 ? ', …' : ''}`
              : 'No models installed yet — pull one from Settings → AI after onboarding (e.g. llama3.1:8b for chat, qwen2.5:7b for math).'}
          </div>
        </div>
      )}

      {state.kind === 'fail' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <X size={14} /> Ollama isn't running
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Install it from{' '}
            <a
              href="https://ollama.com/download"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            >
              ollama.com/download
            </a>
            , or run:
          </div>
          <pre
            style={{
              margin: 0,
              padding: '8px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {installCmd}
          </pre>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Then start Ollama and click <strong>Retry</strong>. You can also skip this and configure AI later in Settings.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '8px' }}>
        {state.kind === 'fail' ? (
          <button
            type="button"
            onClick={() => void runCheck()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '8px 14px',
              borderRadius: '7px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onContinue}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '8px 14px',
              borderRadius: '7px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={onContinue}
            style={{
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
