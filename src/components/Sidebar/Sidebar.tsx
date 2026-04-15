import { useState, useRef, useCallback, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { FileTree } from './FileTree';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLayoutStore } from '../../stores/layoutStore';

export function Sidebar() {
  const [width, setWidth] = useState(260);
  const isResizing = useRef(false);
  const isMobile = useIsMobile();
  const { isSidebarOpen, closeSidebar } = useLayoutStore();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMobile]);

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isSidebarOpen && (
          <div
            onClick={closeSidebar}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 40,
            }}
          />
        )}

        {/* Drawer */}
        <aside
          className="flex flex-col h-full"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border)',
            zIndex: 50,
            transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          <SearchBar />
          <div className="flex-1 overflow-y-auto py-1" style={{ overscrollBehavior: 'contain' }}>
            <FileTree />
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-full relative"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <SearchBar />
      <div className="flex-1 overflow-y-auto py-1">
        <FileTree />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-dim)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      />
    </aside>
  );
}
