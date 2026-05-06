import { invoke } from '@tauri-apps/api/core';
import type { AiConfig, Flashcard } from '../../types/ai';
import type { CaptureResult, WindowInfo } from '../../types/capture';
import type { Backlink, SearchResult } from '../../types/editor';
import type { TagInfo } from '../../types/tags';
import type { NoteFile, VaultConfig, VaultEntry } from '../../types/vault';

// ── FE prep types ─────────────────────────────────────────────────────────────
export interface FeTopic {
  id: number;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
}

export interface FeTopicStats {
  topic_id: number;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface FeWeakTopic {
  topic_id: number;
  name: string;
  category: string;
  accuracy: number;
  attempts: number;
}

// ── Flashcard SRS types ───────────────────────────────────────────────────────
export interface FlashcardReview {
  id: number;
  card_id: string;
  note_path: string;
  question: string;
  answer: string;
  rating: 'again' | 'good' | 'easy';
  reviewed_at: string;
  due_at: string;
  interval_days: number;
}

export interface FlashcardStats {
  total_cards: number;
  due_today: number;
  due_this_week: number;
  mastered: number;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const commands = {
  // Vault
  createVault: (path: string, name: string) => invoke<VaultConfig>('create_vault', { path, name }),
  openVault: (path: string) => invoke<VaultConfig>('open_vault', { path }),
  listVaultContents: (vaultPath: string) => invoke<VaultEntry[]>('list_vault_contents', { vaultPath }),
  createNote: (vaultPath: string, folder: string, title: string) =>
    invoke<NoteFile>('create_note', { vaultPath, folder, title }),
  readNote: (vaultPath: string, notePath: string) => invoke<string>('read_note', { vaultPath, notePath }),
  saveNote: (vaultPath: string, notePath: string, content: string) =>
    invoke<void>('save_note', { vaultPath, notePath, content }),
  deleteNote: (vaultPath: string, notePath: string) => invoke<void>('delete_note', { vaultPath, notePath }),
  renameNote: (vaultPath: string, oldPath: string, newName: string) =>
    invoke<NoteFile>('rename_note', { vaultPath, oldPath, newName }),
  createFolder: (vaultPath: string, relativePath: string) => invoke<void>('create_folder', { vaultPath, relativePath }),

  // Capture
  startCapture: () => invoke<void>('start_capture'),
  finishCapture: (
    mode: string,
    x: number,
    y: number,
    width: number,
    height: number,
    vaultPath: string,
    points?: [number, number][],
  ) =>
    invoke<CaptureResult>('finish_capture', {
      mode,
      x,
      y,
      width,
      height,
      vaultPath,
      points: points ?? null,
    }),
  cancelCapture: () => invoke<void>('cancel_capture'),
  repeatLastCapture: () => invoke<CaptureResult>('repeat_last_capture'),
  getWindowList: () => invoke<WindowInfo[]>('get_window_list'),
  reocrVault: (vaultPath: string) => invoke<[number, number]>('reocr_vault', { vaultPath }),
  ocrAvailable: () => invoke<boolean>('ocr_available'),

  // Search
  searchNotes: (query: string, limit?: number) => invoke<SearchResult[]>('search_notes', { query, limit: limit || 20 }),
  searchAll: (query: string, limit?: number) => invoke<SearchResult[]>('search_all', { query, limit: limit || 20 }),
  reindexVault: (vaultPath: string) => invoke<number>('reindex_vault', { vaultPath }),
  getBacklinks: (notePath: string) => invoke<Backlink[]>('get_backlinks', { notePath }),

  // Tags
  listAllTags: () => invoke<TagInfo[]>('list_all_tags'),
  tagsForNote: (notePath: string) => invoke<string[]>('tags_for_note', { notePath }),
  notesWithTag: (tag: string) => invoke<string[]>('notes_with_tag', { tag }),

  // Settings
  getSettings: (vaultPath: string) => invoke<VaultConfig>('get_settings', { vaultPath }),
  updateSettings: (vaultPath: string, settings: VaultConfig) =>
    invoke<void>('update_settings', { vaultPath, settings }),

  // App-level state (recent vaults / first-launch detection)
  getRecentVaults: () => invoke<string[]>('get_recent_vaults'),
  addRecentVault: (vaultPath: string) => invoke<string[]>('add_recent_vault', { vaultPath }),

  // Export
  exportPdf: (vaultPath: string, notePath: string, outputPath: string) =>
    invoke<void>('export_pdf', { vaultPath, notePath, outputPath }),
  exportMarkdown: (vaultPath: string, notePath: string, outputPath: string) =>
    invoke<void>('export_markdown', { vaultPath, notePath, outputPath }),

  // AI (ScribeAI)
  aiChat: (message: string, noteContext?: string, modelOverride?: string) =>
    invoke<string>('ai_chat', { message, noteContext: noteContext ?? null, modelOverride: modelOverride ?? null }),
  aiChatStream: (streamId: string, message: string, noteContext?: string, modelOverride?: string) =>
    invoke<void>('ai_chat_stream', {
      streamId,
      message,
      noteContext: noteContext ?? null,
      modelOverride: modelOverride ?? null,
    }),
  cancelChat: (streamId: string) => invoke<void>('cancel_chat', { streamId }),
  aiSummarize: (noteContent: string) => invoke<string>('ai_summarize', { noteContent }),
  aiFlashcards: (noteContent: string) => invoke<Flashcard[]>('ai_flashcards', { noteContent }),
  aiExplain: (text: string) => invoke<string>('ai_explain', { text }),
  aiExplainScreenshot: (text: string) => invoke<string>('ai_explain_screenshot', { text }),
  aiCheckConnection: () => invoke<boolean>('ai_check_connection'),
  aiListModels: () => invoke<string[]>('ai_list_models'),
  aiGetConfig: () => invoke<AiConfig>('ai_get_config'),
  aiUpdateConfig: (vaultPath: string, config: AiConfig) => invoke<void>('ai_update_config', { vaultPath, config }),
  pullModel: (model: string) => invoke<void>('pull_model', { model }),

  // Vault study / semantic search
  ingestDocument: (path: string, topicTags: string[], label?: string) =>
    isTauri
      ? invoke<unknown>('ingest_document', { path, topicTags, label: label ?? null })
      : Promise.reject('Not in Tauri'),
  ingestUrl: (url: string, topicTags: string[], label?: string) =>
    isTauri ? invoke<unknown>('ingest_url', { url, topicTags, label: label ?? null }) : Promise.reject('Not in Tauri'),
  queryVault: (question: string, topicFilter?: string[], nResults?: number) =>
    isTauri
      ? invoke<unknown>('query_vault', { question, topicFilter: topicFilter ?? null, nResults: nResults ?? null })
      : Promise.reject('Not in Tauri'),
  searchVault: (keywords: string, topicFilter?: string[]) =>
    isTauri
      ? invoke<unknown>('search_vault', { keywords, topicFilter: topicFilter ?? null })
      : Promise.reject('Not in Tauri'),
  listVaultSources: () => (isTauri ? invoke<unknown>('list_vault_sources') : Promise.reject('Not in Tauri')),
  deleteVaultSource: (sourceId: string) =>
    isTauri ? invoke<unknown>('delete_vault_source', { sourceId }) : Promise.reject('Not in Tauri'),
  generateFlashcards: (sourceId: string, n?: number) =>
    isTauri ? invoke<unknown>('generate_flashcards', { sourceId, n: n ?? null }) : Promise.reject('Not in Tauri'),

  // Diagram engine
  renderDiagram: (diagramType: string, code: string) =>
    isTauri ? invoke<unknown>('render_diagram', { diagramType, code }) : Promise.reject('Not in Tauri'),

  // FE exam prep
  listFeTopics: () => (isTauri ? invoke<FeTopic[]>('list_fe_topics') : Promise.resolve([] as FeTopic[])),
  recordFeAttempt: (
    topicId: number,
    result: string,
    timeTakenSeconds: number,
    difficulty?: string,
    problemText?: string,
    myAnswer?: string,
    correctAnswer?: string,
    explanation?: string,
  ) =>
    isTauri
      ? invoke<void>('record_fe_attempt', {
          topicId,
          result,
          timeTakenSeconds,
          difficulty: difficulty ?? null,
          problemText: problemText ?? null,
          myAnswer: myAnswer ?? null,
          correctAnswer: correctAnswer ?? null,
          explanation: explanation ?? null,
        })
      : Promise.resolve(),
  getFeStatistics: () =>
    isTauri ? invoke<FeTopicStats[]>('get_fe_statistics') : Promise.resolve([] as FeTopicStats[]),
  getWeakFeTopics: (accuracyThreshold?: number, minAttempts?: number) =>
    isTauri
      ? invoke<FeWeakTopic[]>('get_weak_fe_topics', {
          accuracyThreshold: accuracyThreshold ?? null,
          minAttempts: minAttempts ?? null,
        })
      : Promise.resolve([] as FeWeakTopic[]),
  startFeSession: (sessionType: string, topicsCovered: string[]) =>
    isTauri ? invoke<number>('start_fe_session', { sessionType, topicsCovered }) : Promise.resolve(0),
  completeFeSession: (sessionId: number, totalQuestions: number, correct: number) =>
    isTauri ? invoke<void>('complete_fe_session', { sessionId, totalQuestions, correct }) : Promise.resolve(),

  // Flashcard SRS (persistence)
  recordFlashcardReview: (
    cardId: string,
    notePath: string,
    question: string,
    answer: string,
    rating: 'again' | 'good' | 'easy',
  ) =>
    isTauri
      ? invoke<void>('record_flashcard_review', { cardId, notePath, question, answer, rating })
      : Promise.resolve(),
  getDueFlashcards: (notePath?: string, limit?: number) =>
    isTauri
      ? invoke<FlashcardReview[]>('get_due_flashcards', { notePath: notePath ?? null, limit: limit ?? null })
      : Promise.resolve([] as FlashcardReview[]),
  getFlashcardStats: () =>
    isTauri
      ? invoke<FlashcardStats>('get_flashcard_stats')
      : Promise.resolve({ total_cards: 0, due_today: 0, due_this_week: 0, mastered: 0 } as FlashcardStats),
};
