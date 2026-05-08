import { create } from 'zustand';
import { frontmatterRegistry } from '../lib/frontmatterRegistry';
import { commands } from '../lib/tauri/commands';
import { events } from '../lib/tauri/events';
import { composeNote, upsertFrontmatterField } from '../lib/tiptap/markdownParser';
import type { AiConfig, ChatMessage, McpToolExecution } from '../types/ai';
import { useEditorStore } from './editorStore';
import { useVaultStore } from './vaultStore';

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
  /** Cached AI provider name (lowercase), e.g. "ollama" or "openai". */
  aiProvider: string;
  /** Ollama endpoint URL. */
  aiEndpoint: string;
  /** Configured Ollama model name. */
  aiOllamaModel: string;
  /** Whether the configured model is installed locally (null = unknown). */
  aiModelInstalled: boolean | null;
  /** List of locally available model names. */
  models: string[];
  sendMessage: (content: string, noteContext?: string, modelOverride?: string) => Promise<void>;
  /** Cancel the in-flight stream. Safe to call when no stream is active. */
  cancelStream: () => Promise<void>;
  togglePanel: () => void;
  clearChat: () => void;
  /**
   * Single combined refresh: fetches config + checks connectivity + lists models.
   * All AI status state is written atomically. Prefer this over calling
   * checkConnection/fetchConfig separately to avoid redundant round-trips.
   */
  refreshAiStatus: () => Promise<void>;
  /** @deprecated Use refreshAiStatus instead. */
  checkConnection: () => Promise<void>;
  /** @deprecated Use refreshAiStatus instead. */
  fetchConfig: () => Promise<void>;
  updateConfig: (vaultPath: string, config: AiConfig) => Promise<void>;
  setIncludeNoteContext: (v: boolean) => void;
  /** Write ai_model into the frontmatter of the active note and save. */
  pinModelToNote: (model: string | null) => Promise<void>;
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
  aiProvider: '',
  aiEndpoint: '',
  aiOllamaModel: '',
  aiModelInstalled: null,
  models: [],

  sendMessage: async (content: string, noteContext?: string, modelOverride?: string) => {
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
        const reply = await commands.aiChat(content, noteContext, modelOverride);
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
    let finalized = false;
    let finalizeAll = () => {};

    // Subscribe to streaming events BEFORE invoking the command so no chunks
    // are missed.
    // Collect listeners so partial registration can be rolled back on error.
    const listeners: Array<() => void> = [];
    try {
      listeners.push(
        await events.onChatStreamChunk((payload) => {
          if (payload.stream_id !== streamId) return;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsgId ? { ...m, content: m.content + payload.content } : m,
            ),
          }));
        }),
      );

      listeners.push(
        await events.onChatStreamDone((payload) => {
          if (payload.stream_id !== streamId) return;
          finalizeAll();
        }),
      );

      listeners.push(
        await events.onChatStreamCancelled((payload) => {
          if (payload.stream_id !== streamId) return;
          // Preserve the partial message — just stop loading.
          finalizeAll();
        }),
      );
    } catch (listenerErr) {
      // At least one listener registration failed — clean up any that succeeded.
      for (const fn of listeners) fn();
      const errorContent =
        typeof listenerErr === 'string'
          ? listenerErr
          : 'ScribeAI: Failed to register stream listeners.';
      set((s) => ({
        messages: s.messages.map((m) => (m.id === assistantMsgId ? { ...m, content: errorContent } : m)),
        isLoading: false,
        activeTools: [],
        currentStreamId: null,
      }));
      return;
    }

    // Now that all handles are available, wire up the real finalizer.
    // Guard flag prevents double-call when both the command promise resolves
    // and the stream-done event fire in quick succession.
    finalizeAll = () => {
      if (finalized) return;
      finalized = true;
      for (const fn of listeners) fn();
      set({ isLoading: false, activeTools: [], currentStreamId: null });
    };

    try {
      await commands.aiChatStream(streamId, content, noteContext, modelOverride);
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

  refreshAiStatus: async () => {
    try {
      const config = await commands.aiGetConfig();
      const provider = (config.provider ?? '').toLowerCase();
      const endpoint = config.ollama?.endpoint ?? '';
      const ollamaModel = config.ollama?.model ?? '';
      const chatModel = config.model_routing?.chat ?? '';

      let isConnected = false;
      let aiModelInstalled: boolean | null = null;
      let models: string[] = [];

      if (provider === 'ollama') {
        try {
          isConnected = await commands.aiCheckConnection();
          if (isConnected) {
            models = await commands.aiListModels();
            const base = ollamaModel.toLowerCase();
            aiModelInstalled = models.some((m) => m.toLowerCase().startsWith(base));
          }
        } catch {
          isConnected = false;
        }
      } else {
        // Non-Ollama providers (OpenAI, etc.) don't need a local connectivity probe.
        isConnected = true;
      }

      set({
        model: chatModel || provider,
        isConnected,
        aiProvider: provider,
        aiEndpoint: endpoint,
        aiOllamaModel: ollamaModel,
        aiModelInstalled,
        models,
      });
    } catch {
      set({ isConnected: false });
    }
  },

  checkConnection: async () => {
    await get().refreshAiStatus();
  },

  fetchConfig: async () => {
    await get().refreshAiStatus();
  },

  updateConfig: async (vaultPath: string, config: AiConfig) => {
    await commands.aiUpdateConfig(vaultPath, config);
    const modelName = config.model_routing.chat;
    set({ model: modelName });
  },

  pinModelToNote: async (model: string | null) => {
    const { vaultPath, activeNotePath } = useVaultStore.getState();
    if (!vaultPath || !activeNotePath) return;

    // Update frontmatter in the registry (single source of truth).
    const currentFm = frontmatterRegistry.get(activeNotePath);
    const updatedFm = upsertFrontmatterField(currentFm, 'ai_model', model);
    frontmatterRegistry.set(activeNotePath, updatedFm);

    // Update the in-memory model indicator immediately.
    useEditorStore.getState().setActiveNoteAiModel(model);

    // Save the note with the patched frontmatter.
    const body = useEditorStore.getState().content;
    await commands.saveNote(vaultPath, activeNotePath, composeNote({ body, frontmatter: updatedFm }));
  },
}));

export { TOOL_LABELS };
