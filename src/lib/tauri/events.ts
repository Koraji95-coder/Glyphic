import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { CaptureResult } from '../../types/capture';

interface VaultChangedPayload {
  event_type: 'created' | 'modified' | 'deleted';
  path: string;
}

interface SaveStatusPayload {
  status: 'saving' | 'saved' | 'error';
  error?: string;
}

interface IndexUpdatedPayload {
  notes_count: number;
  screenshots_count: number;
}

export const events = {
  onScreenshotCaptured: (handler: (result: CaptureResult) => void): Promise<UnlistenFn> =>
    listen<CaptureResult>('screenshot-captured', (event) => handler(event.payload)),

  onVaultChanged: (handler: (payload: VaultChangedPayload) => void): Promise<UnlistenFn> =>
    listen<VaultChangedPayload>('vault-changed', (event) => handler(event.payload)),

  onSaveStatus: (handler: (payload: SaveStatusPayload) => void): Promise<UnlistenFn> =>
    listen<SaveStatusPayload>('save-status', (event) => handler(event.payload)),

  onIndexUpdated: (handler: (payload: IndexUpdatedPayload) => void): Promise<UnlistenFn> =>
    listen<IndexUpdatedPayload>('index-updated', (event) => handler(event.payload)),

  onCaptureCancelled: (handler: () => void): Promise<UnlistenFn> => listen('capture-cancelled', () => handler()),
};
