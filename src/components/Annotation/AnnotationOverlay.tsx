import {
  Canvas,
  type FabricObject,
  IText,
  Line,
  PencilBrush,
  Rect,
  type TPointerEvent,
  type TPointerEventInfo,
} from 'fabric';
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAnnotations } from '../../lib/annotation/annotationIO';
import { useAnnotationStore } from '../../stores/annotationStore';
import type { AnnotationData, AnnotationObject } from '../../types/annotation';
import { AnnotationToolbar } from './AnnotationToolbar';

export function AnnotationOverlay() {
  const {
    isOpen,
    imageSrc,
    annotationFilePath,
    annotationData,
    activeTool,
    color,
    strokeWidth,
    fontSize,
    closeAnnotation,
    setAnnotationData,
  } = useAnnotationStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<FabricObject | null>(null);

  // Initialize canvas when overlay opens
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !imageSrc) return;

    const img = new Image();
    img.onload = () => {
      // Scale image to fit in viewport with padding
      const maxW = window.innerWidth * 0.85;
      const maxH = window.innerHeight * 0.75;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      setImageSize({ width: w, height: h });

      const canvas = new Canvas(canvasRef.current!, {
        width: w,
        height: h,
        isDrawingMode: false,
        selection: false,
      });
      fabricRef.current = canvas;

      // Load existing annotations
      if (annotationData?.objects?.length) {
        loadObjectsToCanvas(canvas, annotationData.objects, img.width, w);
      }

      // Save initial state for undo
      setUndoStack([JSON.stringify(canvas.toJSON())]);
      setRedoStack([]);
    };
    img.src = imageSrc;

    return () => {
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [isOpen, imageSrc, annotationData]);

  // Update drawing mode when tool changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (activeTool === 'freehand') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = strokeWidth;
    } else {
      canvas.isDrawingMode = false;
    }

    if (activeTool === 'eraser') {
      canvas.selection = true;
    } else if (activeTool !== 'freehand') {
      canvas.selection = false;
    }
  }, [activeTool, color, strokeWidth]);

  // Mouse handlers for arrow, rect, highlight, text
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (activeTool === 'freehand') return;
      const pointer = canvas.getScenePoint(opt.e);

      if (activeTool === 'eraser') {
        const target = canvas.findTarget(opt.e);
        if (target) {
          // findTarget may return a search result wrapper or a FabricObject directly
          if ('targets' in target && Array.isArray((target as { targets: FabricObject[] }).targets)) {
            const obj = (target as { targets: FabricObject[] }).targets[0];
            if (obj) {
              canvas.remove(obj);
            }
          } else {
            canvas.remove(target as unknown as FabricObject);
          }
          canvas.requestRenderAll();
          pushUndo();
        }
        return;
      }

      if (activeTool === 'text') {
        const text = new IText('Type here', {
          left: pointer.x,
          top: pointer.y,
          fontSize,
          fill: color,
          fontFamily: 'Inter, sans-serif',
          backgroundColor: 'rgba(255,255,255,0.8)',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        canvas.requestRenderAll();
        pushUndo();
        return;
      }

      drawStartRef.current = { x: pointer.x, y: pointer.y };
    };

    const handleMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (!drawStartRef.current || activeTool === 'freehand' || activeTool === 'eraser' || activeTool === 'text')
        return;
      const pointer = canvas.getScenePoint(opt.e);
      const { x: sx, y: sy } = drawStartRef.current;

      // Remove previous preview
      if (previewRef.current) {
        canvas.remove(previewRef.current);
      }

      let obj: FabricObject | null = null;

      if (activeTool === 'arrow') {
        obj = new Line([sx, sy, pointer.x, pointer.y], {
          stroke: color,
          strokeWidth,
          selectable: false,
          evented: false,
        });
      } else if (activeTool === 'rect') {
        const left = Math.min(sx, pointer.x);
        const top = Math.min(sy, pointer.y);
        obj = new Rect({
          left,
          top,
          width: Math.abs(pointer.x - sx),
          height: Math.abs(pointer.y - sy),
          stroke: color,
          strokeWidth,
          fill: 'transparent',
          selectable: false,
          evented: false,
        });
      } else if (activeTool === 'highlight') {
        const left = Math.min(sx, pointer.x);
        const top = Math.min(sy, pointer.y);
        obj = new Rect({
          left,
          top,
          width: Math.abs(pointer.x - sx),
          height: Math.abs(pointer.y - sy),
          stroke: 'transparent',
          strokeWidth: 0,
          fill: `${color}4D`, // 30% opacity
          selectable: false,
          evented: false,
        });
      }

      if (obj) {
        canvas.add(obj);
        previewRef.current = obj;
        canvas.requestRenderAll();
      }
    };

    const handleMouseUp = () => {
      if (!drawStartRef.current) return;
      drawStartRef.current = null;
      previewRef.current = null;
      pushUndo();
    };

    // Freehand path completed
    const handlePathCreated = () => {
      pushUndo();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', handleMouseDown as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:move', handleMouseMove as any);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('path:created', handlePathCreated);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('mouse:down', handleMouseDown as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off('mouse:move', handleMouseMove as any);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('path:created', handlePathCreated);
    };
  }, [activeTool, color, strokeWidth, fontSize]);

  const pushUndo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setUndoStack((prev) => [...prev, JSON.stringify(canvas.toJSON())]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || undoStack.length <= 1) return;
    const newStack = [...undoStack];
    const current = newStack.pop()!;
    setRedoStack((prev) => [...prev, current]);
    setUndoStack(newStack);
    const prev = newStack[newStack.length - 1];
    canvas
      .loadFromJSON(prev)
      .then(() => {
        canvas.requestRenderAll();
      })
      .catch((e: unknown) => {
        console.error('Undo failed:', e);
      });
  }, [undoStack]);

  const handleRedo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const state = newRedoStack.pop()!;
    setRedoStack(newRedoStack);
    setUndoStack((prev) => [...prev, state]);
    canvas
      .loadFromJSON(state)
      .then(() => {
        canvas.requestRenderAll();
      })
      .catch((e: unknown) => {
        console.error('Redo failed:', e);
      });
  }, [redoStack]);

  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !annotationFilePath) return;

    const objects = canvasToAnnotationObjects(canvas);
    const data: AnnotationData = {
      version: 1,
      screenshot_id: annotationFilePath,
      objects,
    };

    try {
      await saveAnnotations(annotationFilePath, data);
      setAnnotationData(data);
    } catch (e) {
      console.error('Failed to save annotations:', e);
    }

    closeAnnotation();
  }, [annotationFilePath, closeAnnotation, setAnnotationData]);

  const handleDiscard = useCallback(() => {
    closeAnnotation();
  }, [closeAnnotation]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === 'Escape') {
        handleDiscard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleUndo, handleRedo, handleDiscard]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        ref={containerRef}
        className="flex flex-col items-center gap-3"
        style={{ maxWidth: '90vw', maxHeight: '90vh' }}
      >
        <AnnotationToolbar
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
          onDiscard={handleDiscard}
          canUndo={undoStack.length > 1}
          canRedo={redoStack.length > 0}
        />

        <div
          className="relative"
          style={{
            width: imageSize.width || 'auto',
            height: imageSize.height || 'auto',
          }}
        >
          {/* Background image layer */}
          <img
            src={imageSrc}
            alt=""
            className="absolute inset-0 rounded"
            style={{
              width: imageSize.width,
              height: imageSize.height,
              pointerEvents: 'none',
            }}
          />
          {/* Canvas overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 rounded"
            style={{ cursor: getCursorForTool(activeTool) }}
          />
        </div>
      </div>
    </div>
  );
}

function getCursorForTool(tool: string): string {
  switch (tool) {
    case 'arrow':
    case 'rect':
    case 'highlight':
      return 'crosshair';
    case 'freehand':
      return 'crosshair';
    case 'text':
      return 'text';
    case 'eraser':
      return 'pointer';
    default:
      return 'default';
  }
}

function loadObjectsToCanvas(
  canvas: Canvas,
  objects: AnnotationObject[],
  originalWidth: number,
  canvasWidth: number,
): void {
  const scale = canvasWidth / originalWidth;
  for (const obj of objects) {
    if (obj.type === 'arrow' && obj.x1 != null && obj.y1 != null && obj.x2 != null && obj.y2 != null) {
      canvas.add(
        new Line([obj.x1 * scale, obj.y1 * scale, obj.x2 * scale, obj.y2 * scale], {
          stroke: obj.color,
          strokeWidth: obj.strokeWidth,
          selectable: false,
        }),
      );
    } else if ((obj.type === 'rect' || obj.type === 'highlight') && obj.x != null && obj.y != null) {
      canvas.add(
        new Rect({
          left: obj.x * scale,
          top: obj.y * scale,
          width: (obj.width ?? 0) * scale,
          height: (obj.height ?? 0) * scale,
          stroke: obj.type === 'highlight' ? 'transparent' : obj.color,
          strokeWidth: obj.type === 'highlight' ? 0 : obj.strokeWidth,
          fill: obj.fill ?? 'transparent',
          selectable: false,
        }),
      );
    } else if (obj.type === 'text' && obj.x != null && obj.y != null) {
      canvas.add(
        new IText(obj.text ?? '', {
          left: obj.x * scale,
          top: obj.y * scale,
          fontSize: (obj.fontSize ?? 16) * scale,
          fill: obj.color,
          fontFamily: 'Inter, sans-serif',
          backgroundColor: obj.backgroundColor ?? 'rgba(255,255,255,0.8)',
        }),
      );
    }
  }
  canvas.requestRenderAll();
}

function canvasToAnnotationObjects(canvas: Canvas): AnnotationObject[] {
  const objects: AnnotationObject[] = [];
  const items = canvas.getObjects();
  const now = new Date().toISOString();

  for (const item of items) {
    const base = {
      id: crypto.randomUUID(),
      color: (item.stroke as string) ?? '#ef4444',
      strokeWidth: item.strokeWidth ?? 2,
      createdAt: now,
    };

    if (item instanceof Line) {
      objects.push({
        ...base,
        type: 'arrow',
        x1: item.x1,
        y1: item.y1,
        x2: item.x2,
        y2: item.y2,
      });
    } else if (item instanceof Rect) {
      const isHighlight = item.stroke === 'transparent';
      objects.push({
        ...base,
        type: isHighlight ? 'highlight' : 'rect',
        x: item.left,
        y: item.top,
        width: item.width,
        height: item.height,
        fill: item.fill as string,
        color: isHighlight ? (item.fill as string) : ((item.stroke as string) ?? '#ef4444'),
      });
    } else if (item instanceof IText) {
      objects.push({
        ...base,
        type: 'text',
        x: item.left,
        y: item.top,
        text: item.text,
        fontSize: item.fontSize,
        color: item.fill as string,
        backgroundColor: item.backgroundColor as string,
      });
    } else {
      // Freehand path — serialize the path points
      const pathObj = item as FabricObject & { path?: Array<Array<number>> };
      if (pathObj.path) {
        const points = pathObj.path.filter((seg) => seg.length >= 3).map((seg) => ({ x: seg[1], y: seg[2] }));
        objects.push({
          ...base,
          type: 'freehand',
          x: item.left ?? 0,
          y: item.top ?? 0,
          color: (item.stroke as string) ?? base.color,
          points,
        });
      }
    }
  }
  return objects;
}
