import { useState, useEffect } from 'react';
import { Check, X, Loader2, Wifi, WifiOff } from 'lucide-react';
import { AiConfig } from '../../types/ai';
import { commands } from '../../lib/tauri/commands';
import { useChatStore } from '../../stores/chatStore';

interface AiSettingsPanelProps {
  onClose: () => void;
}

export function AiSettingsPanel({ onClose }: AiSettingsPanelProps) {
  const { isConnected, checkConnection, updateConfig } = useChatStore();

  const [config, setConfig] = useState<AiConfig>({
    provider: 'ollama',
    ollama: { endpoint: 'http://localhost:11434', model: 'llama3.2:3b' },
    openai: { api_key: '', model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1' },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    commands.aiGetConfig().then(setConfig).catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    await checkConnection();
    setIsTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Errors are surfaced through connection status.
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    padding: '6px 8px',
    width: '100%',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    marginBottom: '4px',
    display: 'block',
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-editor)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: 'var(--toolbar-height)',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
        }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          AI Settings
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Provider selector */}
        <div style={sectionStyle}>
          <span
            style={{
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Provider
          </span>
          <div className="flex gap-2">
            {(['ollama', 'open_ai'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setConfig((c) => ({ ...c, provider: p }))}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-body)',
                  border: `1px solid ${config.provider === p ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor:
                    config.provider === p ? 'var(--bg-active)' : 'var(--bg-input)',
                  color: config.provider === p ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {p === 'ollama' ? 'Ollama (Local)' : 'OpenAI (Cloud)'}
              </button>
            ))}
          </div>
        </div>

        {/* Ollama config */}
        {config.provider === 'ollama' && (
          <div style={sectionStyle}>
            <span
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Ollama
            </span>
            <div>
              <label style={labelStyle}>Endpoint</label>
              <input
                type="text"
                value={config.ollama.endpoint}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    ollama: { ...c.ollama, endpoint: e.target.value },
                  }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Model</label>
              <input
                type="text"
                value={config.ollama.model}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    ollama: { ...c.ollama, model: e.target.value },
                  }))
                }
                style={inputStyle}
                placeholder="e.g. llama3.2:3b"
              />
            </div>
          </div>
        )}

        {/* OpenAI config */}
        {config.provider === 'open_ai' && (
          <div style={sectionStyle}>
            <span
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              OpenAI
            </span>
            <div>
              <label style={labelStyle}>API Key</label>
              <input
                type="password"
                value={config.openai.api_key}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    openai: { ...c.openai, api_key: e.target.value },
                  }))
                }
                style={inputStyle}
                placeholder="sk-..."
              />
            </div>
            <div>
              <label style={labelStyle}>Model</label>
              <input
                type="text"
                value={config.openai.model}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    openai: { ...c.openai, model: e.target.value },
                  }))
                }
                style={inputStyle}
                placeholder="e.g. gpt-4o-mini"
              />
            </div>
            <div>
              <label style={labelStyle}>Endpoint</label>
              <input
                type="text"
                value={config.openai.endpoint}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    openai: { ...c.openai, endpoint: e.target.value },
                  }))
                }
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Connection status */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {isConnected === true && <Wifi size={13} style={{ color: 'var(--color-green, #4ade80)' }} />}
          {isConnected === false && <WifiOff size={13} style={{ color: 'var(--color-red, #f87171)' }} />}
          {isConnected === null && <Wifi size={13} style={{ color: 'var(--text-ghost)' }} />}
          <span
            className="text-xs flex-1"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {isConnected === true
              ? 'Connected'
              : isConnected === false
              ? 'Not connected'
              : 'Not tested'}
          </span>
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="text-xs px-2 py-1 rounded flex items-center gap-1"
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              cursor: isTesting ? 'not-allowed' : 'pointer',
            }}
          >
            {isTesting ? <Loader2 size={11} className="animate-spin" /> : null}
            Test
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="px-3 py-3 flex justify-end gap-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded"
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
          style={{
            backgroundColor: saveSuccess ? 'var(--color-green, #4ade80)' : 'var(--accent)',
            color: 'var(--bg-app)',
            fontFamily: 'var(--font-body)',
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? (
            <Loader2 size={11} className="animate-spin" />
          ) : saveSuccess ? (
            <Check size={11} />
          ) : null}
          {saveSuccess ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}
