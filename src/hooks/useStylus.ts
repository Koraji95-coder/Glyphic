import { useState, useEffect, useRef, useCallback } from 'react';
import type { InkPoint } from '../types/ink';

interface StylusState {
  isPenActive: boolean;
  currentPressure: number;
  pointerType: string;
  penPoints: Array<InkPoint & { timestamp: number }>;
}

export function useStylus(targetRef: React.RefObject<HTMLElement | null>) {
  const [state, setState] = useState<StylusState>({
    isPenActive: false,
    currentPressure: 0,
    pointerType: 'mouse',
    penPoints: [],
  });

  const isPenActiveRef = useRef(false);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'pen') {
      isPenActiveRef.current = true;
      setState((s) => ({
        ...s,
        isPenActive: true,
        pointerType: 'pen',
        currentPressure: e.pressure,
        penPoints: [{ x: e.offsetX, y: e.offsetY, pressure: e.pressure, timestamp: e.timeStamp }],
      }));
    } else if (e.pointerType === 'touch' && isPenActiveRef.current) {
      // Palm rejection: ignore touch when pen is active
      e.preventDefault();
      e.stopPropagation();
    } else {
      setState((s) => ({ ...s, pointerType: e.pointerType }));
    }
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch' && isPenActiveRef.current) {
      // Palm rejection
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.pointerType === 'pen' && e.buttons > 0) {
      setState((s) => ({
        ...s,
        currentPressure: e.pressure,
        penPoints: [
          ...s.penPoints,
          { x: e.offsetX, y: e.offsetY, pressure: e.pressure, timestamp: e.timeStamp },
        ],
      }));
    }
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'pen') {
      // Keep isPenActive briefly true then reset — gives palm rejection time to work
      setTimeout(() => {
        isPenActiveRef.current = false;
        setState((s) => ({ ...s, isPenActive: false, currentPressure: 0 }));
      }, 300);
    }
  }, []);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    el.addEventListener('pointerdown', handlePointerDown, { passive: false });
    el.addEventListener('pointermove', handlePointerMove, { passive: false });
    el.addEventListener('pointerup', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
    };
  }, [targetRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  const clearPoints = useCallback(() => {
    setState((s) => ({ ...s, penPoints: [] }));
  }, []);

  return { ...state, clearPoints };
}
