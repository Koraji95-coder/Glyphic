import { create } from 'zustand';
import type { CaptureMode, CaptureResult, Region } from '../types/capture';

export type CaptureDelay = 0 | 3 | 5;

interface CaptureState {
  isCapturing: boolean;
  captureMode: CaptureMode;
  lastRegion: Region | null;
  multiCaptureQueue: CaptureResult[];
  captureDelay: CaptureDelay;
  setCapturing: (capturing: boolean) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  setLastRegion: (region: Region) => void;
  addToQueue: (result: CaptureResult) => void;
  clearQueue: () => void;
  cycleDelay: () => void;
}

const delayCycle: CaptureDelay[] = [0, 3, 5];

export const useCaptureStore = create<CaptureState>((set) => ({
  isCapturing: false,
  captureMode: 'region',
  lastRegion: null,
  multiCaptureQueue: [],
  captureDelay: 0,

  setCapturing: (capturing) => set({ isCapturing: capturing }),
  setCaptureMode: (mode) => set({ captureMode: mode }),
  setLastRegion: (region) => set({ lastRegion: region }),
  addToQueue: (result) =>
    set((state) => ({
      multiCaptureQueue: [...state.multiCaptureQueue, result],
    })),
  clearQueue: () => set({ multiCaptureQueue: [] }),
  cycleDelay: () =>
    set((state) => {
      const idx = delayCycle.indexOf(state.captureDelay);
      const next = delayCycle[(idx + 1) % delayCycle.length];
      return { captureDelay: next };
    }),
}));
