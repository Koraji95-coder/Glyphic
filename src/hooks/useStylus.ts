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
  // Use a mutable ref for accumulating points to avoid O(n²) spreading
  const penPointsRef = useRef<Array<InkPoint & { timestamp: number }>>([]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const el = targetRef.current;
    const rect = el?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : e.offsetX;
    const y = rect ? e.clientY - rect.top : e.offsetY;

    if (e.pointerType === 'pen') {
      isPenActiveRef.current = true;
      penPointsRef.current = [{ x, y, pressure: e.pressure, timestamp: e.timeStamp }];
      setState((s) => ({
        ...s,
        isPenActive: true,
        pointerType: 'pen',
        currentPressure: e.pressure,
        penPoints: penPointsRef.current,
      }));
    } else if (e.pointerType === 'touch' && isPenActiveRef.current) {
      // Palm rejection: ignore touch when pen is active
      e.preventDefault();
      e.stopPropagation();
    } else {
      setState((s) => ({ ...s, pointerType: e.pointerType }));
    }
  }, [targetRef]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch' && isPenActiveRef.current) {
      // Palm rejection
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.pointerType === 'pen' && e.buttons > 0) {
      const el = targetRef.current;
      const rect = el?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.offsetX;
      const y = rect ? e.clientY - rect.top : e.offsetY;

      // Push to mutable ref to avoid O(n²) spreading
      penPointsRef.current.push({ x, y, pressure: e.pressure, timestamp: e.timeStamp });
      setState((s) => ({
        ...s,
        currentPressure: e.pressure,
        penPoints: penPointsRef.current,
      }));
    }
  }, [targetRef]);

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
    penPointsRef.current = [];
    setState((s) => ({ ...s, penPoints: [] }));
  }, []);

  return { ...state, clearPoints };
}
