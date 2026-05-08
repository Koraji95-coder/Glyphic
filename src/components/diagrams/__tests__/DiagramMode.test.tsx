/**
 * DiagramMode component tests.
 *
 * Strategy: mock the Tauri invoke bridge and commands module so tests run
 * outside a Tauri webview. We test the UI interactions that drive the new
 * NL-generate, Export PNG, and Regenerate flows.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mermaid</svg>' }),
  },
}));

vi.mock('dompurify', () => ({
  default: { sanitize: vi.fn((s: string) => s) },
}));

// Use vi.fn() directly in the factory so hoisting works; configure return
// values in beforeEach via vi.mocked().
vi.mock('../../../lib/tauri/commands', () => ({
  commands: {
    renderDiagram: vi.fn(),
    generateCode: vi.fn(),
    exportPng: vi.fn(),
  },
}));

vi.mock('../../../stores/layoutStore', () => ({
  useLayoutStore: vi.fn((selector) => selector({ closeDiagramMode: vi.fn() })),
}));

// ── Component import (after mocks) ───────────────────────────────────────────
import { commands } from '../../../lib/tauri/commands';
import { DiagramMode } from '../DiagramMode';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clickButton(label) {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DiagramMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(commands.renderDiagram).mockResolvedValue({ svg_base64: 'abc123' });
    vi.mocked(commands.generateCode).mockResolvedValue({
      code: 'flowchart TD\nA-->B',
      language: 'mermaid',
      diagram_type: 'mermaid',
      warnings: [],
    });
    vi.mocked(commands.exportPng).mockResolvedValue({ png_base64: 'pngdata' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Diagram Studio heading', () => {
    render(<DiagramMode />);
    expect(screen.getByText('Diagram Studio')).toBeTruthy();
  });

  it('shows Render button', () => {
    render(<DiagramMode />);
    expect(screen.getByRole('button', { name: /render/i })).toBeTruthy();
  });

  it('calls renderDiagram when Render is clicked', async () => {
    render(<DiagramMode />);
    clickButton(/render/i);
    await waitFor(() => expect(commands.renderDiagram).toHaveBeenCalledTimes(1));
  });

  it('shows Export SVG button after successful render', async () => {
    render(<DiagramMode />);
    clickButton(/render/i);
    await waitFor(() => expect(commands.renderDiagram).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /export svg/i })).toBeTruthy());
  });

  it('shows Export PNG button after successful render', async () => {
    render(<DiagramMode />);
    clickButton(/render/i);
    await waitFor(() => expect(commands.renderDiagram).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /export png/i })).toBeTruthy());
  });

  it('Export PNG button is disabled for Mermaid type', async () => {
    render(<DiagramMode />);
    // Switch to Mermaid type
    fireEvent.click(screen.getByRole('button', { name: /mermaid/i }));
    vi.mocked(commands.renderDiagram).mockResolvedValue({ mermaid: 'graph TD\nA-->B' });
    clickButton(/render/i);
    await waitFor(() => expect(commands.renderDiagram).toHaveBeenCalledTimes(1));
    // After mermaid render, svg_base64 is absent so Export PNG should be disabled
    await waitFor(() => {
      const pngBtn = screen.getByRole('button', { name: /export png/i });
      expect(pngBtn).toBeTruthy();
      expect(pngBtn.hasAttribute('disabled')).toBe(true);
    });
  });

  it('clicking Export PNG calls exportPng command', async () => {
    render(<DiagramMode />);
    clickButton(/render/i);
    await waitFor(() => expect(commands.renderDiagram).toHaveBeenCalledTimes(1));

    const pngBtn = await screen.findByRole('button', { name: /export png/i });
    fireEvent.click(pngBtn);
    await waitFor(() => expect(commands.exportPng).toHaveBeenCalledTimes(1));
  });

  it('toggling Describe mode shows NL prompt input', () => {
    render(<DiagramMode />);
    clickButton(/✨ describe/i);
    expect(screen.getByPlaceholderText(/describe the/i)).toBeTruthy();
  });

  it('in NL mode, Render calls generateCode then renderDiagram', async () => {
    render(<DiagramMode />);
    clickButton(/✨ describe/i);

    const input = screen.getByPlaceholderText(/describe the/i);
    fireEvent.change(input, { target: { value: 'a simple half-wave rectifier' } });

    vi.mocked(commands.renderDiagram).mockResolvedValue({ svg_base64: 'abc123' });
    clickButton(/render/i);

    await waitFor(() =>
      expect(commands.generateCode).toHaveBeenCalledWith('a simple half-wave rectifier', 'schemdraw'),
    );
    await waitFor(() => expect(commands.renderDiagram).toHaveBeenCalledTimes(1));
  });

  it('shows Regenerate button when generation fails in NL mode', async () => {
    vi.mocked(commands.generateCode).mockRejectedValue(new Error('LLM unavailable'));

    render(<DiagramMode />);
    clickButton(/✨ describe/i);

    const input = screen.getByPlaceholderText(/describe the/i);
    fireEvent.change(input, { target: { value: 'some description' } });

    clickButton(/render/i);

    await waitFor(() => screen.getByText(/generation failed/i));
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeTruthy();
  });

  it('shows Regenerate button when render fails in NL mode', async () => {
    vi.mocked(commands.generateCode).mockResolvedValue({
      code: 'bad code',
      language: 'python',
      diagram_type: 'schemdraw',
      warnings: [],
    });
    vi.mocked(commands.renderDiagram).mockResolvedValue({ error: 'render error' });

    render(<DiagramMode />);
    clickButton(/✨ describe/i);

    const input = screen.getByPlaceholderText(/describe the/i);
    fireEvent.change(input, { target: { value: 'something' } });

    clickButton(/render/i);

    await waitFor(() => screen.getByText(/render error/i));
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeTruthy();
  });
});
