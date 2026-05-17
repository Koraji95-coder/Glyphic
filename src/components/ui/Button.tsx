// Button primitive -- 3 variants matching Deep-Dive's button language.
//
//   primary   solid accent fill, used for the single dominant CTA per view
//   ghost     transparent with hover bg, used for secondary actions
//   subtle    quieter ghost, text-zinc-400 default, used in toolbars
//
// Sizes: sm (24px), md (32px), lg (40px). The default is md.

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "subtle";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-blue-500 text-white hover:bg-blue-400 active:bg-blue-600",
  ghost:   "border border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700",
  subtle:  "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-6 px-2.5 text-xs",
  md: "h-8 px-3.5 text-sm",
  lg: "h-10 px-5 text-sm font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "ghost", size = "md", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});