// Header primitive -- thin top bar matching Deep-Dive's header.
//
// Left side: brand mark + optional context label (file name, current note,
// etc.). Right side: caller-supplied action slot. Sticky to viewport top
// with translucent backdrop blur so content can scroll behind it.

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface HeaderProps {
  brand: ReactNode;
  contextLabel?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Header({ brand, contextLabel, actions, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center justify-between gap-4 px-6",
        "border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
          {brand}
        </span>
        {contextLabel && (
          <span className="text-xs text-zinc-500">{contextLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-1">{actions}</div>
    </header>
  );
}