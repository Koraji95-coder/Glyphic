import { useEffect, useState } from 'react';
import { Download, HardDrive, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import {
  commands,
  type BackupStatusResponse,
  type BackupHistoryEntry,
  type ChangeDetectionResponse,
  type RestorePointResponse,
} from '../../lib/tauri/commands';
import { reportError } from '../../lib/errorReporter';

interface BackupStatusPanelProps {
  vaultPath: string;
}

export function BackupStatusPanel({ vaultPath }: BackupStatusPanelProps) {
  const [status, setStatus] = useState<BackupStatusResponse | null>(null);
  const [changeDetection, setChangeDetection] = useState<ChangeDetectionResponse | null>(null);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePointResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoringPointId, setRestoringPointId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load backup status on mount and every 5 seconds while backing up
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const newStatus = await commands.getBackupStatus(vaultPath);
        setStatus(newStatus);
        setIsBackingUp(newStatus.is_backing_up);
        setLoadError(null);

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

  // Load change detection
  useEffect(() => {
    const loadChangeDetection = async () => {
      try {
        const detection = await commands.detectChanges(vaultPath);
        setChangeDetection(detection);
      } catch (e) {
        // Silently fail — change detection is non-critical
      }
    };

    void loadChangeDetection();
  }, [vaultPath]);

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

  // Load restore points for restore browser
  useEffect(() => {
    const loadRestorePoints = async () => {
      try {
        const points = await commands.getRestorePoints(vaultPath, 20);
        setRestorePoints(points);
      } catch (e) {
        // Silently fail - restore browser is optional while feature is in-progress
      }
    };

    void loadRestorePoints();
  }, [vaultPath]);

  const handleBackupNow = async () => {
    setIsLoading(true);
    setLoadError(null);
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
      // Reload change detection after successful backup
      const detection = await commands.detectChanges(vaultPath);
      setChangeDetection(detection);
      const points = await commands.getRestorePoints(vaultPath, 20);
      setRestorePoints(points);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      
      // Handle "no changes" gracefully
      if (errorMessage.includes('no changes detected') || errorMessage.includes('No changes')) {
        setLoadError('No changes detected since last backup — everything is up to date! ✓');
      } else {
        setLoadError('Backup failed: ' + errorMessage);
        reportError({
          context: 'Backup execution',
          message: 'Backup failed',
          error: e,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestorePoint = async (restorePointId: string) => {
    if (!status?.dropbox_enabled) return;

    const confirmed = window.confirm(
      'Restore this backup point? Existing files with the same path will be overwritten.',
    );
    if (!confirmed) return;

    setRestoringPointId(restorePointId);
    setLoadError(null);
    try {
      const result = await commands.restoreFromPoint(vaultPath, restorePointId);
      setLoadError(`Restore completed: ${result.files_restored} file(s) restored.`);

      const detection = await commands.detectChanges(vaultPath);
      setChangeDetection(detection);
      const entries = await commands.getBackupHistory(vaultPath, 5);
      setHistory(entries);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setLoadError('Restore failed: ' + errorMessage);
      reportError({
        context: 'Backup restore',
        message: 'Restore failed',
        error: e,
      });
    } finally {
      setRestoringPointId(null);
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

        {/* Change detection summary */}
        {changeDetection && (
          <div className="bg-zinc-800/50 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              {changeDetection.has_changes ? (
                <>
                  <div className="text-amber-400 mt-1 shrink-0">→</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">Changes to Backup</div>
                    <div className="text-sm text-zinc-200 mt-1">
                      {changeDetection.notes_changed > 0 && <span>{changeDetection.notes_changed} note{changeDetection.notes_changed !== 1 ? 's' : ''}</span>}
                      {changeDetection.notes_changed > 0 && changeDetection.screenshots_changed > 0 && <span>, </span>}
                      {changeDetection.screenshots_changed > 0 && <span>{changeDetection.screenshots_changed} screenshot{changeDetection.screenshots_changed !== 1 ? 's' : ''}</span>}
                    </div>
                    {changeDetection.estimated_size_bytes > 0 && (
                      <div className="text-xs text-zinc-400 mt-1">
                        Estimated size: {formatBytes(changeDetection.estimated_size_bytes)}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-green-400 mt-1 shrink-0">✓</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">Status</div>
                    <div className="text-sm text-green-400 mt-1">Everything is backed up!</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Size warning */}
        {changeDetection?.size_warning && (
          <div className="bg-amber-950 border border-amber-700 rounded-2xl p-4 mb-6 flex gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-amber-200">Large backup detected</div>
              <div className="text-xs text-amber-300 mt-1">
                This backup exceeds 150 MB. It may take longer to upload.
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {loadError && (
          <div className="bg-emerald-950 border border-emerald-700 rounded-2xl p-4 mb-6">
            <div className="text-sm text-emerald-300">{loadError}</div>
          </div>
        )}

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

      {/* Restore point browser */}
      {restorePoints.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Restore Points</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {restorePoints.map((point) => (
              <div key={point.id} className="px-4 py-3 bg-zinc-800 rounded-2xl text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-mono text-xs">{formatDate(point.timestamp)}</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {point.notes_changed} note{point.notes_changed !== 1 ? 's' : ''}, {point.screenshots_changed} screenshot{point.screenshots_changed !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{point.files_count} total file{point.files_count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-zinc-400">{formatBytes(point.size_bytes)}</div>
                    <button
                      onClick={() => handleRestorePoint(point.id)}
                      disabled={!status.dropbox_enabled || restoringPointId === point.id}
                      className="mt-2 px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-100 rounded-xl transition-colors"
                    >
                      {restoringPointId === point.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

