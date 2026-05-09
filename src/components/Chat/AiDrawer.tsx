import { MessageSquare } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from '../../stores/chatStore';

export function AiDrawer() {
  const isOpen = useChatStore((s) => s.isOpen);
  const togglePanel = useChatStore((s) => s.togglePanel);

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={togglePanel}
          title="Ask AI"
          className="absolute z-40 flex items-center gap-2"
          style={{
            right: '20px',
            bottom: 'calc(var(--statusbar-height) + 12px)',
            borderRadius: '999px',
            padding: '11px 15px',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            background:
              'linear-gradient(135deg, rgba(243, 115, 53, 0.95), rgba(253, 200, 48, 0.86), rgba(252, 74, 26, 0.88))',
            boxShadow: '0 14px 30px rgba(0, 0, 0, 0.28)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          <MessageSquare size={14} /> Ask AI
        </button>
      )}

      {isOpen && (
        <div className="absolute inset-0 z-30" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            aria-label="Close AI drawer"
            onClick={togglePanel}
            className="absolute inset-0"
            style={{
              border: 'none',
              padding: 0,
              margin: 0,
              background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 72%, rgba(0,0,0,0.44) 100%)',
              cursor: 'pointer',
            }}
          />
          <div
            className="absolute inset-y-0 right-0"
            style={{
              width: 'min(420px, 92vw)',
              maxWidth: '100%',
              transform: 'translateX(0)',
              transition: 'transform 180ms ease',
            }}
          >
            <ChatPanel />
          </div>
        </div>
      )}
    </>
  );
}
