import {
  ArrowLeft,
  Camera,
  FileText,
  GraduationCap,
  Lightbulb,
  Pin,
  PinOff,
  Search,
  Send,
  Settings,
  Square,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TOOL_LABELS, useChatStore } from '../../stores/chatStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsUiStore } from '../../stores/settingsUiStore';
import { useVaultStore } from '../../stores/vaultStore';
import { OllamaStatusBanner } from './OllamaStatusBanner';

export function ChatPanel() {
  const {
    messages,
    isOpen,
    isLoading,
    isConnected,
    model,
    activeTools,
    currentStreamId,
    sendMessage,
    cancelStream,
    togglePanel,
    clearChat,
    refreshAiStatus,
    models: availableModelsFromStore,
    includeNoteContext,
    setIncludeNoteContext,
    pinModelToNote,
  } = useChatStore();
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const activeNoteAiModel = useEditorStore((s) => s.activeNoteAiModel);
  const activeNoteTitle = activeNotePath ? (activeNotePath.split('/').pop()?.replace(/\.md$/, '') ?? null) : null;
  const [input, setInput] = useState('');
  const [showPinMenu, setShowPinMenu] = useState(false);
  // Available models come from the store (populated by refreshAiStatus).
  const availableModels = availableModelsFromStore;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pinMenuRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Effective model: per-note override takes precedence over the global default.
  const effectiveModel = activeNoteAiModel ?? model;
  const modelSource: 'note' | 'vault' = activeNoteAiModel ? 'note' : 'vault';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Single combined refresh when the panel opens — avoids duplicate Ollama calls.
  useEffect(() => {
    if (isOpen) {
      void refreshAiStatus();
    }
  }, [isOpen, refreshAiStatus]);

  // Close pin menu on outside click.
  useEffect(() => {
    if (!showPinMenu) return;
    const handler = (e: MouseEvent) => {
      if (pinMenuRef.current && !pinMenuRef.current.contains(e.target as Node)) {
        setShowPinMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPinMenu]);

  const openPinMenu = useCallback(() => {
    setShowPinMenu((v) => !v);
  }, []);

  const handlePinModel = useCallback(
    async (selectedModel: string | null) => {
      setShowPinMenu(false);
      await pinModelToNote(selectedModel);
    },
    [pinModelToNote],
  );

  // Cancel any in-flight stream when the panel closes (navigate away).
  useEffect(() => {
    if (!isOpen && currentStreamId) {
      cancelStream();
    }
  }, [isOpen, currentStreamId, cancelStream]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    const ctx = includeNoteContext && activeNotePath ? useEditorStore.getState().content : undefined;
    await sendMessage(text, ctx, activeNoteAiModel ?? undefined);
  }, [input, isLoading, sendMessage, includeNoteContext, activeNotePath, activeNoteAiModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Escape cancels an in-flight stream while focus is in the textarea.
    if (e.key === 'Escape' && isLoading) {
      e.preventDefault();
      cancelStream();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  if (!isOpen) return null;

  const mobileOverlayStyle = isMobile
    ? {
        position: 'fixed' as const,
        inset: 0,
        zIndex: 60,
        width: '100%',
        height: '100%',
      }
    : {};

  // Decide which models to show in the pin dropdown. Always include current
  // pinned model (if any) and current global default so the list isn't empty.
  const pinMenuModels = Array.from(
    new Set([...availableModels, ...(activeNoteAiModel ? [activeNoteAiModel] : []), model]),
  ).filter((m): m is string => m !== null && m !== undefined && m.length > 0);

  return (
    <div
      className="flex flex-col shrink-0 h-full"
      style={{
        width: isMobile ? '100%' : '360px',
        borderLeft: isMobile ? 'none' : '1px solid var(--glass-border)',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), var(--glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: '-24px 0 48px rgba(0,0,0,0.18)',
        position: 'relative',
        ...mobileOverlayStyle,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: 'var(--toolbar-height)',
          borderBottom: '1px solid var(--glass-border)',
          backgroundColor: 'transparent',
        }}
      >
        <div className="flex items-center gap-2">
          {/* AI Avatar */}
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'var(--accent-gradient)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#fff',
              fontFamily: 'var(--font-display)',
            }}
          >
            G
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
            ScribeAI
          </span>
          {/* Model badge — shows effective model with source hint */}
          <div style={{ position: 'relative' }} ref={pinMenuRef}>
            <button
              type="button"
              onClick={() => void openPinMenu()}
              title={
                modelSource === 'note'
                  ? `Using ${effectiveModel} (pinned to note) — click to change`
                  : `Using ${effectiveModel} (vault default) — click to pin a model to this note`
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: modelSource === 'note' ? 'rgba(163,116,247,0.16)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${modelSource === 'note' ? 'rgba(163,116,247,0.22)' : 'var(--glass-border)'}`,
                color: modelSource === 'note' ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                cursor: 'pointer',
              }}
            >
              {modelSource === 'note' && <Pin size={8} />}
              {effectiveModel}
            </button>

            {/* Pin model dropdown */}
            {showPinMenu && activeNotePath && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'rgba(14,11,26,0.92)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  padding: '4px',
                  zIndex: 50,
                  minWidth: '180px',
                  boxShadow: '0 18px 36px rgba(0,0,0,0.34)',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    padding: '4px 8px 6px',
                    fontSize: '9px',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-ghost)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Pin model to note
                </span>
                {/* Clear pin option */}
                {activeNoteAiModel && (
                  <button
                    type="button"
                    onClick={() => void handlePinModel(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <PinOff size={11} />
                    Use vault default ({model})
                  </button>
                )}
                {/* Model list */}
                {pinMenuModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => void handlePinModel(m)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-body)',
                      color: m === activeNoteAiModel ? 'var(--accent)' : 'var(--text-primary)',
                      backgroundColor: m === activeNoteAiModel ? 'var(--accent-dim)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (m !== activeNoteAiModel) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        m === activeNoteAiModel ? 'var(--accent-dim)' : 'transparent';
                    }}
                  >
                    {m === activeNoteAiModel && <Pin size={10} />}
                    {m}
                  </button>
                ))}
                {pinMenuModels.length === 0 && (
                  <span
                    style={{
                      display: 'block',
                      padding: '5px 8px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-ghost)',
                    }}
                  >
                    No models found — run <code>ollama pull</code>
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Connection indicator dot */}
          {isConnected !== null && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isConnected ? 'var(--green)' : 'var(--red)',
                display: 'inline-block',
                flexShrink: 0,
              }}
              title={isConnected ? 'AI connected' : 'AI not connected'}
            />
          )}
        </div>
        <div className="flex items-center" style={{ gap: '6px' }}>
          <button
            type="button"
            onClick={() => useSettingsUiStore.getState().open('ai')}
            title="AI settings"
            className="touch-target rounded transition-colors"
            style={{
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Settings size={14} />
          </button>
          <button
            type="button"
            onClick={clearChat}
            title="Clear chat"
            className="touch-target rounded transition-colors"
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={togglePanel}
            title="Close chat"
            className="touch-target rounded transition-colors"
            style={{
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--error, #e07070)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {isMobile ? <ArrowLeft size={16} /> : <X size={16} />}
          </button>
        </div>
      </div>

      <OllamaStatusBanner />

      {/* Context chips */}
      <div className="flex shrink-0" style={{ gap: '6px', padding: '8px 14px 6px' }}>
        <ContextChip label="Current note" icon={<FileText size={10} />} active />
        <ContextChip label="Vault search" icon={<Search size={10} />} />
        <ContextChip label="Screenshots" icon={<Camera size={10} />} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 700,
                color: '#fff',
                opacity: 0.4,
                fontFamily: 'var(--font-display)',
              }}
            >
              G
            </div>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Ask ScribeAI anything about your notes
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="flex"
            style={{ gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}
          >
            {/* Avatar */}
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: msg.role === 'user' ? 'var(--bg-elevated)' : 'var(--accent-gradient)',
                fontSize: '11px',
                fontWeight: 600,
                color: msg.role === 'user' ? 'var(--text-secondary)' : '#fff',
                fontFamily: msg.role === 'user' ? 'var(--font-body)' : 'var(--font-display)',
                flexShrink: 0,
              }}
            >
              {msg.role === 'user' ? 'U' : 'G'}
            </div>
            {/* Body */}
            <div
              className="flex flex-col"
              style={{
                gap: '4px',
                maxWidth: '85%',
                minWidth: 0,
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: msg.role === 'assistant' ? '13px' : '12px',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  background: msg.role === 'user' ? 'var(--accent-warm-gradient)' : 'rgba(255,255,255,0.07)',
                  backdropFilter: msg.role === 'user' ? 'none' : 'blur(12px)',
                  WebkitBackdropFilter: msg.role === 'user' ? 'none' : 'blur(12px)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--glass-border)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  borderBottomRightRadius: msg.role === 'user' ? '3px' : '12px',
                  borderBottomLeftRadius: msg.role === 'user' ? '12px' : '3px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {msg.role === 'assistant' ? <FormattedAssistantMessage content={msg.content} /> : msg.content}
              </div>
              <span style={{ fontSize: '9px', color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col items-start gap-1.5">
            {/* MCP tool execution indicator pills */}
            {activeTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {activeTools.map((tool) => (
                  <span
                    key={tool.toolName}
                    style={{
                      fontSize: '9px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: 'var(--accent-dim)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontWeight: 500,
                      fontFamily: 'var(--font-body)',
                      border: '1px solid rgba(163,116,247,0.22)',
                    }}
                  >
                    {TOOL_LABELS[tool.toolName] ?? `⚙️ ${tool.toolName}...`}
                  </span>
                ))}
              </div>
            )}
            {/* Only show typing dots while no streamed content has arrived yet */}
            {(messages.length === 0 || messages[messages.length - 1].content === '') && (
              <div className="flex items-center" style={{ gap: '8px' }}>
                <div
                  className="flex items-center"
                  style={{
                    gap: '3px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    borderBottomLeftRadius: '4px',
                  }}
                >
                  <span
                    className="typing-dot"
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    className="typing-dot"
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    className="typing-dot"
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      display: 'inline-block',
                    }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontStyle: 'italic' }}>thinking…</span>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick action cards */}
      <div
        className="flex shrink-0 overflow-x-auto"
        style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', gap: '6px' }}
      >
        <QuickActionCard
          icon={<FileText size={14} />}
          title="Summarize"
          desc="Condense note"
          onClick={() => handleQuickAction('Summarize this note for me.')}
        />
        <QuickActionCard
          icon={<GraduationCap size={14} />}
          title="Flashcards"
          desc="Study cards"
          onClick={() => handleQuickAction('Generate flashcards from this note.')}
        />
        <QuickActionCard
          icon={<Lightbulb size={14} />}
          title="Explain"
          desc="Break down"
          onClick={() => handleQuickAction('Explain the selected text.')}
        />
        <QuickActionCard
          icon={<Camera size={14} />}
          title="Screenshot"
          desc="Describe"
          onClick={() => handleQuickAction('Describe and explain this lecture screenshot.')}
        />
      </div>

      {/* Input area */}
      <div className="px-3 py-3 flex flex-col" style={{ borderTop: '1px solid var(--glass-border)', gap: '6px' }}>
        {/* Note context badge */}
        {includeNoteContext && activeNoteTitle && (
          <button
            type="button"
            onClick={() => setIncludeNoteContext(false)}
            className="inline-flex items-center gap-1"
            aria-label={`Remove note context: ${activeNoteTitle}`}
            style={{
              alignSelf: 'flex-start',
              fontSize: '9px',
              padding: '4px 9px',
              borderRadius: '999px',
              background: 'rgba(163,116,247,0.16)',
              border: '1px solid rgba(163,116,247,0.22)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
            title="Click to stop including this note as chat context"
          >
            <span>Context: {activeNoteTitle}</span>
            <span aria-hidden="true">✕</span>
          </button>
        )}
        {!includeNoteContext && activeNoteTitle && (
          <button
            type="button"
            onClick={() => setIncludeNoteContext(true)}
            className="inline-flex items-center gap-1"
            aria-label={`Add note context: ${activeNoteTitle}`}
            style={{
              alignSelf: 'flex-start',
              fontSize: '9px',
              padding: '4px 9px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              opacity: 0.84,
            }}
            title="Click to include the active note as chat context"
          >
            <span>+ Add context: {activeNoteTitle}</span>
          </button>
        )}
        <div
          className="flex items-end"
          style={{
            gap: '6px',
            borderRadius: '14px',
            padding: '8px 10px',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), rgba(255,255,255,0.04)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        >
          <textarea
            ref={textareaRef}
            id="chat-message-input"
            name="chatMessage"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ScribeAI…"
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-sm"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
              fontSize: '12px',
              minHeight: '18px',
              maxHeight: '100px',
              overflowY: 'auto',
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
            }}
          />
          {isLoading ? (
            /* Stop button — visible while a stream is in flight */
            <button
              type="button"
              onClick={cancelStream}
              title="Stop generation (Esc)"
              className="shrink-0"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--red, #e05252)',
                color: '#fff',
                boxShadow: '0 10px 24px rgba(248,113,113,0.22)',
                transition: 'all 0.15s',
              }}
            >
              <Square size={11} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                background: input.trim() ? 'var(--accent-warm-gradient)' : 'var(--bg-elevated)',
                color: input.trim() ? '#fff' : 'var(--text-ghost)',
                boxShadow: input.trim() ? '0 12px 24px rgba(249,118,85,0.24)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <Send size={12} />
            </button>
          )}
        </div>
        <div
          className="flex justify-between"
          style={{ fontSize: '9px', color: 'var(--text-ghost)', paddingTop: '2px' }}
        >
          <span>
            <kbd
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '8px',
                padding: '0 3px',
                borderRadius: '2px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}
            >
              Enter
            </kbd>{' '}
            send ·{' '}
            <kbd
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '8px',
                padding: '0 3px',
                borderRadius: '2px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}
            >
              Shift+Enter
            </kbd>{' '}
            newline
            {isLoading && (
              <>
                {' · '}
                <kbd
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '8px',
                    padding: '0 3px',
                    borderRadius: '2px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Esc
                </kbd>{' '}
                stop
              </>
            )}
          </span>
          <span>⌘⇧A</span>
        </div>
      </div>
    </div>
  );
}

