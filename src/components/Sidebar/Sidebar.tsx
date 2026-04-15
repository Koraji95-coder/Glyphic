import { useState, useRef, useCallback, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { SearchBar } from './SearchBar';
import { FileTree } from './FileTree';

export function Sidebar() {
  const settings = useSettingsStore((s) => s.settings);
  const defaultWidth = settings?.appearance?.sidebar_width ?? 280;
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
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
  }, []);

  return (
    <aside
      className="flex flex-col shrink-0 h-full relative"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <SearchBar />
      <div className="flex-1 overflow-y-auto px-1 py-1">
        <FileTree />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/30 transition-colors z-10"
      />
    </aside>
  );
}
