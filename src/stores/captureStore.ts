import { create } from 'zustand';
import { CaptureMode, CaptureResult, Region } from '../types/capture';

interface CaptureState {
  isCapturing: boolean;
  captureMode: CaptureMode;
  lastRegion: Region | null;
  multiCaptureQueue: CaptureResult[];
  setCapturing: (capturing: boolean) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  setLastRegion: (region: Region) => void;
  addToQueue: (result: CaptureResult) => void;
  clearQueue: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  isCapturing: false,
  captureMode: 'region',
  lastRegion: null,
  multiCaptureQueue: [],

  setCapturing: (capturing) => set({ isCapturing: capturing }),
  setCaptureMode: (mode) => set({ captureMode: mode }),
  setLastRegion: (region) => set({ lastRegion: region }),
  addToQueue: (result) =>
    set((state) => ({
      multiCaptureQueue: [...state.multiCaptureQueue, result],
    })),
  clearQueue: () => set({ multiCaptureQueue: [] }),
}));
