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

export interface FeQuestion {
  id: number;
  topic_id: number;
  type: string;
  question_text: string;
  choices: string[] | null;
  correct_answer: string;
  explanation: string | null;
  difficulty: string | null;
  bloom_level: number | null;
  estimated_time: number | null;
  handbook_section_ref: string | null;
}

export interface FeSessionTick {
  remaining_seconds: number;
  expired: boolean;
}

// ── Question Bank types ───────────────────────────────────────────────────────

export interface QuestionListItem {
  id: number;
  prompt_truncated: string;
  q_type: string;
  difficulty: string | null;
  needs_review: number;
  last_attempted: string | null;
  success_rate: number;
}

export interface QuestionDetail {
  id: number;
  topic_id: number;
  question_text: string;
  choices: string[] | null;
  correct_answer: string;
  explanation: string | null;
  q_type: string;
  difficulty: string | null;
  bloom_level: number | null;
  estimated_time: number | null;
  handbook_section_ref: string | null;
  needs_review: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface TopicWithQuestionCount {
  id: number;
  name: string;
  question_count: number;
  needs_review_count: number;
}

// ── FE reference engine types ─────────────────────────────────────────────────

export interface FormulaResult {
  id: string;
  name: string;
  formula_latex: string;
  variables: Record<string, string>;
  description: string;
  topic: string;
  handbook_page: number;
}

export interface UnitConversionResult {
  value: number;
  unit: string;
}

export interface HandbookQAResult {
  answer: string;
  citations: string[];
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

// ── Study-mode types ──────────────────────────────────────────────────────────

export interface StudySource {
  text: string;
  source_label: string;
  [key: string]: unknown;
}

export interface StudyAskResult {
  answer: string;
  sources: StudySource[];
}

export interface MathGradeResult {
  verdict: 'correct' | 'partial' | 'incorrect' | 'unknown';
  score: number;
  feedback: string;
}

export interface SolveMathResult {
  solution: string;
}

export interface GeneratedProblem {
  statement: string;
  answer: string;
}

export interface GenerateProblemsResult {
  problems: GeneratedProblem[];
}

// ── Diagram types ─────────────────────────────────────────────────────────────
export interface GeneratedDiagramCode {
  code: string;
  language: string;
  diagram_type: string;
  warnings: string[];
}

// ── Backup types ──────────────────────────────────────────────────────────────
export interface BackupHistoryEntry {
  id: string;
  timestamp: string;
  status: string;
  error_message?: string;
  dropbox_path?: string;
  size_bytes: number;
  notes_count: number;
  screenshots_count: number;
  created_at: string;
}

export interface BackupStatusResponse {
  last_backup?: BackupHistoryEntry;
  is_backing_up: boolean;
  dropbox_enabled: boolean;
}

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

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
  deleteFolder: (vaultPath: string, relativePath: string) => invoke<void>('delete_folder', { vaultPath, relativePath }),

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
  aiStudyChat: (message: string, noteContext?: string, modelOverride?: string) =>
    invoke<string>('ai_study_chat', {
      message,
      noteContext: noteContext ?? null,
      modelOverride: modelOverride ?? null,
    }),
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
  generateCode: (description: string, diagramType?: string) =>
    isTauri
      ? invoke<GeneratedDiagramCode>('generate_code', { description, diagramType: diagramType ?? null })
      : Promise.reject('Not in Tauri'),
  exportPng: (diagramType: string, code: string) =>
    isTauri ? invoke<unknown>('export_png', { diagramType, code }) : Promise.reject('Not in Tauri'),

