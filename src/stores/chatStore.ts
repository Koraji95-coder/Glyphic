import { create } from 'zustand';
import { commands } from '../lib/tauri/commands';
import type { AiConfig, ChatMessage, McpToolExecution } from '../types/ai';

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
  sendMessage: (content: string, noteContext?: string) => Promise<void>;
  togglePanel: () => void;
  clearChat: () => void;
  checkConnection: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  updateConfig: (config: AiConfig) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  isConnected: null,
  model: 'ScribeAI',
  activeTools: [],

  sendMessage: async (content: string, noteContext?: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true, activeTools: [] }));

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

  updateConfig: async (config: AiConfig) => {
    await commands.aiUpdateConfig(config);
    const modelName = config.model_routing.chat;
    set({ model: modelName });
  },
}));

export { TOOL_LABELS };
