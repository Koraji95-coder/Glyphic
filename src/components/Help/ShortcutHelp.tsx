import { Keyboard, X } from 'lucide-react';
import { useEffect } from 'react';
import { useHelpUiStore } from '../../stores/helpUiStore';
import { ShortcutsList } from './ShortcutsList';

/**
 * Global keyboard shortcut reference modal. Triggered by Ctrl+/, Ctrl+? or
 * the Help footer button. Renders the same `ShortcutsList` used by the
 * Settings modal so the two views never disagree.
 */
export function ShortcutHelp() {
  const { isOpen, close } = useHelpUiStore();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
        style={{
          width: 'min(560px, 92vw)',
          maxHeight: '80vh',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center" style={{ gap: '8px' }}>
            <Keyboard size={16} style={{ color: 'var(--accent)' }} />
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close shortcuts help"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto" style={{ padding: '14px 18px' }}>
          <ShortcutsList />
        </div>
      </div>
    </div>
  );
}
