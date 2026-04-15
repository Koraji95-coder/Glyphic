export type AnnotationToolType = 'arrow' | 'rect' | 'highlight' | 'freehand' | 'text' | 'crop' | 'eraser';

export interface AnnotationData {
  version: number;
  screenshot_id: string;
  objects: AnnotationObject[];
}

export interface AnnotationObject {
  type: AnnotationToolType;
  id: string;
  color: string;
  strokeWidth: number;
  createdAt: string;
  // Type-specific properties
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  backgroundColor?: string;
  points?: Array<{ x: number; y: number }>;
}
