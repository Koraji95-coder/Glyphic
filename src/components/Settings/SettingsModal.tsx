import { Camera, Cog, Keyboard, Mic, PenTool, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { type SettingsSection, useSettingsUiStore } from '../../stores/settingsUiStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultConfig } from '../../types/vault';
import { AiSettingsPanel } from '../Chat/AiSettingsPanel';
import { ShortcutsList } from '../Help/ShortcutsList';

const NAV_ITEMS: Array<{ id: SettingsSection; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'general', label: 'General', icon: Cog },
  { id: 'editor', label: 'Editor', icon: PenTool },
  { id: 'capture', label: 'Capture', icon: Camera },
  { id: 'lecture', label: 'Lecture', icon: Mic },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

export function SettingsModal() {
  const { isOpen, section, close, setSection } = useSettingsUiStore();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [draft, setDraft] = useState<VaultConfig | null>(null);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (isOpen && settings) {
      setDraft(structuredClone(settings));
      setSavingState('idle');
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const persist = async (next: VaultConfig) => {
    setDraft(next);
    if (!vaultPath) return;
    setSavingState('saving');
    try {
      await updateSettings(vaultPath, next);
      setSavingState('saved');
      setTimeout(() => setSavingState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (e) {
      console.error('Failed to save settings:', e);
      setSavingState('idle');
    }
  };

  return (
    <div
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
        style={{
          width: 'min(900px, 92vw)',
          height: 'min(640px, 88vh)',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <nav
          style={{
            width: '180px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border)',
            padding: '14px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-ghost)',
              padding: '6px 8px 10px',
            }}
          >
            Settings
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className="flex items-center"
                style={{
                  gap: '8px',
                  padding: '7px 10px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  textAlign: 'left',
                }}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col flex-1 min-w-0">
          <header
            className="flex items-center justify-between shrink-0"
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {NAV_ITEMS.find((i) => i.id === section)?.label}
            </h2>
            <div className="flex items-center" style={{ gap: '10px' }}>
              {savingState !== 'idle' && (
                <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>
                  {savingState === 'saving' ? 'Saving…' : 'Saved'}
                </span>
              )}
              <button
                type="button"
                onClick={close}
                aria-label="Close settings"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: '4px',
                  borderRadius: '4px',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto" style={{ padding: '18px 22px' }}>
            {!draft && section !== 'shortcuts' && section !== 'ai' && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Open a vault to edit settings.</p>
            )}
            {section === 'general' && draft && (
              <GeneralSection draft={draft} onChange={persist} vaultPath={vaultPath} />
            )}
            {section === 'editor' && draft && <EditorSection draft={draft} onChange={persist} />}
            {section === 'capture' && draft && <CaptureSection draft={draft} onChange={persist} />}
            {section === 'lecture' && draft && <LectureSection draft={draft} onChange={persist} />}
            {section === 'ai' && <AiSettingsPanel onClose={close} embedded />}
            {section === 'shortcuts' && <ShortcutsList />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  draft: VaultConfig;
  onChange: (next: VaultConfig) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>{hint}</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  padding: '6px 10px',
  outline: 'none',
};

function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex items-center" style={{ gap: '10px' }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', minWidth: '60px', textAlign: 'right' }}>
        {value}
        {unit ?? ''}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
    />
  );
}

function GeneralSection({
  draft,
  onChange,
  vaultPath,
}: SectionProps & { vaultPath: string | null }) {
  return (
    <div>
      <Field label="Vault location">
        <input type="text" readOnly value={vaultPath ?? '(none)'} style={{ ...inputStyle, opacity: 0.7 }} />
      </Field>
      <Field label="Vault name">
        <input
          type="text"
          value={draft.vault.name}
          onChange={(e) => onChange({ ...draft, vault: { ...draft.vault, name: e.target.value } })}
          style={inputStyle}
        />
      </Field>
      <Field label="Theme">
        <select
          value={draft.appearance.theme}
          onChange={(e) =>
            onChange({
              ...draft,
              appearance: { ...draft.appearance, theme: e.target.value as VaultConfig['appearance']['theme'] },
            })
          }
          style={inputStyle}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="indigo">Dark — Indigo</option>
          <option value="emerald">Dark — Emerald</option>
          <option value="amber">Dark — Amber</option>
          <option value="rose">Dark — Rose</option>
        </select>
      </Field>
      <Field label="Sidebar width" hint={`${draft.appearance.sidebar_width}px`}>
        <Slider
          value={draft.appearance.sidebar_width}
          min={200}
          max={400}
          onChange={(v) =>
            onChange({ ...draft, appearance: { ...draft.appearance, sidebar_width: v } })
          }
          unit="px"
        />
      </Field>
      <Field label="Accent color">
        <input
          type="color"
          value={draft.appearance.accent_color}
          onChange={(e) =>
            onChange({ ...draft, appearance: { ...draft.appearance, accent_color: e.target.value } })
          }
          style={{ ...inputStyle, padding: '2px', height: '28px', width: '60px' }}
        />
      </Field>
    </div>
  );
}

function EditorSection({ draft, onChange }: SectionProps) {
  const e = draft.editor;
  return (
    <div>
      <Field label="Font family">
        <select
          value={e.font_family}
          onChange={(ev) => onChange({ ...draft, editor: { ...e, font_family: ev.target.value } })}
          style={inputStyle}
        >
          <option value="Inter, sans-serif">Inter</option>
          <option value="-apple-system, sans-serif">System Default</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="JetBrains Mono, monospace">JetBrains Mono</option>
          <option value="SF Pro, sans-serif">SF Pro</option>
        </select>
      </Field>
      <Field label="Font size" hint={`${e.font_size}px`}>
        <Slider
          value={e.font_size}
          min={12}
          max={24}
          onChange={(v) => onChange({ ...draft, editor: { ...e, font_size: v } })}
          unit="px"
        />
      </Field>
      <Field label="Line height" hint={e.line_height.toFixed(2)}>
        <Slider
          value={e.line_height}
          min={1.2}
          max={2.0}
          step={0.05}
          onChange={(v) => onChange({ ...draft, editor: { ...e, line_height: v } })}
        />
      </Field>
      <Field label="Autosave interval" hint={`${e.autosave_interval_ms}ms`}>
        <Slider
          value={e.autosave_interval_ms}
          min={500}
          max={10000}
          step={250}
          onChange={(v) => onChange({ ...draft, editor: { ...e, autosave_interval_ms: v } })}
          unit="ms"
        />
      </Field>
      <Field label="Spell check">
        <Toggle checked={e.spell_check} onChange={(v) => onChange({ ...draft, editor: { ...e, spell_check: v } })} />
      </Field>
      <Field label="Show line numbers">
        <Toggle
          checked={e.show_line_numbers}
          onChange={(v) => onChange({ ...draft, editor: { ...e, show_line_numbers: v } })}
        />
      </Field>
    </div>
  );
}

function CaptureSection({ draft, onChange }: SectionProps) {
  const c = draft.capture;
  return (
    <div>
      <Field label="Default mode">
        <select
          value={c.default_mode}
          onChange={(e) =>
            onChange({
              ...draft,
              capture: { ...c, default_mode: e.target.value as VaultConfig['capture']['default_mode'] },
            })
          }
          style={inputStyle}
        >
          <option value="region">Region</option>
          <option value="window">Window</option>
          <option value="freeform">Freeform</option>
          <option value="fullscreen">Fullscreen</option>
        </select>
      </Field>
      <Field label="Capture hotkey" hint="e.g. CmdOrCtrl+Shift+4">
        <input
          type="text"
          value={c.hotkey}
          onChange={(e) => onChange({ ...draft, capture: { ...c, hotkey: e.target.value } })}
          style={inputStyle}
        />
      </Field>
      <Field label="Fullscreen hotkey">
        <input
          type="text"
          value={c.fullscreen_hotkey}
          onChange={(e) =>
            onChange({ ...draft, capture: { ...c, fullscreen_hotkey: e.target.value } })
          }
          style={inputStyle}
        />
      </Field>
      <Field label="Repeat hotkey">
        <input
          type="text"
          value={c.repeat_hotkey}
          onChange={(e) => onChange({ ...draft, capture: { ...c, repeat_hotkey: e.target.value } })}
          style={inputStyle}
        />
      </Field>
      <Field label="Copy capture to clipboard">
        <Toggle
          checked={c.save_to_clipboard}
          onChange={(v) => onChange({ ...draft, capture: { ...c, save_to_clipboard: v } })}
        />
      </Field>
      <Field label="Auto-trim whitespace borders">
        <Toggle
          checked={c.auto_trim_whitespace}
          onChange={(v) => onChange({ ...draft, capture: { ...c, auto_trim_whitespace: v } })}
        />
      </Field>
      <Field label="Image format">
        <select
          value={c.image_format}
          onChange={(e) =>
            onChange({
              ...draft,
              capture: { ...c, image_format: e.target.value as VaultConfig['capture']['image_format'] },
            })
          }
          style={inputStyle}
        >
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="webp">WebP</option>
        </select>
      </Field>
      {c.image_format === 'jpg' && (
        <Field label="JPG quality" hint={`${c.jpg_quality}%`}>
          <Slider
            value={c.jpg_quality}
            min={50}
            max={100}
            onChange={(v) => onChange({ ...draft, capture: { ...c, jpg_quality: v } })}
            unit="%"
          />
        </Field>
      )}
    </div>
  );
}

function LectureSection({ draft, onChange }: SectionProps) {
  const l = draft.lecture_mode;
  return (
    <div>
      <Field label="Timestamp format">
        <select
          value={l.timestamp_format}
          onChange={(e) =>
            onChange({ ...draft, lecture_mode: { ...l, timestamp_format: e.target.value } })
          }
          style={inputStyle}
        >
          <option value="%H:%M:%S">HH:mm:ss</option>
          <option value="%M:%S">mm:ss</option>
          <option value="%H:%M">HH:mm</option>
        </select>
      </Field>
    </div>
  );
}
