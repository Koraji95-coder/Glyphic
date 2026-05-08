import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVaultStore } from '../../../stores/vaultStore';
import { BacklinksPanel } from '../BacklinksPanel';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('BacklinksPanel', () => {
  const invokeMock = vi.mocked(invoke);
  const originalSetActiveNote = useVaultStore.getState().setActiveNote;

  beforeEach(() => {
    invokeMock.mockReset();
    useVaultStore.setState({
      activeNoteId: 'notes/current.md',
      activeNotePath: 'notes/current.md',
      setActiveNote: originalSetActiveNote,
    });
  });

  it('renders empty state when getBacklinks returns []', async () => {
    invokeMock.mockResolvedValue([]);

    render(<BacklinksPanel />);
    fireEvent.click(screen.getByRole('button', { name: /backlinks/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_backlinks', { notePath: 'notes/current.md' });
    });

    expect(await screen.findByText('No backlinks yet')).toBeTruthy();
  });

  it('renders populated state when getBacklinks returns entries', async () => {
    invokeMock.mockResolvedValue([
      {
        source_id: 'id-1',
        source_path: 'notes/source.md',
        source_title: 'Source Note',
        context: 'Mentions [[Current]] here',
      },
    ]);

    render(<BacklinksPanel />);
    fireEvent.click(screen.getByRole('button', { name: /backlinks/i }));

    expect(await screen.findByText('Source Note')).toBeTruthy();
    expect(screen.getByText('Mentions [[Current]] here')).toBeTruthy();
  });

  it('clicking a backlink opens the source note path', async () => {
    const setActiveNoteSpy = vi.fn<(id: string, path: string) => void>();
    invokeMock.mockResolvedValue([
      {
        source_id: 'id-1',
        source_path: 'notes/source.md',
        source_title: 'Source Note',
        context: 'Mentions [[Current]] here',
      },
    ]);
    useVaultStore.setState({
      setActiveNote: setActiveNoteSpy,
    });

    render(<BacklinksPanel />);
    fireEvent.click(screen.getByRole('button', { name: /backlinks/i }));

    const sourceButton = await screen.findByRole('button', { name: /source note/i });
    fireEvent.click(sourceButton);

    expect(setActiveNoteSpy).toHaveBeenCalledWith('notes/source.md', 'notes/source.md');
  });
});
