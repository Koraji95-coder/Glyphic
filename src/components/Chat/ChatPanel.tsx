import { ArrowLeft, Send, Settings, Square, X } from 'lucide-react';
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
    checkConnection,
    fetchConfig,
    includeNoteContext,
    setIncludeNoteContext,
  } = useChatStore();
  const activeNotePath = useVaultStore((s) => s.activeNotePath);
  const noteContent = useEditorStore((s) => s.content);
  const activeNoteTitle = activeNotePath ? (activeNotePath.split('/').pop()?.replace(/\.md$/, '') ?? null) : null;
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch config and check connection when the panel opens.
  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      checkConnection();
    }
  }, [isOpen, fetchConfig, checkConnection]);

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
    const ctx = includeNoteContext && activeNotePath ? noteContent : undefined;
    await sendMessage(text, ctx);
  }, [input, isLoading, sendMessage, includeNoteContext, activeNotePath, noteContent]);

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

  return (
    <div
      className="flex flex-col shrink-0 h-full"
      style={{
        width: isMobile ? '100%' : '360px',
        borderLeft: isMobile ? 'none' : '1px solid var(--border)',
        backgroundColor: 'var(--bg-editor)',
        position: 'relative',
        ...mobileOverlayStyle,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: 'var(--toolbar-height)',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
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
          <span
            className="text-xs"
            style={{
              padding: '1px 6px',
              borderRadius: '999px',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-ghost)',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
            }}
          >
            {model}
          </span>
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
        <div className="flex items-center" style={{ gap: '2px' }}>
          <button
            type="button"
            onClick={() => useSettingsUiStore.getState().open('ai')}
            title="AI settings"
            className="touch-target p-1.5 rounded"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Settings size={13} />
          </button>
          <button
            onClick={clearChat}
            title="Clear chat"
            className="touch-target p-1 rounded text-xs"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            Clear
          </button>
          <button
            onClick={togglePanel}
            title="Close chat"
            className="touch-target p-1.5 rounded"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {isMobile ? <ArrowLeft size={18} /> : <X size={14} />}
          </button>
        </div>
      </div>

      <OllamaStatusBanner />

      {/* Context chips */}
      <div className="flex shrink-0" style={{ gap: '3px', padding: '6px 14px' }}>
        <ContextChip label="📄 Current note" active />
        <ContextChip label="📁 Vault search" />
        <ContextChip label="📷 Screenshots" />
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
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: msg.role === 'user' ? 'var(--bg-elevated)' : 'var(--accent-gradient)',
                fontSize: '10px',
                fontWeight: 600,
                color: msg.role === 'user' ? 'var(--text-secondary)' : '#fff',
                fontFamily: msg.role === 'user' ? 'var(--font-body)' : 'var(--font-display)',
              }}
            >
              {msg.role === 'user' ? 'U' : 'G'}
            </div>
            {/* Body */}
            <div
              className="flex flex-col"
              style={{
                gap: '3px',
                maxWidth: '82%',
                minWidth: 0,
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  backgroundColor: msg.role === 'user' ? 'var(--bg-active)' : 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
                  borderBottomLeftRadius: msg.role === 'user' ? '12px' : '4px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {msg.content}
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
                    backgroundColor: 'var(--bg-elevated)',
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
          icon="📝"
          title="Summarize"
          desc="Condense note"
          onClick={() => handleQuickAction('Summarize this note for me.')}
        />
        <QuickActionCard
          icon="🃏"
          title="Flashcards"
          desc="Study cards"
          onClick={() => handleQuickAction('Generate flashcards from this note.')}
        />
        <QuickActionCard
          icon="💡"
          title="Explain"
          desc="Break down"
          onClick={() => handleQuickAction('Explain the selected text.')}
        />
        <QuickActionCard
          icon="📷"
          title="Screenshot"
          desc="Describe"
          onClick={() => handleQuickAction('Describe and explain this lecture screenshot.')}
        />
      </div>

      {/* Input area */}
      <div className="px-3 py-3 flex flex-col" style={{ borderTop: '1px solid var(--border)', gap: '4px' }}>
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
              padding: '2px 7px',
              borderRadius: '5px',
              backgroundColor: 'var(--accent-dim)',
              border: '1px solid var(--accent-dim)',
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
              padding: '2px 7px',
              borderRadius: '5px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-ghost)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              opacity: 0.6,
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
            borderRadius: '10px',
            padding: '6px 10px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border)',
            transition: 'border-color 0.2s',
          }}
        >
          <textarea
            ref={textareaRef}
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
                transition: 'all 0.15s',
              }}
            >
              <Square size={11} fill="currentColor" />
            </button>
          ) : (
            <button
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
                background: input.trim() ? 'var(--accent-gradient)' : 'var(--bg-elevated)',
                color: input.trim() ? '#fff' : 'var(--text-ghost)',
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

function ContextChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      style={{
        fontSize: '9px',
        padding: '2px 7px',
        borderRadius: '5px',
        backgroundColor: active ? 'var(--accent-dim)' : 'var(--bg-card)',
        border: `1px solid ${active ? 'var(--accent-dim)' : 'var(--border-subtle)'}`,
        color: active ? 'var(--accent)' : 'var(--text-ghost)',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
      }}
    >
      {label}
    </span>
  );
}

function QuickActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col shrink-0"
      style={{
        gap: '2px',
        padding: '8px 12px',
        minWidth: '90px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        e.currentTarget.style.borderColor = 'var(--accent-dim)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <span style={{ fontSize: '14px' }}>{icon}</span>
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
