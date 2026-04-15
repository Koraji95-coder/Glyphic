import { create } from 'zustand';
import { ChatMessage, AiConfig } from '../types/ai';
import { commands } from '../lib/tauri/commands';

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  isConnected: boolean | null;
  model: string;
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

  sendMessage: async (content: string, noteContext?: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true }));

    try {
      const reply = await commands.aiChat(content, noteContext);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, assistantMsg], isLoading: false }));
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: typeof err === 'string' ? err : 'ScribeAI: Something went wrong. Please check your AI settings.',
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errorMsg], isLoading: false }));
    }
  },

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

  clearChat: () => set({ messages: [] }),

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
      const modelName = config.provider === 'ollama' ? config.ollama.model : config.openai.model;
      set({ model: modelName });
    } catch {
      // Keep the current model label if fetching fails.
    }
  },

  updateConfig: async (config: AiConfig) => {
    await commands.aiUpdateConfig(config);
    const modelName = config.provider === 'ollama' ? config.ollama.model : config.openai.model;
    set({ model: modelName });
  },
}));
