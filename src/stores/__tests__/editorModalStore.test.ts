import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorModalStore } from '../editorModalStore';

describe('editorModalStore unified reference state', () => {
  beforeEach(() => {
    useEditorModalStore.setState({
      referenceModalOpen: false,
      referenceMode: 'link',
    });
  });

  it('opens link mode via openReferenceModal', () => {
    useEditorModalStore.getState().openReferenceModal('link');
    const state = useEditorModalStore.getState();

    expect(state.referenceModalOpen).toBe(true);
    expect(state.referenceMode).toBe('link');
  });

  it('opens backlink mode via openReferenceModal', () => {
    useEditorModalStore.getState().openReferenceModal('backlink');
    const state = useEditorModalStore.getState();

    expect(state.referenceModalOpen).toBe(true);
    expect(state.referenceMode).toBe('backlink');
  });

  it('switches mode while keeping modal open', () => {
    const store = useEditorModalStore.getState();
    store.openReferenceModal('link');
    store.setReferenceMode('backlink');

    const state = useEditorModalStore.getState();
    expect(state.referenceModalOpen).toBe(true);
    expect(state.referenceMode).toBe('backlink');
  });

  it('closes reference modal', () => {
    const store = useEditorModalStore.getState();
    store.openReferenceModal('backlink');
    store.closeReferenceModal();

    const state = useEditorModalStore.getState();
    expect(state.referenceModalOpen).toBe(false);
  });
});
