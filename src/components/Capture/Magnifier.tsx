import { useState, useCallback, useEffect, useRef } from 'react';

interface MagnifierProps {
  /** The background screenshot image as a data URL or src, if available. */
  screenshotSrc?: string | null;
}

/**
 * A 120×120 circular magnifier loupe that follows the cursor with 4× zoom.
 * Shows a crosshair at center and pixel coordinates below.
 * Flips to the left side when near the right edge of the screen.
 */
export function Magnifier({ screenshotSrc }: MagnifierProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 120;
  const zoom = 4;
  const offset = 20;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  // Determine if we should flip to the left of cursor
  const nearRightEdge = pos.x + offset + size > window.innerWidth;
  const nearBottom = pos.y + offset + size + 24 > window.innerHeight;
  const loupeX = nearRightEdge ? pos.x - offset - size : pos.x + offset;
  const loupeY = nearBottom ? pos.y - offset - size - 24 : pos.y + offset;

  if (!visible) return null;

  // The zoomed background position: center the cursor position in the loupe
  const bgX = -(pos.x * zoom) + size / 2;
  const bgY = -(pos.y * zoom) + size / 2;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: loupeX,
        top: loupeY,
      }}
    >
      {/* Magnifier circle */}
      <div
        className="relative overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '2px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Zoomed background */}
        {screenshotSrc ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${screenshotSrc})`,
              backgroundSize: `${window.innerWidth * zoom}px ${window.innerHeight * zoom}px`,
              backgroundPosition: `${bgX}px ${bgY}px`,
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          /* Fallback: use a gradient to indicate zoom area */
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(30, 30, 30, 0.9)',
            }}
          />
        )}

        {/* Crosshair overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Horizontal line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: 'rgba(255, 0, 0, 0.6)',
            }}
          />
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: 'rgba(255, 0, 0, 0.6)',
            }}
          />
        </div>

        {/* Hidden canvas for potential future use */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Coordinates label */}
      <div
        className="text-center mt-1 text-xs font-mono"
        style={{
          color: 'rgba(255, 255, 255, 0.8)',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
        }}
      >
        {Math.round(pos.x)}, {Math.round(pos.y)}
      </div>
    </div>
  );
}
