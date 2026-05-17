import Activity from 'lucide-react/dist/esm/icons/activity';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap';
import Plus from 'lucide-react/dist/esm/icons/plus';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { commands, type FeTopicStats, type FeWeakTopic } from '../../lib/tauri/commands';
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

function clampAccuracy(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function Dashboard() {
  const fileTree = useVaultStore((s) => s.fileTree);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const openFePrep = useLayoutStore((s) => s.openFePrep);
  const openMasteryMode = useLayoutStore((s) => s.openMasteryMode);

  const [feStats, setFeStats] = useState<FeTopicStats[]>([]);
  const [weakTopics, setWeakTopics] = useState<FeWeakTopic[]>([]);

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
    if (feStats.length === 0) return { attempts: 0, accuracy: 0, strongest: null as FeTopicStats | null };
    const attempts = feStats.reduce((sum, s) => sum + s.attempts, 0);
    const correct = feStats.reduce((sum, s) => sum + s.correct, 0);
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    const strongest = [...feStats].sort((a, b) => b.accuracy - a.accuracy)[0] ?? null;
    return { attempts, accuracy, strongest };
  }, [feStats]);

  const nextFocus = weakTopics[0] ?? null;
  const hasAnyData = totalNotes > 0 || feSummary.attempts > 0;

  useEffect(() => {
    void Promise.all([commands.getFeStatistics(), commands.getWeakFeTopics()])
      .then(([stats, weak]) => {
        setFeStats(stats);
        setWeakTopics(weak);
      })
      .catch(() => {
        setFeStats([]);
        setWeakTopics([]);
      });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-app)', padding: '28px' }}>
      <div className="mx-auto" style={{ maxWidth: 1180 }}>
        <header className="flex items-start justify-between gap-6" style={{ marginBottom: 24 }}>
          <div>
            <p style={eyebrowStyle}>Study workspace</p>
            <h1 style={{ color: 'var(--text-primary)', fontSize: 30, lineHeight: 1.12, fontWeight: 700 }}>
              Glyphic study dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 660, marginTop: 8, lineHeight: 1.55 }}>
              Plan the next session, reopen recent notes, and move straight into FE Electrical practice or review.
            </p>
          </div>
          <button type="button" onClick={openFePrep} style={primaryButtonStyle}>
            <GraduationCap size={17} />
            Start FE Prep
          </button>
        </header>

        {!hasAnyData && (
          <section style={noticeStyle}>
            <div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>Set up your study loop</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
                Create a note, organize one folder, then run an FE practice session. This dashboard will turn those
                actions into a visible review queue.
              </p>
            </div>
            <span style={statusPillStyle}>Local-first</span>
          </section>
        )}

        <section
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          aria-label="Study metrics"
          style={{ marginBottom: 20 }}
        >
          <StatCard label="Total notes" value={String(totalNotes)} icon={<BookOpen size={18} />} />
          <StatCard label="Folders" value={String(totalFolders)} icon={<FolderOpen size={18} />} />
          <StatCard label="FE attempts" value={String(feSummary.attempts)} icon={<ClipboardList size={18} />} />
          <StatCard
            label="FE accuracy"
            value={feSummary.attempts > 0 ? `${feSummary.accuracy}%` : '-'}
            icon={<TrendingUp size={18} />}
          />
        </section>

        <div className="grid md:grid-cols-2 gap-5" style={{ marginBottom: 20 }}>
          <Section title="Today's study focus" actionLabel="Open FE Prep" onAction={openFePrep}>
            {nextFocus ? (
              <div style={focusPanelStyle}>
                <div className="flex items-center gap-3">
                  <div style={warningIconStyle}>
                    <AlertTriangle size={17} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Review {nextFocus.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                      {nextFocus.category} · {nextFocus.attempts} attempts · {clampAccuracy(nextFocus.accuracy)}%
                      accuracy
                    </p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 16 }}>
                  Start here before adding new material. Weak-topic review keeps FE practice from becoming random drill
                  work.
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<Activity size={18} />}
                title="No weak topics yet"
                body="Run an FE practice session and Glyphic will surface the first topics that need review."
              />
            )}
          </Section>

          <Section title="Quick actions">
            <div className="grid gap-3">
              <QuickAction
                icon={<Plus size={17} />}
                label="New note"
                onClick={() => dispatchGlyphicEvent('glyphic:new-note')}
              />
              <QuickAction
                icon={<FolderOpen size={17} />}
                label="New folder"
                onClick={() => dispatchGlyphicEvent('glyphic:new-folder')}
              />
              <QuickAction icon={<GraduationCap size={17} />} label="Start FE Prep" onClick={openFePrep} />
              <QuickAction icon={<CheckCircle2 size={17} />} label="Open Mastery" onClick={openMasteryMode} />
            </div>
          </Section>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <Section title="Recent notes">
            {recentNotes.length > 0 ? (
              <div className="grid gap-2">
                {recentNotes.map((note) => (
                  <button
                    key={note.path}
                    type="button"
                    onClick={() => setActiveNote(note.path, note.path)}
                    style={noteButtonStyle}
                  >
                    <span className="truncate" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {note.title}
                    </span>
                    <span style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {formatRelative(note.modifiedAt)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<BookOpen size={18} />}
                title="No notes yet"
                body="Create an FE concept note or import material into the vault to start building context."
              />
            )}
          </Section>

          <Section title="Weak topic review" actionLabel="Practice" onAction={openFePrep}>
            {weakTopics.length > 0 ? (
              <div className="grid gap-3">
                {weakTopics.slice(0, 4).map((topic) => (
                  <ProgressRow
                    key={topic.topic_id}
                    label={topic.name}
                    detail={`${topic.category} · ${topic.attempts} attempts`}
                    value={clampAccuracy(topic.accuracy)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<AlertTriangle size={18} />}
                title="No review queue"
                body="Weak areas will appear after enough FE attempts are recorded."
              />
            )}
          </Section>
        </div>

        <section style={{ ...panelStyle, marginTop: 20 }} aria-label="Study readiness checklist">
          <div className="grid md:grid-cols-3 gap-3">
            <ChecklistItem title="Create first note" done={totalNotes > 0} />
            <ChecklistItem title="Organize folders" done={totalFolders > 0} />
            <ChecklistItem title="Run FE practice" done={feSummary.attempts > 0} />
          </div>
          {feSummary.strongest && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 16 }}>
              Strongest current topic: Topic #{feSummary.strongest.topic_id} at{' '}
              {clampAccuracy(feSummary.strongest.accuracy)}% accuracy.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function dispatchGlyphicEvent(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div style={statCardStyle}>
      <div style={metricIconStyle}>{icon}</div>
      <div>
        <div
          style={{ color: 'var(--text-secondary)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {label}
        </div>
        <div style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700, marginTop: 3 }}>{value}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div className="flex items-center justify-between gap-4" style={{ marginBottom: 16 }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>{title}</h2>
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} style={secondaryButtonStyle}>
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div style={emptyStateStyle}>
      <div style={mutedIconStyle}>{icon}</div>
      <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{title}</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{body}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={quickActionStyle}>
      <span className="flex items-center gap-3">
        <span style={mutedIconStyle}>{icon}</span>
        {label}
      </span>
      <span style={{ color: 'var(--text-ghost)' }}>Open</span>
    </button>
  );
}

function ProgressRow({ label, detail, value }: { label: string; detail: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between gap-4" style={{ marginBottom: 8 }}>
        <div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{label}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{detail}</p>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{value}%</span>
      </div>
      <div style={progressTrackStyle}>
        <div style={{ ...progressFillStyle, width: `${value}%` }} />
      </div>
    </div>
  );
}

function ChecklistItem({ title, done }: { title: string; done: boolean }) {
  return (
    <div style={checklistItemStyle}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '999px',
          background: done ? 'var(--accent-mastery-dim)' : 'var(--bg-hover)',
          border: done ? '1px solid var(--accent-mastery)' : '1px solid var(--border)',
        }}
      />
      <span style={{ color: done ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 14 }}>{title}</span>
    </div>
  );
}

const eyebrowStyle = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  marginBottom: 8,
  textTransform: 'uppercase' as const,
};

const panelStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 20,
};

