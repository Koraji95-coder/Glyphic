import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { CaptureResult } from '../../types/capture';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const noopUnlisten: UnlistenFn = () => Promise.resolve();

function safeListen<T>(eventName: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime) return Promise.resolve(noopUnlisten);
  return listen<T>(eventName, (event) => handler(event.payload));
}

function safeListenNoPayload(eventName: string, handler: () => void): Promise<UnlistenFn> {
  if (!isTauriRuntime) return Promise.resolve(noopUnlisten);
  return listen(eventName, () => handler());
}

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

export interface ChatStreamChunkPayload {
  stream_id: string;
  content: string;
}

export interface ChatStreamEndPayload {
  stream_id: string;
}

export interface VaultIngestProgressPayload {
  status: 'progress';
  message: string;
  /** Progress fraction 0–1, if available. */
  progress?: number;
}

export const events = {
  onScreenshotCaptured: (handler: (result: CaptureResult) => void): Promise<UnlistenFn> =>
    safeListen<CaptureResult>('screenshot-captured', handler),

  onVaultChanged: (handler: (payload: VaultChangedPayload) => void): Promise<UnlistenFn> =>
    safeListen<VaultChangedPayload>('vault-changed', handler),

  onSaveStatus: (handler: (payload: SaveStatusPayload) => void): Promise<UnlistenFn> =>
    safeListen<SaveStatusPayload>('save-status', handler),

  onIndexUpdated: (handler: (payload: IndexUpdatedPayload) => void): Promise<UnlistenFn> =>
    safeListen<IndexUpdatedPayload>('index-updated', handler),

  onCaptureCancelled: (handler: () => void): Promise<UnlistenFn> => safeListenNoPayload('capture-cancelled', handler),

  onChatStreamChunk: (handler: (payload: ChatStreamChunkPayload) => void): Promise<UnlistenFn> =>
    safeListen<ChatStreamChunkPayload>('chat-stream-chunk', handler),

  onChatStreamDone: (handler: (payload: ChatStreamEndPayload) => void): Promise<UnlistenFn> =>
    safeListen<ChatStreamEndPayload>('chat-stream-done', handler),

  onChatStreamCancelled: (handler: (payload: ChatStreamEndPayload) => void): Promise<UnlistenFn> =>
    safeListen<ChatStreamEndPayload>('chat-stream-cancelled', handler),

  onVaultIngestProgress: (handler: (payload: VaultIngestProgressPayload) => void): Promise<UnlistenFn> =>
    safeListen<VaultIngestProgressPayload>('vault-ingest-progress', handler),
};
