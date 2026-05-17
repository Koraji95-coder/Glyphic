export type AnnotationToolType = 'arrow' | 'rect' | 'highlight' | 'freehand' | 'text' | 'crop' | 'eraser';

/** Color palette aligned with Midnight Eclipse theme */
export type AnnotationColor = 
  | '#a374f7' // Electric Violet (primary accent)
  | '#06b67f' // Cyan (secondary accent)
  | '#34d399' // Success Green
  | '#f87171' // Error Red
  | '#60a5fa' // Info Blue
  | '#fbbf24' // Warning Yellow
  | '#f97655' // Warm Accent Orange
  | '#fb923c'; // Warm Accent Light Orange

export interface AnnotationData {
  version: number;
  screenshot_id: string;
  objects: AnnotationObject[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnotationObject {
  type: AnnotationToolType;
  id: string;
  color: string;
  strokeWidth: number;
  createdAt: string;
  // Position and dimension properties
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Styling properties
  fill?: string;
  opacity?: number;
  // Text properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  backgroundColor?: string;
  // Path data for freehand
  points?: Array<{ x: number; y: number }>;
  // Metadata
  label?: string;
  tags?: string[];
}
