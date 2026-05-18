// Module shims for the toolkit's plain-JS JSX exports.
//
// @chamber-19/desktop-toolkit ships JSX/JS without bundled .d.ts files.
// Glyphic uses strict TS so untyped imports fail resolution. Declare
// the surface Glyphic consumes here; expand as we adopt more modules.
//
// Note: Glyphic deliberately does NOT consume the ThemeProvider --
// Glyphic has a bespoke Midnight Eclipse palette and would lose its
// identity if the toolkit overwrote --ch-bg / --ch-accent / --ch-border.
// Only the font axis is bridged (see src/styles/globals.css).

declare module "@chamber-19/desktop-toolkit/activation" {
  import type { ReactNode } from "react";

  export interface ActivationGateProps {
    children: ReactNode;
  }

  export function ActivationGate(props: ActivationGateProps): JSX.Element;
}

declare module "@chamber-19/desktop-toolkit/activation/bearer" {
  /** Fetch a fresh short-lived HMAC bearer token from the toolkit. */
  export function getToolkitBearer(): Promise<string>;
  /** React hook returning a stable callback that fetches a fresh bearer token. */
  export function useToolkitBearer(): () => Promise<string>;
  /**
   * Wrap a fetch init so the request carries `Authorization: Bearer <token>`.
   * Preserves other headers; throws if not activated.
   */
  export function withToolkitBearer(init?: RequestInit): Promise<RequestInit>;
}

declare module "@chamber-19/desktop-toolkit/ai/shell" {
  import type { ReactNode } from "react";

  export interface AiChatMessage {
    id?: string;
    role?: string;
    content?: string;
    timestamp?: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  export interface AiChatShellContext {
    messages: AiChatMessage[];
    isStreaming: boolean;
    error: string | null;
    meta: Record<string, unknown> | null;
    send: (content: string) => Promise<void> | void;
    cancel: () => Promise<void> | void;
    clear: () => void;
  }

  export interface AiChatShellProps {
    lane: string;
    modelOverride?: string;
    initialMessages?: AiChatMessage[];
    placeholder?: string;
    emptyState?: ReactNode;
    className?: string;
    onError?: (error: string) => void;
    renderHeader?: (ctx: AiChatShellContext) => ReactNode;
    renderMessage?: (message: AiChatMessage, index: number) => ReactNode;
    renderEmpty?: () => ReactNode;
    renderMeta?: (meta: Record<string, unknown> | null) => ReactNode;
    renderError?: (error: string | null) => ReactNode;
    renderInput?: (ctx: AiChatShellContext) => ReactNode;
  }

  export function AiChatShell(props: AiChatShellProps): JSX.Element;
}
