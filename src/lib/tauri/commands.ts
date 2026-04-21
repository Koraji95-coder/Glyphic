import { invoke } from '@tauri-apps/api/core';
import type { AiConfig, Flashcard } from '../../types/ai';
import type { CaptureResult, WindowInfo } from '../../types/capture';
import type { Backlink, SearchResult } from '../../types/editor';
import type { TagInfo } from '../../types/tags';
import type { NoteFile, VaultConfig, VaultEntry } from '../../types/vault';

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
  aiChat: (message: string, noteContext?: string) =>
    invoke<string>('ai_chat', { message, noteContext: noteContext ?? null }),
  aiSummarize: (noteContent: string) => invoke<string>('ai_summarize', { noteContent }),
  aiFlashcards: (noteContent: string) => invoke<Flashcard[]>('ai_flashcards', { noteContent }),
  aiExplain: (text: string) => invoke<string>('ai_explain', { text }),
  aiExplainScreenshot: (text: string) => invoke<string>('ai_explain_screenshot', { text }),
  aiCheckConnection: () => invoke<boolean>('ai_check_connection'),
  aiGetConfig: () => invoke<AiConfig>('ai_get_config'),
  aiUpdateConfig: (vaultPath: string, config: AiConfig) => invoke<void>('ai_update_config', { vaultPath, config }),
};
