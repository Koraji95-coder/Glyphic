import {
  ArrowUpRight,
  Eraser,
  Highlighter,
  type MousePointer2,
  PenTool,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { useAnnotationStore } from '../../stores/annotationStore';
import type { AnnotationToolType } from '../../types/annotation';

interface AnnotationToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDiscard: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: { type: AnnotationToolType; icon: typeof MousePointer2; label: string }[] = [
  { type: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { type: 'rect', icon: Square, label: 'Rectangle' },
  { type: 'highlight', icon: Highlighter, label: 'Highlight' },
  { type: 'freehand', icon: PenTool, label: 'Freehand' },
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'eraser', icon: Eraser, label: 'Eraser' },
];

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

export function AnnotationToolbar({ onUndo, onRedo, onSave, onDiscard, canUndo, canRedo }: AnnotationToolbarProps) {
  const { activeTool, setActiveTool, color, setColor, strokeWidth, setStrokeWidth } = useAnnotationStore();

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Tool buttons */}
      {TOOLS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => setActiveTool(type)}
          title={label}
          className="p-1.5 rounded transition-colors"
          style={{
            backgroundColor: activeTool === type ? 'var(--accent-muted)' : 'transparent',
            color: activeTool === type ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          <Icon size={18} />
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-6 mx-1" style={{ backgroundColor: 'var(--border)' }} />

      {/* Color picker */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-5 h-5 rounded-full border-2 transition-transform"
            style={{
              backgroundColor: c,
              borderColor: c === color ? 'var(--accent)' : 'var(--border)',
              transform: c === color ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-6 mx-1" style={{ backgroundColor: 'var(--border)' }} />

      {/* Stroke width */}
      <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Width
        <input
          type="range"
          min={1}
          max={8}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-16 h-1 accent-current"
          style={{ accentColor: 'var(--accent)' }}
        />
      </label>

      {/* Separator */}
      <div className="w-px h-6 mx-1" style={{ backgroundColor: 'var(--border)' }} />

      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="p-1.5 rounded transition-colors disabled:opacity-30"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Undo2 size={18} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        className="p-1.5 rounded transition-colors disabled:opacity-30"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Redo2 size={18} />
      </button>

      {/* Separator */}
      <div className="w-px h-6 mx-1" style={{ backgroundColor: 'var(--border)' }} />

      {/* Save & Discard */}
      <button
        onClick={onSave}
        title="Save annotations"
        className="flex items-center gap-1 px-2.5 py-1 rounded text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'var(--accent)',
          color: '#fff',
        }}
      >
        <Save size={14} />
        Save
      </button>
      <button
        onClick={onDiscard}
        title="Discard changes (Esc)"
        className="p-1.5 rounded transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
