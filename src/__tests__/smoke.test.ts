import { describe, expect, it, vi } from 'vitest';
import { commands } from '../lib/tauri/commands';

// Mock the Tauri invoke bridge so tests run outside a Tauri webview.
// Some commands guard with `isTauri` and return a fallback directly (no invoke
// call), so not every test needs the mock to be configured.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('smoke', () => {
  it('math works', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('commands wrapper — FE Prep', () => {
  // listFeTopics returns Promise.resolve([]) directly when isTauri is false,
  // without calling invoke.
  it('listFeTopics resolves to an empty array when not in Tauri', async () => {
    const result = await commands.listFeTopics();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe('commands wrapper — Diagram', () => {
  // renderDiagram calls Promise.reject('Not in Tauri') when isTauri is false.
  it('renderDiagram rejects with "Not in Tauri" when not in Tauri', async () => {
    await expect(commands.renderDiagram('mermaid', 'graph TD\n  A-->B')).rejects.toBe('Not in Tauri');
  });
});

describe('commands wrapper — Vault Study', () => {
  // ingestDocument and queryVault call Promise.reject('Not in Tauri') when isTauri is false.
  it('ingestDocument rejects with "Not in Tauri" when not in Tauri', async () => {
    await expect(commands.ingestDocument('/tmp/test.pdf', [])).rejects.toBe('Not in Tauri');
  });

  it('queryVault rejects with "Not in Tauri" when not in Tauri', async () => {
    await expect(commands.queryVault("What is Ohm's law?")).rejects.toBe('Not in Tauri');
  });
});
