import { Activity, BookOpen, FolderOpen, GraduationCap, Plus, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { commands, type FeTopicStats } from '../../lib/tauri/commands';
import { useLayoutStore } from '../../stores/layoutStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultEntry } from '../../types/vault';

interface FlatNote {
  path: string;
  title: string;
  modifiedAt: string | null;
}

function flattenNotes(entries: VaultEntry[]): FlatNote[] {
  const out: FlatNote[] = [];
  for (const entry of entries) {
    if (entry.entry_type === 'file') {
      out.push({
        path: entry.path,
        title: entry.name.replace(/\.md$/, ''),
        modifiedAt: entry.modified_at ?? null,
      });
    } else if (entry.children?.length) {
      out.push(...flattenNotes(entry.children));
    }
  }
  return out;
}

function countFolders(entries: VaultEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.entry_type === 'folder') {
      count += 1;
      if (entry.children?.length) count += countFolders(entry.children);
    }
  }
  return count;
}

function formatRelative(dateIso: string | null): string {
  if (!dateIso) return 'Unknown';
  const value = new Date(dateIso);
  if (Number.isNaN(value.getTime())) return 'Unknown';
  const delta = Date.now() - value.getTime();
  const minutes = Math.max(1, Math.floor(delta / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Dashboard() {
  const fileTree = useVaultStore((s) => s.fileTree);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const openFePrep = useLayoutStore((s) => s.openFePrep);
  const [sourcesIngested, setSourcesIngested] = useState<number>(0);
  const [feStats, setFeStats] = useState<FeTopicStats[]>([]);

  const notes = useMemo(() => flattenNotes(fileTree), [fileTree]);
  const totalNotes = notes.length;
  const totalFolders = useMemo(() => countFolders(fileTree), [fileTree]);

  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => {
        const ta = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const tb = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5);
  }, [notes]);

  const feSummary = useMemo(() => {
    if (feStats.length === 0) return { attempts: 0, accuracy: 0 };
    const attempts = feStats.reduce((sum, s) => sum + s.attempts, 0);
    const correct = feStats.reduce((sum, s) => sum + s.correct, 0);
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    return { attempts, accuracy };
  }, [feStats]);

  useEffect(() => {
    void commands
      .getFeStatistics()
      .then((stats) => setFeStats(stats))
      .catch(() => setFeStats([]));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '26px 28px 28px' }}>
      <div className="grid" style={{ gap: '14px' }}>
        <div
          className="grid"
          style={{
            gap: '14px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <StatCard label="Total notes" value={String(totalNotes)} icon={<BookOpen size={15} />} />
          <StatCard label="Folders" value={String(totalFolders)} icon={<FolderOpen size={15} />} />
          <StatCard
            label="Documents ingested"
            value={String(sourcesIngested)}
            icon={<Upload size={15} />}
          />
          <StatCard
            label="FE accuracy"
            value={feSummary.attempts > 0 ? `${feSummary.accuracy}%` : '--'}
            icon={<GraduationCap size={15} />}
          />
        </div>

        <div
          className="grid"
          style={{
            gap: '14px',
            gridTemplateColumns: 'minmax(280px, 1.3fr) minmax(240px, 1fr)',
          }}
        >
          <section style={panelStyle}>
            <header className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
              <h2 style={headingStyle}>Recent notes</h2>
              <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>{recentNotes.length} items</span>
            </header>
            <div className="flex flex-col" style={{ gap: '6px' }}>
              {recentNotes.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-ghost)' }}>No notes yet. Create one to begin.</div>
              )}
              {recentNotes.map((note) => (
                <button
                  key={note.path}
                  type="button"
                  onClick={() => setActiveNote(note.path, note.path)}
                  className="flex items-center justify-between"
                  style={listButtonStyle}
                >
                  <span className="truncate" style={{ maxWidth: '75%' }}>
                    {note.title}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>{formatRelative(note.modifiedAt)}</span>
                </button>
              ))}
            </div>
          </section>

          <section style={panelStyle}>
            <header className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
              <h2 style={headingStyle}>FE prep progress</h2>
              <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>{feSummary.attempts} attempts</span>
            </header>
            <div className="flex flex-col" style={{ gap: '8px' }}>
              {feStats.slice(0, 5).map((topic) => (
                <div key={topic.topic_id} style={{ display: 'grid', gap: '4px' }}>
                  <div className="flex items-center justify-between" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Topic #{topic.topic_id}</span>
                    <span>{Math.round(topic.accuracy)}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      style={{
                        width: `${Math.max(6, Math.min(100, Math.round(topic.accuracy)))}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: 'var(--accent-gradient)',
                      }}
                    />
                  </div>
                </div>
              ))}
              {feStats.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-ghost)' }}>
                  No FE attempts yet. Start a session to track progress.
                </div>
              )}
            </div>
          </section>
        </div>

        <section style={panelStyle}>
          <header className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
            <h2 style={headingStyle}>Quick actions</h2>
            <Activity size={14} style={{ color: 'var(--text-ghost)' }} />
          </header>
          <div className="flex flex-wrap" style={{ gap: '10px' }}>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('glyphic:new-note'))}
              style={primaryActionStyle}
            >
              <Plus size={14} /> New note
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('glyphic:new-folder'))}
              style={secondaryActionStyle}
            >
              <FolderOpen size={14} /> New folder
            </button>
            <button
              type="button"
              onClick={() => {
                const path = window.prompt('Path to document:');
                if (!path) return;
                void commands.ingestDocument(path, []).then(() => setSourcesIngested((v) => v + 1));
              }}
              style={secondaryActionStyle}
            >
              <Upload size={14} /> Import document
            </button>
            <button type="button" onClick={openFePrep} style={secondaryActionStyle}>
              <GraduationCap size={14} /> Start FE session
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: '10px',
        borderRadius: '14px',
        border: '1px solid var(--glass-border)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        padding: '12px',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '10px',
          color: 'var(--text-primary)',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  borderRadius: '16px',
  border: '1px solid var(--glass-border)',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), var(--glass-surface)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  padding: '14px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

const headingStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-display)',
};

const listButtonStyle: CSSProperties = {
  border: '1px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: '10px',
  color: 'var(--text-secondary)',
  padding: '8px 10px',
  cursor: 'pointer',
  textAlign: 'left',
};

const primaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: '1px solid transparent',
  background: 'var(--accent-gradient)',
  color: '#fff',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: '1px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-secondary)',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
