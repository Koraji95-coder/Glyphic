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

  return (
    <div className="flex-1 overflow-y-auto p-7 bg-[#050507]">
      <div className="max-w-7xl mx-auto space-y-8">
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
          </div>

          {/* FE Prep progress */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">FE Prep Progress</h2>
              <span className="text-xs text-zinc-400">{feSummary.attempts} attempts</span>
            </div>
            <div className="space-y-6">
              {feStats.slice(0, 5).map((topic) => (
                <div key={topic.topic_id}>
                  <div className="flex justify-between text-xs text-zinc-400 mb-2">
                    <span>Topic #{topic.topic_id}</span>
                    <span>{Math.round(topic.accuracy)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-3xl overflow-hidden">
                    <div
                      className="h-2 bg-gradient-to-r from-violet-400 to-cyan-400 rounded-3xl transition-all"
                      style={{ width: `${Math.min(100, Math.round(topic.accuracy))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
          <h2 className="font-semibold text-white mb-5">Quick actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('glyphic:new-note'))}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-400 text-white rounded-3xl font-medium hover:brightness-110 transition-all"
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