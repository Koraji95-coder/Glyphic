import { describe, expect, it, vi } from 'vitest';
import { commands } from '../lib/tauri/commands';

// Mock the Tauri invoke bridge so tests run outside a Tauri webview.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

describe('smoke', () => {
  it('math works', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('commands wrapper — FE Prep', () => {
  it('listFeTopics resolves to an empty array when not in Tauri', async () => {
    // Outside Tauri, isTauri=false, so the command returns []
    mockInvoke.mockResolvedValue([]);
    const result = await commands.listFeTopics();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('commands wrapper — Diagram', () => {
  it('renderDiagram rejects when not in Tauri', async () => {
    // isTauri guard returns Promise.reject('Not in Tauri')
    await expect(commands.renderDiagram('mermaid', 'graph TD\n  A-->B')).rejects.toMatch(/Not in Tauri/i);
  });
});

describe('commands wrapper — Vault Study', () => {
  it('ingestDocument rejects when not in Tauri', async () => {
    await expect(commands.ingestDocument('/tmp/test.pdf', [])).rejects.toMatch(/Not in Tauri/i);
  });

  it('queryVault rejects when not in Tauri', async () => {
    await expect(commands.queryVault('What is Ohm\'s law?')).rejects.toMatch(/Not in Tauri/i);
  });
});