function ContextChip({ label, icon, active }: { label: string; icon?: ReactNode; active?: boolean }) {
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '4px 8px',
        borderRadius: '999px',
        background: active ? 'rgba(163,116,247,0.14)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'rgba(163,116,247,0.22)' : 'var(--glass-border)'}`,
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let remaining = text;
  let offset = 0;

  // Patterns in order of precedence (longest/most specific first)
  const patterns = [
    { regex: /\*\*([^*]+)\*\*/g, type: 'bold' as const },
    { regex: /__([^_]+)__/g, type: 'bold' as const },
    { regex: /`([^`]+)`/g, type: 'code' as const },
    { regex: /\*([^*]+)\*/g, type: 'em' as const },
    { regex: /_([^_]+)_/g, type: 'em' as const },
  ];

  while (remaining.length > 0) {
    let bestMatch: { start: number; end: number; type: 'bold' | 'em' | 'code'; match: string } | null = null;

    for (const { regex, type } of patterns) {
      regex.lastIndex = 0;
      const execResult = regex.exec(remaining);
      if (execResult && (bestMatch === null || execResult.index < bestMatch.start)) {
        bestMatch = { start: execResult.index, end: regex.lastIndex, type, match: execResult[1] };
      }
    }

    if (!bestMatch) {
      parts.push(remaining);
      break;
    }

    if (bestMatch.start > 0) {
      parts.push(remaining.substring(0, bestMatch.start));
    }

    if (bestMatch.type === 'bold') {
      parts.push(<strong key={`bold-${offset}`}>{bestMatch.match}</strong>);
    } else if (bestMatch.type === 'em') {
      parts.push(<em key={`em-${offset}`}>{bestMatch.match}</em>);
    } else if (bestMatch.type === 'code') {
      parts.push(
        <code
          key={`code-${offset}`}
          style={{
            backgroundColor: 'var(--bg-app)',
            padding: '1px 4px',
            borderRadius: '2px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.9em',
          }}
        >
          {bestMatch.match}
        </code>,
      );
    }

    offset += 1;
    remaining = remaining.substring(bestMatch.end);
  }

  return <>{parts}</>;
}

function FormattedAssistantMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];
  let keyCounter = 0;

  const nextKey = () => {
    keyCounter += 1;
    return keyCounter;
  };

  const flushBullets = () => {
    if (bulletItems.length === 0) return;
    const blockKey = nextKey();
    blocks.push(
      <ul key={`ul-${blockKey}`} style={{ margin: '6px 0 6px 18px', listStyleType: 'disc' }}>
        {bulletItems.map((item) => (
          <li key={`ul-item-${blockKey}-${item}`} style={{ margin: '2px 0' }}>
            <InlineMarkdown text={item} />
          </li>
        ))}
      </ul>,
    );
    bulletItems = [];
  };

  const flushNumbered = () => {
    if (numberedItems.length === 0) return;
    const blockKey = nextKey();
    blocks.push(
      <ol key={`ol-${blockKey}`} style={{ margin: '6px 0 6px 18px', listStyleType: 'decimal' }}>
        {numberedItems.map((item) => (
          <li key={`ol-item-${blockKey}-${item}`} style={{ margin: '2px 0' }}>
            <InlineMarkdown text={item} />
          </li>
        ))}
      </ol>,
    );
    numberedItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    const bullet = line.match(/^(?:\*|-)\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);

    if (heading) {
      flushBullets();
      flushNumbered();
      const blockKey = nextKey();
      blocks.push(
        <div key={`h-${blockKey}`} style={{ marginTop: '8px', marginBottom: '4px', fontWeight: 700 }}>
          <InlineMarkdown text={heading[1]} />
        </div>,
      );
      return;
    }

    if (bullet) {
      flushNumbered();
      bulletItems.push(bullet[1]);
      return;
    }

    if (numbered) {
      flushBullets();
      numberedItems.push(numbered[1]);
      return;
    }

    flushBullets();
    flushNumbered();

    if (line.trim().length === 0) {
      blocks.push(<div key={`sp-${nextKey()}`} style={{ height: '6px' }} />);
      return;
    }

    blocks.push(
      <div key={`p-${nextKey()}`} style={{ margin: '3px 0' }}>
        <InlineMarkdown text={line} />
      </div>,
    );
  });

  flushBullets();
  flushNumbered();

  return <>{blocks}</>;
}

function QuickActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col shrink-0"
      style={{
        gap: '6px',
        padding: '10px 12px',
        minWidth: '106px',
        borderRadius: '14px',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), rgba(255,255,255,0.03)',
        border: '1px solid var(--glass-border)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background =
          'linear-gradient(180deg, rgba(249,118,85,0.14) 0%, rgba(163,116,247,0.08) 100%), rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = 'rgba(249,118,85,0.4)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,118,85,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = 'var(--glass-border)';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
      }}
    >
      <span
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--accent-warm)',
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
      <span style={{ fontSize: '9px', color: 'var(--text-ghost)', whiteSpace: 'nowrap' }}>{desc}</span>
    </button>
  );
}
