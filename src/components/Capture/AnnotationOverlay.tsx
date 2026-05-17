import {
  Canvas,
  type FabricObject,
  IText,
  Line,
  PencilBrush,
  Rect,
} from 'fabric';
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAnnotations } from '../../lib/annotation/annotationIO';
import { reportError } from '../../lib/errorReporter';
import { useAnnotationStore } from '../../stores/annotationStore';
import type { AnnotationData, AnnotationObject, AnnotationColor } from '../../types/annotation';
import { AnnotationToolbar } from '../Annotation/AnnotationToolbar';

/** Midnight Eclipse theme color palette for annotations */
const THEME_COLORS: Record<string, AnnotationColor> = {
  primary: '#a374f7',
  secondary: '#06b67f',
  success: '#34d399',
  error: '#f87171',
  info: '#60a5fa',
  warning: '#fbbf24',
  warm: '#f97655',
  warmLight: '#fb923c',
};

interface ImageSize {
  width: number;
  height: number;
}

interface DrawStartPosition {
  x: number;
  y: number;
}

export function AnnotationOverlay() {
  const {
    isOpen,
    imageSrc,
    annotationFilePath,
    annotationData,
    activeTool,
    color,
    strokeWidth,
    closeAnnotation,
    setAnnotationData,
  } = useAnnotationStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 });
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const drawStartRef = useRef<DrawStartPosition | null>(null);
  const previewRef = useRef<FabricObject | null>(null);

  /**
   * Initialize Fabric.js canvas with image background
   */
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const maxW = window.innerWidth * 0.9;
      const maxH = window.innerHeight * 0.85;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      setImageSize({ width: w, height: h });

      const canvas = new Canvas(canvasRef.current!, {
        width: w,
        height: h,
        isDrawingMode: false,
        selection: false,
        backgroundColor: 'rgba(5, 5, 7, 0.8)',
      });
      fabricRef.current = canvas;

      if (annotationData?.objects?.length) {
        loadObjectsToCanvas(canvas, annotationData.objects, img.width, w);
      }

      setUndoStack([JSON.stringify(canvas.toJSON())]);
      setRedoStack([]);
      setupCanvasListeners(canvas);
    };
    img.src = imageSrc;

    return () => {
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [isOpen, imageSrc, annotationData]);

  /**
   * Configure drawing mode and brush based on active tool
   */
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
  }, [activeTool, color, strokeWidth]);

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
    void canvas.loadFromJSON(newStack[newStack.length - 1]).then(() => canvas.requestRenderAll());
  }, [undoStack]);

  const handleRedo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const state = newRedoStack.pop()!;
    setRedoStack(newRedoStack);
    setUndoStack((prev) => [...prev, state]);
    void canvas.loadFromJSON(state).then(() => canvas.requestRenderAll());
  }, [redoStack]);

  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !annotationFilePath) return;

    const objects = canvasToAnnotationObjects(canvas);
    const now = new Date().toISOString();
    const data: AnnotationData = {
      version: 1,
      screenshot_id: annotationFilePath,
      objects,
      createdAt: annotationData?.createdAt || now,
      updatedAt: now,
    };

    try {
      await saveAnnotations(annotationFilePath, data);
      setAnnotationData(data);
    } catch (e) {
      reportError({ context: 'Annotation save', message: 'Failed to save annotations', error: e });
    }

    closeAnnotation();
  }, [annotationFilePath, annotationData, closeAnnotation, setAnnotationData]);

  const handleDiscard = useCallback(() => closeAnnotation(), [closeAnnotation]);

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
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ zIndex: 99999 }}
    >
      <div className="flex flex-col items-center gap-6">
        <AnnotationToolbar
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
          onDiscard={handleDiscard}
          canUndo={undoStack.length > 1}
          canRedo={redoStack.length > 0}
        />
        <div
          className="relative rounded-lg overflow-hidden shadow-lg"
          style={{
            width: imageSize.width || 'auto',
            height: imageSize.height || 'auto',
            backgroundColor: 'var(--bg-app)',
            borderColor: 'var(--border-subtle)',
            borderWidth: '1px',
          }}
        >
          <img
            src={imageSrc}
            alt="Annotation background"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
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
  objects.forEach((obj) => {
    const fabricObj = createFabricObjectFromAnnotation(obj, scale);
    if (fabricObj) {
      canvas.add(fabricObj);
    }
  });
  canvas.requestRenderAll();
}

