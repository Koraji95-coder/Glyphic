import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useVaultStore } from '../../../stores/vaultStore';
import { Dashboard } from '../Dashboard';

vi.mock('../../../lib/tauri/commands', () => ({
  commands: {
    getFeStatistics: vi.fn().mockResolvedValue([
      { topic_id: 1, attempts: 10, correct: 7, accuracy: 70 },
      { topic_id: 2, attempts: 4, correct: 1, accuracy: 25 },
    ]),
    getWeakFeTopics: vi
      .fn()
      .mockResolvedValue([
        { topic_id: 2, name: 'Circuit analysis', category: 'Electrical', attempts: 4, accuracy: 25 },
      ]),
  },
}));

describe('Dashboard', () => {
  beforeEach(() => {
    useVaultStore.setState({
      fileTree: [
        {
          name: 'FE Electrical',
          path: 'FE Electrical',
          entry_type: 'folder',
          children: [
            {
              name: 'Ohms Law.md',
              path: 'FE Electrical/Ohms Law.md',
              entry_type: 'file',
              modified_at: '2026-05-16T12:00:00.000Z',
            },
          ],
        },
      ],
      activeNotePath: null,
    });

    useLayoutStore.setState({
      activeMode: 'editor',
      isFePrepMode: false,
      isVaultMode: false,
      isDiagramMode: false,
      isMasteryMode: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows study metrics and routes quick actions without fake document ingestion', async () => {
    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText('14')).toBeTruthy());

    expect(screen.queryByText(/documents ingested/i)).toBeNull();
    expect(screen.getByText(/FE attempts/i)).toBeTruthy();
    expect(screen.getByText(/Weak topic review/i)).toBeTruthy();
    expect(screen.getAllByText(/Circuit analysis/i)).toHaveLength(2);
    expect(screen.getByText(/Ohms Law/i)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /start fe prep/i })[0]);
    expect(useLayoutStore.getState().isFePrepMode).toBe(true);
  });
});
