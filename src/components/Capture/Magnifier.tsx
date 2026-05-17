import { useCallback, useEffect, useState } from 'react';

interface MagnifierProps {
  screenshotSrc?: string | null;
}

export function Magnifier({ screenshotSrc }: MagnifierProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  const size = 128;
  const zoom = 4;
  const offset = 24;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => setVisible(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  const nearRightEdge = pos.x + offset + size > window.innerWidth;
  const nearBottom = pos.y + offset + size + 32 > window.innerHeight;

  const loupeX = nearRightEdge ? pos.x - offset - size : pos.x + offset;
  const loupeY = nearBottom ? pos.y - offset - size - 32 : pos.y + offset;

  if (!visible) return null;

  const bgX = -(pos.x * zoom) + size / 2;
  const bgY = -(pos.y * zoom) + size / 2;

  return (
    <div
      className="fixed z-[10000] pointer-events-none"
      style={{ left: loupeX, top: loupeY }}
    >
      {/* Magnifier circle */}
      <div
        className="relative overflow-hidden rounded-full border-2 border-white/60 shadow-2xl backdrop-blur-sm"
        style={{ width: size, height: size }}
      >
        {screenshotSrc ? (
          <div
            className="absolute inset-0 bg-no-repeat"
            style={{
              backgroundImage: `url(${screenshotSrc})`,
              backgroundSize: `${window.innerWidth * zoom}px ${window.innerHeight * zoom}px`,
              backgroundPosition: `${bgX}px ${bgY}px`,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-900" />
        )}

        {/* Crosshair */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute w-full h-[1px] bg-red-400/70" />
          <div className="absolute h-full w-[1px] bg-red-400/70" />
        </div>
      </div>

      {/* Coordinates */}
      <div className="mt-2 text-center text-xs font-mono text-white/80 tracking-wider drop-shadow-md">
        {Math.round(pos.x)}, {Math.round(pos.y)}
      </div>
    </div>
  );
}