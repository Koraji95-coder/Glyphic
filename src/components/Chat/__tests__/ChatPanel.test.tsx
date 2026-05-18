import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../../stores/chatStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useVaultStore } from '../../../stores/vaultStore';
import { ChatPanel } from '../ChatPanel';

const sendSpy = vi.fn();
const cancelSpy = vi.fn();
const clearSpy = vi.fn();
let shellProps: Record<string, unknown> | null = null;

vi.mock('@chamber-19/desktop-toolkit/ai/shell', () => ({
  AiChatShell: (props: {
    lane: string;
    renderHeader?: (ctx: Record<string, unknown>) => ReactNode;
    renderMessage?: (message: Record<string, unknown>, index: number) => ReactNode;
    renderInput?: (ctx: Record<string, unknown>) => ReactNode;
  }) => {
    shellProps = props;
    const ctx = {
      messages: [{ role: 'assistant', content: 'I found a note.', toolName: 'search_notes' }],
      isStreaming: false,
      error: null,
      meta: null,
      send: sendSpy,
      cancel: cancelSpy,
      clear: clearSpy,
    };

    return (
      <div data-testid="ai-shell" data-lane={props.lane}>
        {props.renderHeader?.(ctx)}
        {props.renderMessage?.({ role: 'assistant', content: 'I found a note.', toolName: 'search_notes' }, 0)}
        {props.renderInput?.(ctx)}
      </div>
    );
  },
}));

vi.mock('../OllamaStatusBanner', () => ({
  OllamaStatusBanner: () => null,
}));

describe('ChatPanel AiChatShell adoption', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    sendSpy.mockReset();
    cancelSpy.mockReset();
    clearSpy.mockReset();
    shellProps = null;

    useChatStore.setState({
      isOpen: true,
      includeNoteContext: true,
      model: 'llama3.1:8b',
      models: ['llama3.1:8b'],
      refreshAiStatus: vi.fn(),
      togglePanel: vi.fn(),
      pinModelToNote: vi.fn(),
    });
    useVaultStore.setState({ activeNotePath: 'notes/thermo.md' });
    useEditorStore.setState({ content: 'Thermodynamics note body', activeNoteAiModel: null });
  });

  it('mounts AiChatShell on the glyphic-vault lane and preserves custom header/input slots', () => {
    render(<ChatPanel />);

    expect(screen.getByTestId('ai-shell')).toHaveAttribute('data-lane', 'glyphic-vault');
    expect(shellProps?.lane).toBe('glyphic-vault');
    expect(screen.getByText('ScribeAI')).toBeInTheDocument();
    expect(screen.getByText('Searching vault...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask ScribeAI...')).toBeInTheDocument();
  });

  it('sends input through the shell context send function', () => {
    render(<ChatPanel />);

    fireEvent.change(screen.getByPlaceholderText('Ask ScribeAI...'), {
      target: { value: 'Search my notes for entropy' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(sendSpy).toHaveBeenCalledWith('Search my notes for entropy');
  });
});
