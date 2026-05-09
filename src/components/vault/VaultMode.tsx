import { Database, Search, Trash2, Upload, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reportError } from '../../lib/errorReporter';
import { commands } from '../../lib/tauri/commands';
import { events } from '../../lib/tauri/events';
import { useLayoutStore } from '../../stores/layoutStore';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

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

  // Subscribe to ingest progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    events
      .onVaultIngestProgress((payload) => {
        setIngestProgress(payload.message ?? '');
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // Not in Tauri
      });
    return () => unlisten?.();
  }, []);

  const loadSources = useCallback(async () => {
    try {
      const result = (await commands.listVaultSources()) as { sources?: VaultSource[] };
      setSources(result?.sources ?? []);
    } catch {
      // Sidecar not running — show empty state
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
    [loadSources],
  );

  const handleFilePickerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // In Tauri, use the file's `name` — Tauri provides the actual path via
      // dialog plugin; for the file input we use the name as a best-effort.
      await ingestFile(file.name);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [ingestFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void ingestFile(file.name);
    },
    [ingestFile],
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Knowledge Vault</span>
        </div>
        <button
          type="button"
          onClick={closeVaultMode}
          style={{
            padding: '4px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-ghost)',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Ingest panel */}
          <section>
            <SectionTitle>Add to Vault</SectionTitle>

            {/* Drag-and-drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: dragOver ? 'var(--accent-dim)' : 'var(--bg-card)',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: '12px',
              }}
            >
              <Upload
                size={28}
                style={{ color: dragOver ? 'var(--accent)' : 'var(--text-ghost)', margin: '0 auto 10px' }}
              />
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                Drop PDF, Word, or image file here
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-ghost)', margin: 0 }}>or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={handleFilePickerChange}
              />
            </div>

            {/* URL ingest */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://… (paste a URL to ingest)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleIngestUrl();
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-editor)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              />
              <PrimaryButton onClick={handleIngestUrl} disabled={ingestBusy || !urlInput.trim()}>
                Ingest
              </PrimaryButton>
            </div>

            {/* Progress indicator */}
            {ingestProgress && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>{ingestProgress}</p>
            )}
          </section>

          {/* Semantic search */}
          <section>
            <SectionTitle>Semantic Search</SectionTitle>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question or enter keywords…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleQuery();
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-editor)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              />
              <PrimaryButton onClick={handleQuery} disabled={searching || !query.trim()}>
                <Search size={14} />
                Search
              </PrimaryButton>
            </div>

            {searching && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Searching…</p>
            )}

            {queryResults.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {queryResults.map((chunk) => (
                  <div
                    key={`${chunk.source_label}:${chunk.text.slice(0, 30)}`}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {chunk.source_label}
                      {chunk.distance !== undefined && (
                        <span style={{ marginLeft: '8px', color: 'var(--text-ghost)', fontWeight: 400 }}>
                          score: {(1 - chunk.distance).toFixed(3)}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>
                      {chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {!searching && query && queryResults.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-ghost)', marginTop: '8px' }}>
                No results. Try a different query or ingest more documents.
              </p>
            )}
          </section>

          {/* Source list */}
          <section>
            <SectionTitle>Ingested Sources ({sources.length})</SectionTitle>

            {sources.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '13px' }}>
                No documents ingested yet. Drop a file or paste a URL above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sources.map((src) => (
                  <div
                    key={src.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {src.label}
                      </div>
                      {src.chunks !== undefined && (
                        <div style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>{src.chunks} chunks</div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleGenerateFlashcards(src.id)}
                      disabled={flashcardBusy === src.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid transparent',
                        backgroundColor: 'var(--accent-dim)',
                        color: 'var(--accent)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: flashcardBusy === src.id ? 'not-allowed' : 'pointer',
                        opacity: flashcardBusy === src.id ? 0.6 : 1,
                        flexShrink: 0,
                      }}
                    >
                      <Zap size={12} />
                      {flashcardBusy === src.id ? 'Generating…' : 'Flashcards'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(src.id)}
                      style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-ghost)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Remove source"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Flashcard result panel */}
          {flashcardResult && flashcardResult.cards.length > 0 && (
            <section>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}
              >
                <SectionTitle style={{ margin: 0 }}>Generated Flashcards ({flashcardResult.cards.length})</SectionTitle>
                <button
                  type="button"
                  onClick={() => setFlashcardResult(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-ghost)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(flashcardResult.cards as Array<{ question?: string; answer?: string }>).map((card) => (
                  <div
                    key={card.question ?? card.answer ?? 'card'}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                      Q: {card.question ?? '—'}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                      A: {card.answer ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text-ghost)',
        marginBottom: '10px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '8px 14px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid transparent',
        backgroundColor: disabled ? 'var(--bg-hover)' : 'var(--accent)',
        color: disabled ? 'var(--text-ghost)' : '#fff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.15s',
      }}
    >
      {children}
    </button>
  );
}
