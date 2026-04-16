import { create } from 'zustand';
import type { AnnotationData, AnnotationToolType } from '../types/annotation';

interface AnnotationState {
  isOpen: boolean;
  imageSrc: string | null;
  annotationFilePath: string | null;
  activeTool: AnnotationToolType;
  color: string;
  strokeWidth: number;
  fontSize: number;
  annotationData: AnnotationData | null;

  openAnnotation: (imageSrc: string, annotationFilePath: string, data: AnnotationData | null) => void;
  closeAnnotation: () => void;
  setActiveTool: (tool: AnnotationToolType) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setAnnotationData: (data: AnnotationData | null) => void;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  isOpen: false,
  imageSrc: null,
  annotationFilePath: null,
  activeTool: 'arrow',
  color: '#ef4444',
  strokeWidth: 2,
  fontSize: 16,
  annotationData: null,

  openAnnotation: (imageSrc, annotationFilePath, data) =>
    set({ isOpen: true, imageSrc, annotationFilePath, annotationData: data }),
  closeAnnotation: () => set({ isOpen: false, imageSrc: null, annotationFilePath: null, annotationData: null }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setFontSize: (size) => set({ fontSize: size }),
  setAnnotationData: (data) => set({ annotationData: data }),
}));
