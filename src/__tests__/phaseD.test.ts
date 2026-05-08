/**
 * Phase D UI feature tests — validate store-level logic that backs the
 * new UI components added in the Phase D redesign.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useVaultStore } from '../stores/vaultStore';

// ── vaultStore: pinned notes ─────────────────────────────────────────────────

describe('vaultStore — pinned notes', () => {
  beforeEach(() => {
    useVaultStore.setState({ pinnedNotes: [] });
  });

  it('pinNote adds the path to pinnedNotes', () => {
    useVaultStore.getState().pinNote('folder/note.md');
    expect(useVaultStore.getState().pinnedNotes).toContain('folder/note.md');
  });

  it('pinNote is idempotent — does not duplicate', () => {
    useVaultStore.getState().pinNote('a.md');
    useVaultStore.getState().pinNote('a.md');
    expect(useVaultStore.getState().pinnedNotes.filter((p) => p === 'a.md')).toHaveLength(1);
  });

  it('unpinNote removes the path', () => {
    useVaultStore.getState().pinNote('b.md');
    useVaultStore.getState().unpinNote('b.md');
    expect(useVaultStore.getState().pinnedNotes).not.toContain('b.md');
  });

  it('unpinNote on non-pinned path is a no-op', () => {
    useVaultStore.setState({ pinnedNotes: ['x.md'] });
    useVaultStore.getState().unpinNote('y.md');
    expect(useVaultStore.getState().pinnedNotes).toEqual(['x.md']);
  });
});

// ── layoutStore: focus mode ──────────────────────────────────────────────────

describe('layoutStore — focus mode', () => {
  beforeEach(() => {
    useLayoutStore.setState({ isFocusMode: false });
  });

  it('toggleFocusMode turns focus mode on', () => {
    useLayoutStore.getState().toggleFocusMode();
    expect(useLayoutStore.getState().isFocusMode).toBe(true);
  });

  it('toggleFocusMode turns focus mode off again', () => {
    useLayoutStore.setState({ isFocusMode: true });
    useLayoutStore.getState().toggleFocusMode();
    expect(useLayoutStore.getState().isFocusMode).toBe(false);
  });
});

// ── editorStore: cursor position ─────────────────────────────────────────────

describe('editorStore — cursor position', () => {
  beforeEach(() => {
    useEditorStore.setState({ cursorPosition: null });
  });

  it('setCursorPosition updates line and col', () => {
    useEditorStore.getState().setCursorPosition({ line: 3, col: 14 });
    expect(useEditorStore.getState().cursorPosition).toEqual({ line: 3, col: 14 });
  });

  it('setCursorPosition can be cleared with null', () => {
    useEditorStore.setState({ cursorPosition: { line: 1, col: 1 } });
    useEditorStore.getState().setCursorPosition(null);
    expect(useEditorStore.getState().cursorPosition).toBeNull();
  });
});
