import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorActionStore } from '../../../stores/editorActionStore';
import { useEditorModalStore } from '../../../stores/editorModalStore';
import { useVaultStore } from '../../../stores/vaultStore';
import { ReferenceModal } from '../ReferenceModal';

describe('ReferenceModal', () => {
  const insertLinkSpy = vi.fn<(url: string, text?: string) => void>();
  const insertBacklinkSpy = vi.fn<(title: string) => void>();

  beforeEach(async () => {
    insertLinkSpy.mockReset();
    insertBacklinkSpy.mockReset();

    await act(async () => {
      useEditorActionStore.setState({
        onInsertLink: insertLinkSpy,
        onInsertBacklink: insertBacklinkSpy,
      });

      useVaultStore.setState({
        fileTree: [
          { name: 'Alpha.md', path: 'notes/Alpha.md', entry_type: 'file' },
          { name: 'Beta.md', path: 'notes/Beta.md', entry_type: 'file' },
        ],
      });

      useEditorModalStore.setState({
        referenceModalOpen: false,
        referenceMode: 'link',
      });
    });
  });

  afterEach(async () => {
    await act(async () => {
      useEditorActionStore.getState().resetOnInsertLink();
      useEditorActionStore.getState().resetOnInsertBacklink();
      useEditorModalStore.getState().closeReferenceModal();
    });
    cleanup();
  });

  const renderModal = async (mode: 'link' | 'backlink') => {
    await act(async () => {
      useEditorModalStore.getState().openReferenceModal(mode);
      render(<ReferenceModal />);
    });
  };

  it('inserts link on Enter in link mode', async () => {
    await renderModal('link');

    const urlInput = screen.getByLabelText(/url/i);
    act(() => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
      fireEvent.keyDown(urlInput, { key: 'Enter' });
    });

    expect(insertLinkSpy).toHaveBeenCalledWith('https://example.com', undefined);
    expect(useEditorModalStore.getState().referenceModalOpen).toBe(false);
  });

  it('moves selection with arrows and inserts backlink on Enter', async () => {
    await renderModal('backlink');

    const searchInput = screen.getByPlaceholderText('Search notes...');
    act(() => {
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    });
    act(() => {
      fireEvent.keyDown(searchInput, { key: 'Enter' });
    });

    expect(insertBacklinkSpy).toHaveBeenCalledWith('Beta');
    expect(useEditorModalStore.getState().referenceModalOpen).toBe(false);
  });

  it('closes on Escape', async () => {
    await renderModal('link');

    const urlInput = screen.getByLabelText(/url/i);
    act(() => {
      fireEvent.keyDown(urlInput, { key: 'Escape' });
    });

    expect(useEditorModalStore.getState().referenceModalOpen).toBe(false);
  });

  it('traps focus within modal when tabbing from the last focusable element', async () => {
    await renderModal('link');

    const urlInput = screen.getByLabelText(/url/i);
    act(() => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    });

    const insertButton = screen.getByRole('button', { name: 'Insert' });
    insertButton.focus();
    act(() => {
      fireEvent.keyDown(insertButton, { key: 'Tab' });
    });

    expect(screen.getByRole('button', { name: 'Close' })).toBe(document.activeElement);
  });

  it('shows no-results helper and switches to link mode', async () => {
    await renderModal('backlink');

    const searchInput = screen.getByPlaceholderText('Search notes...');
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'no-matches-here' } });
    });

    const switchButton = await screen.findByRole('button', { name: 'Insert External Link Instead' });
    act(() => {
      fireEvent.click(switchButton);
    });

    await waitFor(() => {
      expect(useEditorModalStore.getState().referenceMode).toBe('link');
    });
    expect(screen.getByLabelText(/url/i)).toBeTruthy();
  });
});
