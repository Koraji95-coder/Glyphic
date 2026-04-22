import { create } from 'zustand';
import { frontmatterRegistry } from '../lib/frontmatterRegistry';
import { commands } from '../lib/tauri/commands';
import { composeNote, upsertFrontmatterField } from '../lib/tiptap/markdownParser';
import type { AiConfig, ChatMessage, McpToolExecution } from '../types/ai';
import { useEditorStore } from './editorStore';
import { useVaultStore } from './vaultStore';

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
  sendMessage: (content: string, noteContext?: string, modelOverride?: string) => Promise<void>;
  togglePanel: () => void;
  clearChat: () => void;
  checkConnection: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  updateConfig: (vaultPath: string, config: AiConfig) => Promise<void>;
  setIncludeNoteContext: (v: boolean) => void;
  /** Write ai_model into the frontmatter of the active note and save. */
  pinModelToNote: (model: string | null) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  isConnected: null,
  model: 'ScribeAI',
  activeTools: [],
  includeNoteContext: true,

  sendMessage: async (content: string, noteContext?: string, modelOverride?: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true, activeTools: [] }));

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
      }));
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: typeof err === 'string' ? err : 'ScribeAI: Something went wrong. Please check your AI settings.',
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errorMsg], isLoading: false, activeTools: [] }));
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
