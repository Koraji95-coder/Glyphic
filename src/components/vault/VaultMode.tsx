import { Database, Search, Trash2, Upload, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { events } from '../../lib/tauri/events';
import { useLayoutStore } from '../../stores/layoutStore';

interface VaultSource {
  id: string;
  label: string;
  path?: string;
  url?: string;
  chunks: number;
}

interface QueryChunk {
  text: string;
  source_label: string;
  distance?: number;
}

interface IngestResult {
  status: string;
  source_id?: string;
  chunks?: number;
  error?: string;
}

export function VaultMode() {
  const closeVaultMode = useLayoutStore((s) => s.closeVaultMode);

  const [sources, setSources] = useState<VaultSource[]>([]);
  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState<QueryChunk[]>([]);
  const [searching, setSearching] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [ingestProgress, setIngestProgress] = useState('');
  const [ingestBusy, setIngestBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [flashcardBusy, setFlashcardBusy] = useState<string | null>(null);
  const [flashcardResult, setFlashcardResult] = useState<{ sourceId: string; cards: unknown[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ingest progress listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    events
      .onVaultIngestProgress((payload) => {
        setIngestProgress(payload.message ?? '');
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  const loadSources = useCallback(async () => {
    try {
      const result = (await commands.listVaultSources()) as { sources?: VaultSource[] };
      setSources(result?.sources ?? []);
    } catch {
      // Sidecar not running
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const ingestFile = useCallback(
    async (filePath: string) => {
      setIngestBusy(true);
      setIngestProgress('Starting…');
      try {
        await commands.ingestDocument(filePath, [], undefined);
        setIngestProgress('Done!');
        await loadSources();
      } catch (e) {
        setIngestProgress(`Error: ${String(e)}`);
      } finally {
        setIngestBusy(false);
        setTimeout(() => setIngestProgress(''), 3000);
      }
    },
    [loadSources]
  );

  const handleFilePickerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await ingestFile(file.name);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [ingestFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void ingestFile(file.name);
    },
    [ingestFile]
  );

  const handleIngestUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setIngestBusy(true);
    setIngestProgress('Fetching URL…');
    try {
      const result = (await commands.ingestUrl(urlInput.trim(), [])) as IngestResult;
      if (result?.error) {
        setIngestProgress(`Error: ${result.error}`);
      } else {
        setIngestProgress('Done!');
        setUrlInput('');
        await loadSources();
      }
    } catch (e) {
      setIngestProgress(`Error: ${String(e)}`);
    } finally {
      setIngestBusy(false);
      setTimeout(() => setIngestProgress(''), 4000);
    }
  }, [urlInput, loadSources]);

  const handleDelete = useCallback(async (sourceId: string) => {
    try {
      await commands.deleteVaultSource(sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      setQueryResults([]);
    } catch (e) {
      reportError({ context: 'Vault source delete', message: 'Failed to delete source', error: e });
    }
  }, []);

  const handleQuery = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setQueryResults([]);
    try {
      const result = (await commands.queryVault(query.trim())) as { results?: QueryChunk[] };
      setQueryResults(result?.results ?? []);
    } catch (e) {
      reportError({ context: 'Vault query', message: 'Query failed', error: e });
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleGenerateFlashcards = useCallback(async (sourceId: string) => {
    setFlashcardBusy(sourceId);
    try {
      const result = (await commands.generateFlashcards(sourceId, 5)) as { flashcards?: unknown[] };
      setFlashcardResult({ sourceId, cards: result?.flashcards ?? [] });
    } catch (e) {
      reportError({ context: 'Vault flashcard generation', message: 'Flashcard generation failed', error: e });
    } finally {
      setFlashcardBusy(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3">
          <Database className="text-blue-400" size={20} />
          <span className="text-lg font-semibold text-white">Knowledge Vault</span>
        </div>
        <button
          onClick={closeVaultMode}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Ingest Section */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6">
            <div className="text-xs font-medium text-zinc-400 tracking-widest mb-4">ADD TO VAULT</div>

            {/* Drag & Drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer mb-6 ${
                dragOver ? 'border-violet-400 bg-blue-500/5' : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <Upload size={32} className="mx-auto mb-4 text-zinc-400" />
              <p className="font-medium text-white">Drop PDF, DOCX, or image here</p>
              <p className="text-sm text-zinc-400">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFilePickerChange}
              />
            </div>

            {/* URL ingest */}
            <div className="flex gap-3">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIngestUrl()}
                placeholder="https://example.com/article"
                className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-lg px-5 py-4 text-white outline-none"
              />
              <button
                onClick={handleIngestUrl}
                disabled={ingestBusy || !urlInput.trim()}
                className="px-8 bg-blue-500 hover:bg-blue-300 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Ingest
              </button>
            </div>

            {ingestProgress && <p className="text-xs text-zinc-400 mt-3">{ingestProgress}</p>}
          </div>

          {/* Semantic Search */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6">
            <div className="text-xs font-medium text-zinc-400 tracking-widest mb-4">SEMANTIC SEARCH</div>
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                placeholder="Ask anything about your documents…"
                className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-lg px-5 py-4 text-white outline-none"
              />
              <button
                onClick={handleQuery}
                disabled={searching || !query.trim()}
                className="px-8 bg-blue-500 hover:bg-blue-300 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Search size={16} />
                Search
              </button>
            </div>

            {searching && <p className="text-xs text-zinc-400 mt-4">Searching vault…</p>}

            {queryResults.length > 0 && (
              <div className="mt-6 space-y-4">
                {queryResults.map((chunk, i) => (
                  <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-lg p-5">
                    <div className="text-xs text-blue-300 mb-2">{chunk.source_label}</div>
                    <p className="text-zinc-200 text-sm leading-relaxed">{chunk.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sources list */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-medium text-zinc-400 tracking-widest">INGESTED SOURCES ({sources.length})</div>
            </div>

            {sources.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">No documents yet. Start by ingesting something above.</div>
            ) : (
              <div className="space-y-3">
                {sources.map((src) => (
                  <div key={src.id} className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-lg px-6 py-4">
                    <div className="flex-1">
                      <div className="font-medium text-white">{src.label}</div>
                      <div className="text-xs text-zinc-400">{src.chunks} chunks</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => void handleGenerateFlashcards(src.id)}
                        disabled={flashcardBusy === src.id}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 rounded-lg text-sm font-medium"
                      >
                        <Zap size={14} />
                        {flashcardBusy === src.id ? 'Generating…' : 'Flashcards'}
                      </button>

                      <button
                        onClick={() => void handleDelete(src.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}