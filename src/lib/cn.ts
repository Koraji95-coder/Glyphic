// Class-name composer used throughout the UI.
//
// Layers clsx (conditional concatenation) on top of tailwind-merge (so later
// utility classes properly override earlier ones in the cascade). Identical
// signature to the cn() helper used in Deep-Dive-Claude-Code's UI.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}