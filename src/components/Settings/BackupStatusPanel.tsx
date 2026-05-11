import { useEffect, useState } from 'react';
import { Download, HardDrive, RefreshCw, Clock } from 'lucide-react';
import { commands, type BackupStatusResponse, type BackupHistoryEntry } from '../../lib/tauri/commands';
import { reportError } from '../../lib/errorReporter';

interface BackupStatusPanelProps {
  vaultPath: string;
}

export function BackupStatusPanel({ vaultPath }: BackupStatusPanelProps) {
  const [status, setStatus] = useState<BackupStatusResponse | null>(null);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Load backup status on mount and every 5 seconds while backing up
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const newStatus = await commands.getBackupStatus(vaultPath);
        setStatus(newStatus);
        setIsBackingUp(newStatus.is_backing_up);

        if (newStatus.is_backing_up) {
          // Poll every 2 seconds while backing up
          const timer = setTimeout(loadStatus, 2000);
          return () => clearTimeout(timer);
        }
      } catch (e) {
        reportError({
          context: 'Backup status',
          message: 'Failed to load backup status',
          error: e,
        });
      }
    };

    void loadStatus();
  }, [vaultPath, isBackingUp]);

  // Load backup history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const entries = await commands.getBackupHistory(vaultPath, 5);
        setHistory(entries);
      } catch (e) {
        // Silently fail — history is optional
      }
    };

    void loadHistory();
  }, [vaultPath]);

  const handleBackupNow = async () => {
    setIsLoading(true);
    try {
      const result = await commands.backupNow(vaultPath);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              last_backup: result,
              is_backing_up: false,
            }
          : null,
      );
    } catch (e) {
      reportError({
        context: 'Backup execution',
        message: 'Backup failed',
        error: e,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (!status) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
        <p className="text-zinc-400">Loading backup status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backup status card */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <HardDrive className="text-violet-400" size={20} />
            <h3 className="text-lg font-semibold text-white">Backup Status</h3>
          </div>
          {status.is_backing_up && <div className="animate-spin text-violet-400"><RefreshCw size={18} /></div>}
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-800 rounded-2xl p-4">
            <div className="text-xs text-zinc-400 uppercase tracking-widest">Dropbox</div>
            <div className="text-lg font-semibold text-white mt-1">
              {status.dropbox_enabled ? '✓ Connected' : '✗ Not connected'}
            </div>
          </div>
          <div className="bg-zinc-800 rounded-2xl p-4">
            <div className="text-xs text-zinc-400 uppercase tracking-widest">Status</div>
            <div className="text-lg font-semibold text-white mt-1">
              {status.is_backing_up ? 'In Progress...' : 'Ready'}
            </div>
          </div>
        </div>

        {/* Last backup info */}
        {status.last_backup && (
          <div className="bg-zinc-800/50 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock size={16} className="text-zinc-400 mt-1 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-400 uppercase tracking-widest">Last Backup</div>
                <div className="text-sm text-zinc-200 mt-1">{formatDate(status.last_backup.timestamp)}</div>
                {status.last_backup.status === 'success' && (
                  <div className="text-xs text-green-400 mt-1">
                    {status.last_backup.notes_count} notes, {status.last_backup.screenshots_count} screenshots
                    {status.last_backup.size_bytes > 0 && ` · ${formatBytes(status.last_backup.size_bytes)}`}
                  </div>
                )}
                {status.last_backup.status === 'failed' && status.last_backup.error_message && (
                  <div className="text-xs text-red-400 mt-1">{status.last_backup.error_message}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Backup action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleBackupNow}
            disabled={isLoading || isBackingUp || !status.dropbox_enabled}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-violet-500 hover:bg-violet-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-3xl font-medium transition-colors"
          >
            <Download size={16} />
            {isLoading || isBackingUp ? 'Backing up...' : 'Backup Now'}
          </button>
          <button
            disabled={!status.dropbox_enabled}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-300 rounded-3xl font-medium transition-colors"
          >
            <RefreshCw size={16} />
            Auto Sync (24h)
          </button>
        </div>
      </div>

      {/* Backup history */}
      {history.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Backup History</h3>
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 bg-zinc-800 rounded-2xl text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-mono text-xs">{formatDate(entry.timestamp)}</div>
                  <div
                    className={`text-xs mt-1 ${
                      entry.status === 'success' ? 'text-green-400' : entry.status === 'failed' ? 'text-red-400' : 'text-zinc-400'
                    }`}
                  >
                    {entry.status === 'success' ? '✓ Success' : entry.status === 'failed' ? '✗ Failed' : 'Pending'}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  {entry.size_bytes > 0 && formatBytes(entry.size_bytes)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
