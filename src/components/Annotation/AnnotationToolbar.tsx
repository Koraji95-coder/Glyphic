import {
  ArrowUpRight,
  Eraser,
  Highlighter,
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

const TOOLS: { type: AnnotationToolType; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { type: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { type: 'rect', icon: Square, label: 'Rectangle' },
  { type: 'highlight', icon: Highlighter, label: 'Highlight' },
  { type: 'freehand', icon: PenTool, label: 'Freehand' },
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'eraser', icon: Eraser, label: 'Eraser' },
];

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

export function AnnotationToolbar({
  onUndo,
  onRedo,
  onSave,
  onDiscard,
  canUndo,
  canRedo,
}: {
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDiscard: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const { activeTool, setActiveTool, color, setColor, strokeWidth, setStrokeWidth } = useAnnotationStore();

  return (
    <div className="flex items-center gap-3 bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 shadow-2xl rounded-lg px-5 py-3">
      {/* Tools */}
      {TOOLS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => setActiveTool(type)}
          title={label}
          className={`p-3 rounded-lg transition-all ${
            activeTool === type ? 'bg-blue-500 text-white' : 'hover:bg-zinc-800 text-zinc-300'
          }`}
        >
          <Icon size={20} />
        </button>
      ))}

      <div className="w-px h-8 bg-zinc-700 mx-2" />

      {/* Color picker */}
      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
              c === color ? 'border-white scale-110' : 'border-zinc-600'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="w-px h-8 bg-zinc-700 mx-2" />

      {/* Stroke width */}
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="font-medium">Width</span>
        <input
          type="range"
          min={1}
          max={12}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-24 accent-violet-400"
        />
        <span className="tabular-nums w-6">{strokeWidth}</span>
      </div>

      <div className="w-px h-8 bg-zinc-700 mx-2" />

      {/* Undo / Redo */}
      <button onClick={onUndo} disabled={!canUndo} className="p-3 hover:bg-zinc-800 rounded-lg disabled:opacity-30">
        <Undo2 size={20} />
      </button>
      <button onClick={onRedo} disabled={!canRedo} className="p-3 hover:bg-zinc-800 rounded-lg disabled:opacity-30">
        <Redo2 size={20} />
      </button>

      <div className="w-px h-8 bg-zinc-700 mx-2" />

      {/* Save & Discard */}
      <button
        onClick={onSave}
        className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-300 text-white font-medium rounded-lg transition-colors"
      >
        <Save size={18} />
        Save
      </button>

      <button
        onClick={onDiscard}
        className="p-3 hover:bg-red-500/10 text-zinc-300 hover:text-red-300 rounded-lg transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
}