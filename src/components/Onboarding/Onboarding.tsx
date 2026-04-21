import { ArrowRight, Check, Folder, Keyboard, Mic, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
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
      setStep('quickstart');
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
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Let's set up your vault.
                </p>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Your vault is the folder where Glyphic stores notes, screenshots, and settings.
              You can change this later in Settings → General.
            </p>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Vault location
              </span>
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
