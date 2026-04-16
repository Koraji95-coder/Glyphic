import { ArrowLeft, Bot, Camera, CreditCard, FileText, HelpCircle, Send, Settings, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TOOL_LABELS, useChatStore } from '../../stores/chatStore';
import { AiSettingsPanel } from './AiSettingsPanel';

export function ChatPanel() {
  const {
    messages,
    isOpen,
    isLoading,
    isConnected,
    model,
    activeTools,
    sendMessage,
    togglePanel,
    clearChat,
    checkConnection,
    fetchConfig,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
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

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      {/* Settings overlay */}
      {showSettings && <AiSettingsPanel onClose={() => setShowSettings(false)} />}

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
          <Bot size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
            ScribeAI
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
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
                backgroundColor: isConnected ? 'var(--color-green, #4ade80)' : 'var(--color-red, #f87171)',
                display: 'inline-block',
                flexShrink: 0,
              }}
              title={isConnected ? 'AI connected' : 'AI not connected'}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(true)}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot size={32} style={{ color: 'var(--accent-dim)', opacity: 0.5 }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Ask ScribeAI anything about your notes
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className="rounded-lg px-3 py-2 text-sm max-w-[85%]"
              style={{
                backgroundColor: msg.role === 'user' ? 'var(--bg-active)' : 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                lineHeight: 1.55,
                fontFamily: 'var(--font-body)',
              }}
            >
              {msg.content}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col items-start gap-1.5">
            {/* MCP tool execution indicator pills */}
            {activeTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {activeTools.map((tool, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--accent-dim)',
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {TOOL_LABELS[tool.toolName] ?? `⚙️ ${tool.toolName}...`}
                  </span>
                ))}
              </div>
            )}
            {/* Typing dots */}
            <div className="flex items-start gap-2">
              <div
                className="rounded-lg px-3 py-2.5 flex gap-1 items-center"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <span
                  className="typing-dot w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--accent)', display: 'inline-block' }}
                />
                <span
                  className="typing-dot w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--accent)', display: 'inline-block' }}
                />
                <span
                  className="typing-dot w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--accent)', display: 'inline-block' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => handleQuickAction('Summarize this note for me.')}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-input)')}
        >
          <FileText size={10} />
          Summarize
        </button>
        <button
          onClick={() => handleQuickAction('Generate flashcards from this note.')}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-input)')}
        >
          <CreditCard size={10} />
          Flashcards
        </button>
        <button
          onClick={() => handleQuickAction('Explain the selected text.')}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-input)')}
        >
          <HelpCircle size={10} />
          Explain
        </button>
        <button
          onClick={() => handleQuickAction('Describe and explain this lecture screenshot.')}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-input)')}
        >
          <Camera size={10} />
          Screenshot
        </button>
      </div>

      {/* Input area */}
      <div className="px-3 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="flex items-end gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ScribeAI anything about your notes..."
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-sm"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
              maxHeight: '120px',
              overflowY: 'auto',
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-1.5 rounded transition-colors shrink-0"
            style={{
              backgroundColor: input.trim() && !isLoading ? 'var(--accent)' : 'var(--bg-elevated)',
              color: input.trim() && !isLoading ? 'var(--bg-app)' : 'var(--text-ghost)',
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
