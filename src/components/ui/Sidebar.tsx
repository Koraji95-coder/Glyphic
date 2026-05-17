// Sidebar primitive -- thin left rail with colored layer dots.
//
// Layers are visual section headers; items are clickable rows that show an
// active pill state. Modeled on Deep-Dive-Claude-Code's sidebar pattern
// (web/src/components/layout/sidebar.tsx).
//
// Usage:
//   <Sidebar
//     layers={[
//       { id: "vault",   label: "Vault",   dot: "blue",
//         items: [{ id: "notes", label: "Notes", monoId: "01", active: true }] },
//       { id: "study",   label: "Study",   dot: "emerald", items: [...] },
//     ]}
//     onSelect={(id) => navigate(id)}
//   />

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type DotColor = "blue" | "emerald" | "purple" | "amber" | "red" | "cyan";

const DOT_BG: Record<DotColor, string> = {
  blue:    "bg-blue-500",
  emerald: "bg-emerald-500",
  purple:  "bg-purple-500",
  amber:   "bg-amber-500",
  red:     "bg-red-500",
  cyan:    "bg-cyan-500",
};

export interface SidebarItem {
  id: string;
  label: ReactNode;
  /** Optional short monospace ID shown before the label (e.g. "01"). */
  monoId?: string;
  active?: boolean;
}

export interface SidebarLayer {
  id: string;
  label: string;
  dot: DotColor;
  items: SidebarItem[];
}

export interface SidebarProps {
  layers: SidebarLayer[];
  onSelect?: (itemId: string) => void;
  className?: string;
}

export function Sidebar({ layers, onSelect, className }: SidebarProps) {
  return (
    <nav className={cn("hidden w-56 shrink-0 md:block", className)}>
      <div className="sticky top-[calc(3.5rem+1.5rem)] space-y-5 px-4 py-6">
        {layers.map((layer) => (
          <div key={layer.id}>
            <div className="flex items-center gap-1.5 pb-1.5">
              <span className={cn("h-2 w-2 rounded-full", DOT_BG[layer.dot])} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {layer.label}
              </span>
            </div>
            <ul className="space-y-0.5">
              {layer.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(item.id)}
                    className={cn(
                      "block w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                      item.active
                        ? "bg-zinc-800 font-medium text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300",
                    )}
                  >
                    {item.monoId && (
                      <span className="mr-1.5 font-mono text-xs text-zinc-600">
                        {item.monoId}
                      </span>
                    )}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}