function createFabricObjectFromAnnotation(obj: AnnotationObject, scale: number): FabricObject | null {
  const baseProps = {
    stroke: obj.color,
    strokeWidth: obj.strokeWidth * scale,
    fill: obj.fill || 'transparent',
    opacity: obj.opacity || 1,
  };

  switch (obj.type) {
    case 'arrow':
    case 'rect': {
      if (obj.x1 !== undefined && obj.y1 !== undefined && obj.x2 !== undefined && obj.y2 !== undefined) {
        const w = Math.abs(obj.x2 - obj.x1) * scale;
        const h = Math.abs(obj.y2 - obj.y1) * scale;
        return new Rect({
          left: Math.min(obj.x1, obj.x2) * scale,
          top: Math.min(obj.y1, obj.y2) * scale,
          width: w,
          height: h,
          ...baseProps,
        });
      }
      break;
    }
    case 'text': {
      if (obj.text && obj.x !== undefined && obj.y !== undefined) {
        return new IText(obj.text, {
          left: obj.x * scale,
          top: obj.y * scale,
          fontSize: (obj.fontSize || 16) * scale,
          fontFamily: obj.fontFamily || 'DM Sans',
          fontWeight: obj.fontWeight || 400,
          fill: obj.color,
        });
      }
      break;
    }
    case 'highlight': {
      if (obj.x1 !== undefined && obj.y1 !== undefined && obj.x2 !== undefined && obj.y2 !== undefined) {
        return new Rect({
          left: Math.min(obj.x1, obj.x2) * scale,
          top: Math.min(obj.y1, obj.y2) * scale,
          width: Math.abs(obj.x2 - obj.x1) * scale,
          height: Math.abs(obj.y2 - obj.y1) * scale,
          fill: obj.color,
          opacity: 0.3,
          stroke: 'transparent',
        });
      }
      break;
    }
    case 'freehand': {
      if (obj.points && obj.points.length > 1) {
        const firstPoint = obj.points[0];
        const lastPoint = obj.points[obj.points.length - 1];
        return new Line(
          [
            firstPoint.x * scale,
            firstPoint.y * scale,
            lastPoint.x * scale,
            lastPoint.y * scale,
          ] as [number, number, number, number],
          {
            ...baseProps,
            originX: 'center',
            originY: 'center',
          },
        );
      }
      break;
    }
  }

  return null;
}

function canvasToAnnotationObjects(canvas: Canvas): AnnotationObject[] {
  const objects: AnnotationObject[] = [];
  const timestamp = new Date().toISOString();

  canvas.getObjects().forEach((obj, idx) => {
    const base: AnnotationObject = {
      type: 'rect',
      id: `obj-${idx}-${timestamp}`,
      color: (obj.stroke as string) || '#a374f7',
      strokeWidth: obj.strokeWidth || 2,
      createdAt: timestamp,
    };

    if (obj.type === 'rect') {
      const rect = obj as unknown as { left: number; top: number; width: number; height: number };
      objects.push({
        ...base,
        type: 'rect',
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        fill: obj.fill as string,
        opacity: obj.opacity,
      });
    } else if (obj.type === 'i-text' || obj.type === 'text') {
      const text = obj as unknown as IText;
      objects.push({
        ...base,
        type: 'text',
        text: text.text,
        x: text.left,
        y: text.top,
        fontSize: text.fontSize as number,
        fontFamily: text.fontFamily as string,
        fontWeight: text.fontWeight as number,
        fontStyle: text.fontStyle as string,
        color: text.fill as string,
      });
    } else if (obj.type === 'line') {
      const line = obj as unknown as Line;
      objects.push({
        ...base,
        type: 'freehand',
        x1: line.x1 as number,
        y1: line.y1 as number,
        x2: line.x2 as number,
        y2: line.y2 as number,
        points: extractPointsFromLine(line),
      });
    }
  });

  return objects;
}

function extractPointsFromLine(line: Line): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  try {
    const coords = line.getCoords();
    if (coords) {
      coords.forEach((coord) => {
        points.push({ x: coord.x, y: coord.y });
      });
    }
  } catch {
    points.push({ x: (line.x1 as number) || 0, y: (line.y1 as number) || 0 });
    points.push({ x: (line.x2 as number) || 0, y: (line.y2 as number) || 0 });
  }
  return points;
}

function setupCanvasListeners(canvas: Canvas): void {
  canvas.on('mouse:down', () => {
    // Store draw start position for shape creation
  });

  canvas.on('object:modified', () => {
    // Track modifications for undo/redo
  });

  canvas.on('object:added', () => {
    // Track additions for undo/redo
  });
}
