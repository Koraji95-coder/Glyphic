// Card primitive -- Deep-Dive aesthetic.
//
// Background swaps from --bg-card to --bg-card-hover on hover, with a
// border-color shift to --border-strong. Both transitions are
// var(--ease-standard) / var(--dur-base) so cards feel calm but alive.
//
// Pass `interactive={false}` for static informational cards that should
// not respond to hover.

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/cn";

export interface CardProps extends HTMLMotionProps<"div"> {
  interactive?: boolean;
  /** Stagger the entry by this many ms (helps grids feel choreographed). */
  delayMs?: number;
}

export function Card({
  className,
  interactive = true,
  delayMs = 0,
  children,
  ...rest
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1], delay: delayMs / 1000 }}
      className={cn(
        "rounded-xl border p-6",
        "border-zinc-800 bg-zinc-900",
        interactive && "transition-colors duration-250 hover:border-zinc-700 hover:bg-zinc-800",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}