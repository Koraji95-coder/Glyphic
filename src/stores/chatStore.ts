import { create } from 'zustand';
import { frontmatterRegistry } from '../lib/frontmatterRegistry';
import { commands } from '../lib/tauri/commands';
import { composeNote, upsertFrontmatterField } from '../lib/tiptap/markdownParser';
import type { AiConfig } from '../types/ai';
import { useEditorStore } from './editorStore';
import { useVaultStore } from './vaultStore';

interface ChatState {
  isOpen: boolean;
  model: string;
  includeNoteContext: boolean;
  /** Cached AI provider name (lowercase), e.g. "ollama" or "open_ai". */
  aiProvider: string;
  /** Ollama endpoint URL. Kept for the existing status banner until G4 retires it. */
  aiEndpoint: string;
  /** Configured Ollama model name. */
  aiOllamaModel: string;
  /** Whether the configured model is installed locally (null = unknown). */
  aiModelInstalled: boolean | null;
  /** List of locally available model names for model-pinning UI. */
  models: string[];
  isConnected: boolean | null;
  togglePanel: () => void;
  /**
   * Single combined refresh: fetches config + checks connectivity + lists models.
   * Kept for AiSettingsPanel/OllamaStatusBanner; chat streaming is owned by AiChatShell.
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
  isOpen: false,
  model: 'ScribeAI',
  includeNoteContext: true,
  aiProvider: '',
  aiEndpoint: '',
  aiOllamaModel: '',
  aiModelInstalled: null,
  models: [],
  isConnected: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

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
        isConnected = true;
      }

      set({
        model: chatModel || provider || 'ScribeAI',
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

    const currentFm = frontmatterRegistry.get(activeNotePath);
    const updatedFm = upsertFrontmatterField(currentFm, 'ai_model', model);
    frontmatterRegistry.set(activeNotePath, updatedFm);

    useEditorStore.getState().setActiveNoteAiModel(model);

    const body = useEditorStore.getState().content;
    await commands.saveNote(vaultPath, activeNotePath, composeNote({ body, frontmatter: updatedFm }));
  },
}));
