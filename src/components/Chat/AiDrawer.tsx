import { MessageSquare } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { ChatPanel } from './ChatPanel';

export function AiDrawer() {
  const isOpen = useChatStore((s) => s.isOpen);
  const togglePanel = useChatStore((s) => s.togglePanel);

  return (
    <>
      {/* Floating Ask AI Button (when closed) */}
      {!isOpen && (
        <button
          onClick={togglePanel}
          title="Ask AI (Ctrl+Shift+A)"
          className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 h-12 bg-gradient-to-r from-violet-600 to-cyan-400 hover:brightness-110 text-white font-semibold rounded-3xl shadow-2xl shadow-violet-500/40 transition-all active:scale-95"
        >
          <MessageSquare size={20} />
          <span>Ask AI</span>
        </button>
      )}

      {/* Drawer + Backdrop */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            onClick={togglePanel}
            className="fixed inset-0 bg-black/70 z-40"
            aria-label="Close AI drawer"
          />

          {/* Drawer */}
          <div
            className="fixed top-0 bottom-0 right-0 w-[420px] max-w-[92vw] bg-[#050507] border-l border-zinc-700 shadow-2xl z-50 flex flex-col transition-transform duration-300"
            style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
          >
            <ChatPanel />
          </div>
        </>
      )}
    </>
  );
}