const statCardStyle = {
  ...panelStyle,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
};

const noticeStyle = {
  ...panelStyle,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 18,
  marginBottom: 20,
  background: 'linear-gradient(135deg, var(--accent-dim), var(--bg-card))',
};

const statusPillStyle = {
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  padding: '6px 10px',
  fontSize: 12,
  whiteSpace: 'nowrap' as const,
};

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent)',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  minHeight: 32,
  padding: '0 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-hover)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const quickActionStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  width: '100%',
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-hover)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'left' as const,
};

const noteButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  width: '100%',
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-hover)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  textAlign: 'left' as const,
};

const metricIconStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent-dim)',
  color: 'var(--accent)',
  flex: '0 0 auto',
};

const mutedIconStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-hover)',
  color: 'var(--text-secondary)',
  flex: '0 0 auto',
};

const warningIconStyle = {
  ...mutedIconStyle,
  background: 'var(--bg-review-panel)',
  color: 'var(--accent-review)',
};

const focusPanelStyle = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 16,
  background: 'var(--bg-hover)',
};

const emptyStateStyle = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 18,
  background: 'rgba(255,255,255,0.025)',
};

const progressTrackStyle = {
  height: 8,
  borderRadius: '999px',
  background: 'var(--bg-hover)',
  overflow: 'hidden',
};

const progressFillStyle = {
  height: '100%',
  borderRadius: '999px',
  background: 'var(--accent)',
};

const checklistItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px 14px',
  background: 'var(--bg-hover)',
};
