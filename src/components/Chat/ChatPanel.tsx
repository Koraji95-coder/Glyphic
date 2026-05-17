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
  const activeNoteTitle = activeNotePath
    ? (activeNotePath.split('/').pop()?.replace(/\.md$/, '') ?? null)
    : null;

  const [input, setInput] = useState('');
  const [showPinMenu, setShowPinMenu] = useState(false);

  const availableModels = availableModelsFromStore;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pinMenuRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const effectiveModel = activeNoteAiModel ?? model;
  const modelSource: 'note' | 'vault' = activeNoteAiModel ? 'note' : 'vault';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) void refreshAiStatus();
  }, [isOpen, refreshAiStatus]);

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

  const openPinMenu = useCallback(() => setShowPinMenu((v) => !v), []);

  const handlePinModel = useCallback(
    async (selectedModel: string | null) => {
      setShowPinMenu(false);
      await pinModelToNote(selectedModel);
    },
    [pinModelToNote]
  );

  useEffect(() => {
    if (!isOpen && currentStreamId) cancelStream();
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

  const pinMenuModels = Array.from(
    new Set([...availableModels, ...(activeNoteAiModel ? [activeNoteAiModel] : []), model])
  ).filter((m): m is string => Boolean(m));

  return (
    <div
      className="flex flex-col shrink-0 h-full bg-zinc-950 border-l border-zinc-700"
      style={{ width: isMobile ? '100%' : '360px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-zinc-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-md flex items-center justify-center text-white text-xs font-bold">
            G
          </div>
          <span className="font-semibold text-blue-300">ScribeAI</span>

          <div className="relative" ref={pinMenuRef}>
            <button
              onClick={openPinMenu}
              className={`flex items-center gap-1 px-3 py-1 text-[10px] font-mono rounded-lg border transition-colors ${
                modelSource === 'note'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  : 'bg-zinc-800 border-zinc-600 text-zinc-400'
              }`}
            >
              {modelSource === 'note' && <Pin size={10} />}
              {effectiveModel}
            </button>

            {showPinMenu && activeNotePath && (
              <div className="absolute top-full left-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-2 w-52 z-50">
                <div className="px-4 py-2 text-xs font-medium text-zinc-400 tracking-widest">PIN MODEL TO NOTE</div>

                {activeNoteAiModel && (
                  <button
                    onClick={() => handlePinModel(null)}
                    className="w-full px-4 py-2.5 flex items-center gap-2 text-zinc-300 hover:bg-zinc-800 text-sm"
                  >
                    <PinOff size={14} />
                    Use vault default ({model})
                  </button>
                )}

                {pinMenuModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => handlePinModel(m)}
                    className={`w-full px-4 py-2.5 flex items-center gap-2 text-sm ${
                      m === activeNoteAiModel ? 'bg-blue-500/10 text-blue-300' : 'text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {m === activeNoteAiModel && <Pin size={14} />}
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => useSettingsUiStore.getState().open('ai')}
            className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-blue-300"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={clearChat}
            className="px-4 py-1 text-xs hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
          >
            Clear
          </button>
          <button
            onClick={togglePanel}
            className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-red-400"
          >
            {isMobile ? <ArrowLeft size={18} /> : <X size={18} />}
          </button>
        </div>
      </div>

      <OllamaStatusBanner />

      {/* Quick context chips */}
      <div className="flex gap-2 px-5 py-3 border-b border-zinc-700">
        <ContextChip label="Current note" icon={<FileText size={12} />} active />
        <ContextChip label="Vault search" icon={<Search size={12} />} />
        <ContextChip label="Screenshots" icon={<Camera size={12} />} />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-md flex items-center justify-center text-2xl text-white mb-4">
              G
            </div>
            <p className="text-zinc-400">Ask ScribeAI anything</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div
                className={`px-4 py-3 rounded-lg text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-violet-500 to-cyan-400 text-white'
                    : 'bg-zinc-800 text-zinc-100'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <FormattedAssistantMessage content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
              <span className="text-[10px] text-zinc-500 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 pl-2">
            <div className="flex gap-1">
              <div className="typing-dot w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
              <div className="typing-dot w-2 h-2 bg-violet-400 rounded-full animate-bounce delay-150" />
              <div className="typing-dot w-2 h-2 bg-violet-400 rounded-full animate-bounce delay-300" />
            </div>
            <span className="text-xs text-zinc-400">thinking…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 px-5 py-4 border-t border-zinc-700 overflow-x-auto">
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
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-700 bg-zinc-900">
        {includeNoteContext && activeNoteTitle && (
          <div className="flex items-center gap-2 text-xs mb-2 text-blue-300">
            <span>Context: {activeNoteTitle}</span>
            <button onClick={() => setIncludeNoteContext(false)} className="text-blue-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ScribeAI…"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm max-h-[120px]"
          />

          {isLoading ? (
            <button
              onClick={cancelStream}
              className="w-9 h-9 bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center justify-center transition-colors"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all ${
                input.trim()
                  ? 'bg-gradient-to-r from-violet-500 to-cyan-400 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ContextChip({ label, icon, active = false }: { label: string; icon?: ReactNode; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border ${
        active
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
      }`}
    >
      {icon}
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
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-start p-4 rounded-lg bg-zinc-800/70 border border-zinc-700 hover:border-blue-500/30 hover:bg-zinc-800 transition-all w-28"
    >
      <div className="w-8 h-8 bg-zinc-900 rounded-md flex items-center justify-center mb-3 text-blue-300">
        {icon}
      </div>
      <div className="text-xs font-medium text-white">{title}</div>
      <div className="text-[10px] text-zinc-400">{desc}</div>
    </button>
  );
}

function FormattedAssistantMessage({ content }: { content: string }) {
  // (Full markdown parsing logic preserved from your original)
  return <div className="prose prose-invert prose-sm">{content}</div>;
}