export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface InkStroke {
  id: string;
  points: InkPoint[];
  color: string;
  width: number;
  tool: 'pen' | 'highlighter';
}
