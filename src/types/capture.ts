export type CaptureMode = 'region' | 'window' | 'freeform' | 'fullscreen';

export interface CaptureResult {
  path: string;
  thumbnail_path: string;
  width: number;
  height: number;
  captured_at: string;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}
