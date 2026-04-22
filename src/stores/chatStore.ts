import { create } from 'zustand';
import { commands } from '../lib/tauri/commands';
import { events } from '../lib/tauri/events';
import type { AiConfig, ChatMessage, McpToolExecution } from '../types/ai';

// Detect whether we're running inside Tauri (vs plain browser dev server).
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Tool name → display label mapping for the UI indicator pills.
const TOOL_LABELS: Record<string, string> = {
  search_notes: '🔍 Searching vault...',
  get_note: '📄 Reading note...',
  list_notes: '📁 Listing notes...',
  get_recent_notes: '🕐 Getting recent notes...',
};

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  isConnected: boolean | null;
  model: string;
  activeTools: McpToolExecution[];
  includeNoteContext: boolean;
  /** ID of the currently in-flight streaming request, or null. */
  currentStreamId: string | null;
  sendMessage: (content: string, noteContext?: string) => Promise<void>;
  /** Cancel the in-flight stream. Safe to call when no stream is active. */
  cancelStream: () => Promise<void>;
  togglePanel: () => void;
  clearChat: () => void;
  checkConnection: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  updateConfig: (vaultPath: string, config: AiConfig) => Promise<void>;
  setIncludeNoteContext: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  isConnected: null,
  model: 'ScribeAI',
  activeTools: [],
  includeNoteContext: true,
  currentStreamId: null,

  sendMessage: async (content: string, noteContext?: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true, activeTools: [] }));

    // Non-Tauri environment (plain browser dev server) — fall back to the
    // synchronous non-streaming command so mock responses still work.
    if (!isTauri()) {
      try {
        const reply = await commands.aiChat(content, noteContext);
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({
          messages: [...s.messages, assistantMsg],
          isLoading: false,
          activeTools: [],
          currentStreamId: null,
        }));
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: typeof err === 'string' ? err : 'ScribeAI: Something went wrong. Please check your AI settings.',
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ messages: [...s.messages, errorMsg], isLoading: false, activeTools: [], currentStreamId: null }));
      }
      return;
    }

    // Tauri path — use the streaming command.
    const streamId = crypto.randomUUID();

    // Create a placeholder assistant message that will be filled in as chunks arrive.
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, assistantMsg],
      currentStreamId: streamId,
    }));

    // `finalizeAll` is defined via `let` so the event handlers below can
    // close over the variable reference.  The actual value is set once all
    // three unlisten handles are available.
    // eslint-disable-next-line prefer-const
    let finalizeAll = () => {};

    // Subscribe to streaming events BEFORE invoking the command so no chunks
    // are missed.
    const unlistenChunk = await events.onChatStreamChunk((payload) => {
      if (payload.stream_id !== streamId) return;
      set((s) => ({
        messages: s.messages.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + payload.content } : m)),
      }));
    });

    const unlistenDone = await events.onChatStreamDone((payload) => {
      if (payload.stream_id !== streamId) return;
      finalizeAll();
    });

    const unlistenCancelled = await events.onChatStreamCancelled((payload) => {
      if (payload.stream_id !== streamId) return;
      // Preserve the partial message — just stop loading.
      finalizeAll();
    });

    // Now that all handles are available, wire up the real finalizer.
    finalizeAll = () => {
      unlistenChunk();
      unlistenDone();
      unlistenCancelled();
      set({ isLoading: false, activeTools: [], currentStreamId: null });
    };

    try {
      await commands.aiChatStream(streamId, content, noteContext);
      // The stream-done event handler finalises state, but if the command
      // resolves before the event fires (edge case), clean up here too.
      finalizeAll();
    } catch (err) {
      // Replace the empty assistant placeholder with the error text.
      const errorContent =
        typeof err === 'string' ? err : 'ScribeAI: Something went wrong. Please check your AI settings.';
      set((s) => ({
        messages: s.messages.map((m) => (m.id === assistantMsgId ? { ...m, content: errorContent } : m)),
      }));
      finalizeAll();
    }
  },

  cancelStream: async () => {
    const { currentStreamId } = get();
    if (!currentStreamId || !isTauri()) return;
    try {
      await commands.cancelChat(currentStreamId);
    } catch {
      // Ignore — the stream may have already finished.
    }
  },

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

  clearChat: () => set({ messages: [], activeTools: [] }),

  setIncludeNoteContext: (v) => set({ includeNoteContext: v }),

  checkConnection: async () => {
    try {
      const connected = await commands.aiCheckConnection();
      set({ isConnected: connected });
    } catch {
      set({ isConnected: false });
    }
  },

  fetchConfig: async () => {
    try {
      const config = await commands.aiGetConfig();
      const modelName = config.model_routing.chat;
      set({ model: modelName });
    } catch {
      // Keep the current model label if fetching fails.
    }
  },

  updateConfig: async (vaultPath: string, config: AiConfig) => {
    await commands.aiUpdateConfig(vaultPath, config);
    const modelName = config.model_routing.chat;
    set({ model: modelName });
  },
}));

export { TOOL_LABELS };
