import { Activity, BookOpen, FolderOpen, GraduationCap, Plus, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

  const [sourcesIngested, setSourcesIngested] = useState(0);
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
    void commands.getFeStatistics().then(setFeStats).catch(() => setFeStats([]));
  }, []);

  const hasAnyData = totalNotes > 0 || feSummary.attempts > 0 || sourcesIngested > 0;

  return (
    <div className="flex-1 overflow-y-auto p-7 bg-[#050507]">
      <div className="max-w-7xl mx-auto space-y-8">
        {!hasAnyData && (
          <section
            className="rounded-3xl border border-zinc-700 p-7"
            style={{
              background:
                'linear-gradient(145deg, rgba(124,58,237,0.16), rgba(6,182,212,0.08) 45%, rgba(24,24,27,0.88) 75%)',
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold text-white">Welcome to Glyphic</h1>
                <p className="text-zinc-300 mt-2" style={{ maxWidth: '52ch', lineHeight: 1.55 }}>
                  Your workspace is ready. Create your first note, organize a folder structure,
                  then start an FE session and this dashboard will populate with live progress.
                </p>
              </div>
              <div className="text-xs text-zinc-300 rounded-2xl border border-zinc-600 px-3 py-2 bg-zinc-900/60">
                Setup takes about 2 minutes
              </div>
            </div>
          </section>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total notes" value={String(totalNotes)} icon={<BookOpen size={18} />} />
          <StatCard label="Folders" value={String(totalFolders)} icon={<FolderOpen size={18} />} />
          <StatCard label="Documents ingested" value={String(sourcesIngested)} icon={<Upload size={18} />} />
          <StatCard
            label="FE accuracy"
            value={feSummary.attempts > 0 ? `${feSummary.accuracy}%` : '—'}
            icon={<GraduationCap size={18} />}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent notes */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">Recent notes</h2>
              <span className="text-xs text-zinc-400">{recentNotes.length} items</span>
            </div>
            {recentNotes.length > 0 ? (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <button
                    key={note.path}
                    onClick={() => setActiveNote(note.path, note.path)}
                    className="w-full flex justify-between items-center px-5 py-4 hover:bg-zinc-800 rounded-2xl transition-colors text-left"
                  >
                    <span className="text-zinc-200 truncate">{note.title}</span>
                    <span className="text-xs text-zinc-400 font-mono">{formatRelative(note.modifiedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
                <BookOpen size={20} className="text-zinc-400" style={{ margin: '0 auto 10px auto' }} />
                <p className="text-zinc-300 text-sm">No recent notes yet</p>
                <p className="text-zinc-500 text-xs mt-1">Create a note and it will appear here.</p>
              </div>
            )}
          </div>

          {/* FE Prep progress */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">FE Prep Progress</h2>
              <span className="text-xs text-zinc-400">{feSummary.attempts} attempts</span>
            </div>
            {feStats.length > 0 ? (
              <div className="space-y-6">
                {feStats.slice(0, 5).map((topic) => (
                  <div key={topic.topic_id}>
                    <div className="flex justify-between text-xs text-zinc-400 mb-2">
                      <span>Topic #{topic.topic_id}</span>
                      <span>{Math.round(topic.accuracy)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-3xl overflow-hidden">
                      <div
                        className="h-2 bg-linear-to-r from-violet-400 to-cyan-400 rounded-3xl transition-all"
                        style={{ width: `${Math.min(100, Math.round(topic.accuracy))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <GraduationCap size={20} className="text-zinc-400" style={{ marginBottom: 10 }} />
                <p className="text-zinc-300 text-sm">No FE sessions started</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Run your first FE practice session to track topic-level accuracy.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
          <h2 className="font-semibold text-white mb-5">Quick actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('glyphic:new-note'))}
              className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-violet-500 to-cyan-400 text-white rounded-3xl font-medium hover:brightness-110 transition-all"
            >
              <Plus size={18} />
              New note
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('glyphic:new-folder'))}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-3xl font-medium transition-all"
            >
              <FolderOpen size={18} />
              New folder
            </button>
            <button
              onClick={openFePrep}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-3xl font-medium transition-all"
            >
              <GraduationCap size={18} />
              Start FE session
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-800 grid md:grid-cols-3 gap-3">
            <ChecklistItem title="Create first note" done={totalNotes > 0} />
            <ChecklistItem title="Organize folders" done={totalFolders > 0} />
            <ChecklistItem title="Run FE practice" done={feSummary.attempts > 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 flex items-center gap-4">
      <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-violet-300">
        {icon}
      </div>
      <div>
        <div className="text-xs text-zinc-400 tracking-widest">{label}</div>
        <div className="text-3xl font-semibold text-white mt-1">{value}</div>
      </div>
    </div>
  );
}

function ChecklistItem({ title, done }: { title: string; done: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full"
        style={{
          background: done ? 'rgba(34,197,94,0.25)' : 'rgba(113,113,122,0.2)',
          border: done ? '1px solid rgba(34,197,94,0.8)' : '1px solid rgba(113,113,122,0.6)',
        }}
      />
      <span className="text-sm" style={{ color: done ? '#e4e4e7' : '#a1a1aa' }}>
        {title}
      </span>
    </div>
  );
}