  // FE exam prep
  listFeTopics: () => (isTauri ? invoke<FeTopic[]>('list_fe_topics') : Promise.resolve([] as FeTopic[])),
  recordFeAttempt: (
    topicId: number,
    result: string,
    timeTakenSeconds: number,
    questionId?: number | null,
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
          questionId: questionId ?? null,
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
  startFeSession: (sessionType: string, topicsCovered: string[], durationSeconds?: number) =>
    isTauri
      ? invoke<number>('start_fe_session', {
          sessionType,
          topicsCovered,
          durationSeconds: durationSeconds ?? null,
        })
      : Promise.resolve(0),
  completeFeSession: (sessionId: number, totalQuestions: number, correct: number) =>
    isTauri ? invoke<void>('complete_fe_session', { sessionId, totalQuestions, correct }) : Promise.resolve(),
  tickSession: (sessionId: number) =>
    isTauri
      ? invoke<FeSessionTick>('tick_session', { sessionId })
      : Promise.resolve({ remaining_seconds: 0, expired: false }),
  takeBreak: (sessionId: number) =>
    isTauri ? invoke<FeSessionTick>('take_break', { sessionId }) : Promise.reject('Not in Tauri'),
  seedQuestionBank: () => (isTauri ? invoke<number>('seed_question_bank') : Promise.resolve(0)),
  getQuestionForSession: (topicId: number, excludeRecentIds: number[]) =>
    isTauri
      ? invoke<FeQuestion | null>('get_question_for_session', { topicId, excludeRecentIds })
      : Promise.resolve(null),

  // Question Bank management
  listTopicsWithQuestionCounts: () =>
    isTauri
      ? invoke<TopicWithQuestionCount[]>('list_topics_with_question_counts')
      : Promise.resolve([] as TopicWithQuestionCount[]),
  listQuestionsByTopic: (topicId: number) =>
    isTauri ? invoke<QuestionListItem[]>('list_questions_by_topic', { topicId }) : Promise.resolve([]),
  getQuestionDetail: (questionId: number) =>
    isTauri ? invoke<QuestionDetail>('get_question_detail', { questionId }) : Promise.reject('Not in Tauri'),
  addFeQuestion: (
    topicId: number,
    questionText: string,
    correctAnswer: string,
    explanation?: string,
    qType?: string,
    difficulty?: string,
    handbookSectionRef?: string,
    choices?: string[],
  ) =>
    isTauri
      ? invoke<number>('add_fe_question', {
          topicId,
          questionText,
          correctAnswer,
          explanation: explanation ?? null,
          qType: qType ?? 'numeric',
          difficulty: difficulty ?? null,
          handbookSectionRef: handbookSectionRef ?? null,
          choices: choices ?? null,
        })
      : Promise.reject('Not in Tauri'),
  updateFeQuestion: (
    questionId: number,
    questionText?: string,
    correctAnswer?: string,
    explanation?: string,
    difficulty?: string,
    handbookSectionRef?: string,
  ) =>
    isTauri
      ? invoke<void>('update_fe_question', {
          questionId,
          questionText: questionText ?? null,
          correctAnswer: correctAnswer ?? null,
          explanation: explanation ?? null,
          difficulty: difficulty ?? null,
          handbookSectionRef: handbookSectionRef ?? null,
        })
      : Promise.reject('Not in Tauri'),
  flagQuestion: (questionId: number, reason: string) =>
    isTauri ? invoke<void>('flag_question', { questionId, reason }) : Promise.reject('Not in Tauri'),
  markQuestionReviewed: (questionId: number) =>
    isTauri ? invoke<void>('mark_question_reviewed', { questionId }) : Promise.reject('Not in Tauri'),

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

  // Advanced study: grounded Q&A + math grading
  studyAsk: (question: string, topicFilter?: string[], nResults?: number, modelOverride?: string) =>
    isTauri
      ? invoke<StudyAskResult>('study_ask', {
          question,
          topicFilter: topicFilter ?? null,
          nResults: nResults ?? null,
          modelOverride: modelOverride ?? null,
        })
      : Promise.reject('Not in Tauri'),
  gradeMathAnswer: (problem: string, userAnswer: string, correctAnswer: string, modelOverride?: string) =>
    isTauri
      ? invoke<MathGradeResult>('grade_math_answer', {
          problem,
          userAnswer,
          correctAnswer,
          modelOverride: modelOverride ?? null,
        })
      : Promise.reject('Not in Tauri'),

  // Math mode: step-by-step solving + practice problem generation
  solveMath: (problem: string, modelOverride?: string) =>
    isTauri
      ? invoke<SolveMathResult>('solve_math', {
          problem,
          modelOverride: modelOverride ?? null,
        })
      : Promise.reject('Not in Tauri'),
  generateProblems: (topic: string, difficulty?: string, count?: number, modelOverride?: string) =>
    isTauri
      ? invoke<GenerateProblemsResult>('generate_problems', {
          topic,
          difficulty: difficulty ?? null,
          count: count ?? null,
          modelOverride: modelOverride ?? null,
        })
      : Promise.reject('Not in Tauri'),

  // FE reference materials (formulas, unit conversion, handbook Q&A)
  feFormulaLookup: (query: string, topic?: string) =>
    isTauri
      ? invoke<FormulaResult[]>('fe_formula_lookup', { query, topic: topic ?? null })
      : Promise.reject('Not in Tauri'),
  feUnitConvert: (value: number, fromUnit: string, toUnit: string) =>
    isTauri
      ? invoke<UnitConversionResult>('fe_unit_convert', { value, fromUnit, toUnit })
      : Promise.reject('Not in Tauri'),
  feHandbookQA: (question: string) =>
    isTauri ? invoke<HandbookQAResult>('fe_handbook_qa', { question }) : Promise.reject('Not in Tauri'),

  // Backup & Dropbox
  backupNow: (vaultPath: string) =>
    isTauri ? invoke<BackupHistoryEntry>('backup_now', { vaultPath }) : Promise.reject('Not in Tauri'),
  getBackupStatus: (vaultPath: string) =>
    isTauri ? invoke<BackupStatusResponse>('get_backup_status', { vaultPath }) : Promise.reject('Not in Tauri'),
  setDropboxToken: (vaultPath: string, token: string) =>
    isTauri ? invoke<void>('set_dropbox_token', { vaultPath, token }) : Promise.reject('Not in Tauri'),
  getBackupHistory: (vaultPath: string, limit?: number) =>
    isTauri
      ? invoke<BackupHistoryEntry[]>('get_backup_history', { vaultPath, limit: limit ?? 10 })
      : Promise.reject('Not in Tauri'),
};
