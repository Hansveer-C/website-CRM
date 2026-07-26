import { describe, expect, it } from 'vitest';
import type { Page, PageSection } from './types';
import { createBuilderDocument } from './builder_document';
import type { BuilderDocument } from './builder_document';
import {
  canRedoBuilderEditorState,
  canUndoBuilderEditorState,
  createBuilderEditorState,
  reduceBuilderEditorState
} from './builder_editor_state';

function makeDocument(sectionIds: string[] = ['hero', 'gallery']): BuilderDocument {
  const page: Page = {
    id: 'page-1',
    user_id: 'user-1',
    name: 'Pressure Washing',
    slug: 'pressure-washing',
    status: 'draft',
    seo_title: 'Pressure Washing',
    seo_description: 'Local pressure washing.',
    seo_keywords: ['pressure washing'],
    created_at: '2026-07-25T00:00:00.000Z',
    funnel_id: 'funnel-1'
  };
  const sections: PageSection[] = sectionIds.map((id, index) => ({
    id,
    page_id: page.id,
    funnel_id: page.funnel_id,
    type: id === 'hero' ? 'hero' : 'gallery',
    variant: id === 'hero' ? 'split' : undefined,
    order: index,
    content: {
      heading: id,
      nested: {
        preserved: true,
        value: index
      },
      items: [{ id: `${id}-original` }],
      unknownContent: { enabled: true }
    },
    styles: {
      visible: true,
      responsive: {
        mobile: { columns: 1 },
        desktop: { columns: 3 }
      },
      unknownStyle: { token: 'space-lg' }
    }
  }));

  return createBuilderDocument(page, sections);
}

function patchHeading(state: ReturnType<typeof createBuilderEditorState>, heading: string) {
  return reduceBuilderEditorState(state, {
    type: 'patch-section',
    sectionId: 'hero',
    patch: { content: { heading } }
  });
}

describe('BuilderEditorState creation and navigation state', () => {
  it('creates the default clean desktop state with no history', () => {
    const document = makeDocument();
    const state = createBuilderEditorState(document);

    expect(state).toMatchObject({
      selectedSectionId: null,
      viewport: 'desktop',
      isDirty: false,
      past: [],
      future: []
    });
    expect(state.document).toEqual(document);
    expect(state.document).not.toBe(document);
  });

  it('accepts a valid custom initial selection and viewport', () => {
    const state = createBuilderEditorState(makeDocument(), {
      selectedSectionId: 'gallery',
      viewport: 'tablet'
    });

    expect(state.selectedSectionId).toBe('gallery');
    expect(state.viewport).toBe('tablet');
  });

  it('clears an invalid initial selection', () => {
    const state = createBuilderEditorState(makeDocument(), {
      selectedSectionId: 'missing'
    });

    expect(state.selectedSectionId).toBeNull();
  });

  it('changes selection without changing history or dirty state', () => {
    const state = createBuilderEditorState(makeDocument());
    const selected = reduceBuilderEditorState(state, {
      type: 'select-section',
      sectionId: 'hero'
    });
    const invalid = reduceBuilderEditorState(selected, {
      type: 'select-section',
      sectionId: 'missing'
    });

    expect(selected.selectedSectionId).toBe('hero');
    expect(selected.past).toBe(state.past);
    expect(selected.future).toBe(state.future);
    expect(selected.isDirty).toBe(false);
    expect(invalid.selectedSectionId).toBeNull();
  });

  it('changes viewport without history and returns the same state for a no-op', () => {
    const state = createBuilderEditorState(makeDocument());
    const tablet = reduceBuilderEditorState(state, {
      type: 'set-viewport',
      viewport: 'tablet'
    });
    const noOp = reduceBuilderEditorState(tablet, {
      type: 'set-viewport',
      viewport: 'tablet'
    });

    expect(tablet.viewport).toBe('tablet');
    expect(tablet.past).toBe(state.past);
    expect(tablet.isDirty).toBe(false);
    expect(noOp).toBe(tablet);
  });
});

describe('BuilderEditorState section patching', () => {
  it('recursively patches content while preserving unknown properties', () => {
    const state = createBuilderEditorState(makeDocument());
    const next = reduceBuilderEditorState(state, {
      type: 'patch-section',
      sectionId: 'hero',
      patch: {
        content: {
          nested: { value: 99, inserted: 'new' }
        }
      }
    });
    const content = next.document.sections[0].content;

    expect(content.nested).toEqual({
      preserved: true,
      value: 99,
      inserted: 'new'
    });
    expect(content.unknownContent).toEqual({ enabled: true });
  });

  it('recursively patches styles and preserves unknown style fields', () => {
    const state = createBuilderEditorState(makeDocument());
    const next = reduceBuilderEditorState(state, {
      type: 'patch-section',
      sectionId: 'hero',
      patch: {
        styles: {
          responsive: { mobile: { columns: 2 } }
        }
      }
    });
    const styles = next.document.sections[0].styles;

    expect(styles.responsive).toEqual({
      mobile: { columns: 2 },
      desktop: { columns: 3 }
    });
    expect(styles.unknownStyle).toEqual({ token: 'space-lg' });
  });

  it('replaces arrays instead of merging array entries', () => {
    const state = createBuilderEditorState(makeDocument());
    const next = reduceBuilderEditorState(state, {
      type: 'patch-section',
      sectionId: 'hero',
      patch: {
        content: { items: [{ id: 'replacement' }] }
      }
    });

    expect(next.document.sections[0].content.items).toEqual([
      { id: 'replacement' }
    ]);
  });

  it('deep-clones action payload values', () => {
    const state = createBuilderEditorState(makeDocument());
    const inserted = {
      nested: { label: 'safe' },
      items: [{ id: 'new-item' }]
    };
    const next = reduceBuilderEditorState(state, {
      type: 'patch-section',
      sectionId: 'hero',
      patch: { content: { inserted } }
    });

    inserted.nested.label = 'mutated';
    inserted.items[0].id = 'mutated';

    expect(next.document.sections[0].content.inserted).toEqual({
      nested: { label: 'safe' },
      items: [{ id: 'new-item' }]
    });
  });

  it('does not create history for meaningful no-op or missing-section patches', () => {
    const state = createBuilderEditorState(makeDocument());
    const noOp = reduceBuilderEditorState(state, {
      type: 'patch-section',
      sectionId: 'hero',
      patch: {
        content: { nested: { value: 0 } },
        styles: { visible: true },
        variant: 'split'
      }
    });
    const missing = reduceBuilderEditorState(state, {
      type: 'patch-section',
      sectionId: 'missing',
      patch: { content: { heading: 'ignored' } }
    });

    expect(noOp).toBe(state);
    expect(missing).toBe(state);
  });

  it('records meaningful edits, marks dirty, and clears future', () => {
    const state = createBuilderEditorState(makeDocument());
    const edited = patchHeading(state, 'First edit');
    const undone = reduceBuilderEditorState(edited, { type: 'undo' });
    const nextEdit = patchHeading(undone, 'New branch');

    expect(edited.isDirty).toBe(true);
    expect(edited.past).toHaveLength(1);
    expect(canUndoBuilderEditorState(edited)).toBe(true);
    expect(canRedoBuilderEditorState(undone)).toBe(true);
    expect(nextEdit.future).toEqual([]);
  });

  it('limits past history to the 50 most recent snapshots', () => {
    let state = createBuilderEditorState(makeDocument());

    for (let index = 1; index <= 55; index += 1) {
      state = patchHeading(state, `Edit ${index}`);
    }

    expect(state.past).toHaveLength(50);
    expect(state.past[0].sections[0].content.heading).toBe('Edit 5');
  });
});

describe('BuilderEditorState history and replacement', () => {
  it('undoes and redoes documents without changing viewport', () => {
    const state = createBuilderEditorState(makeDocument(), {
      selectedSectionId: 'hero',
      viewport: 'mobile'
    });
    const edited = patchHeading(state, 'Edited heading');
    const undone = reduceBuilderEditorState(edited, { type: 'undo' });
    const redone = reduceBuilderEditorState(undone, { type: 'redo' });

    expect(undone.document.sections[0].content.heading).toBe('hero');
    expect(undone.viewport).toBe('mobile');
    expect(redone.document.sections[0].content.heading).toBe('Edited heading');
    expect(redone.viewport).toBe('mobile');
  });

  it('clears selection when undo or redo restores a document without it', () => {
    const withoutSelected = makeDocument(['hero']);
    const withSelected = makeDocument(['hero', 'gallery']);
    let state = createBuilderEditorState(withoutSelected);
    state = reduceBuilderEditorState(state, {
      type: 'replace-document',
      document: withSelected,
      preserveHistory: true
    });
    state = reduceBuilderEditorState(state, {
      type: 'select-section',
      sectionId: 'gallery'
    });

    const undone = reduceBuilderEditorState(state, { type: 'undo' });
    expect(undone.selectedSectionId).toBeNull();

    const selectedBeforeRedo = {
      ...undone,
      selectedSectionId: 'gallery'
    };
    const redone = reduceBuilderEditorState(selectedBeforeRedo, { type: 'redo' });
    expect(redone.selectedSectionId).toBe('gallery');

    const redoneWithoutSelected = {
      ...redone,
      future: [withoutSelected],
      selectedSectionId: 'gallery'
    };
    expect(
      reduceBuilderEditorState(redoneWithoutSelected, { type: 'redo' })
        .selectedSectionId
    ).toBeNull();
  });

  it('replace-document defaults to clean state with cleared history', () => {
    const edited = patchHeading(
      createBuilderEditorState(makeDocument(), { selectedSectionId: 'gallery' }),
      'Edited'
    );
    const replacement = makeDocument(['hero']);
    const next = reduceBuilderEditorState(edited, {
      type: 'replace-document',
      document: replacement
    });

    expect(next.document).toEqual(replacement);
    expect(next.document).not.toBe(replacement);
    expect(next.selectedSectionId).toBeNull();
    expect(next.isDirty).toBe(false);
    expect(next.past).toEqual([]);
    expect(next.future).toEqual([]);
  });

  it('replace-document can preserve history and mark the replacement dirty', () => {
    const state = createBuilderEditorState(makeDocument());
    const replacement = makeDocument(['hero']);
    replacement.page.name = 'Replacement';
    const next = reduceBuilderEditorState(state, {
      type: 'replace-document',
      document: replacement,
      preserveHistory: true,
      markDirty: true
    });

    replacement.page.name = 'Mutated payload';

    expect(next.document.page.name).toBe('Replacement');
    expect(next.past).toHaveLength(1);
    expect(next.past[0]).toEqual(state.document);
    expect(next.isDirty).toBe(true);
  });

  it('mark-saved only clears dirty state and is a no-op when already clean', () => {
    const clean = createBuilderEditorState(makeDocument(), {
      selectedSectionId: 'hero',
      viewport: 'tablet'
    });
    expect(
      reduceBuilderEditorState(clean, { type: 'mark-saved' })
    ).toBe(clean);

    const edited = patchHeading(clean, 'Edited');
    const saved = reduceBuilderEditorState(edited, { type: 'mark-saved' });

    expect(saved.isDirty).toBe(false);
    expect(saved.document).toBe(edited.document);
    expect(saved.selectedSectionId).toBe(edited.selectedSectionId);
    expect(saved.viewport).toBe(edited.viewport);
    expect(saved.past).toBe(edited.past);
    expect(saved.future).toBe(edited.future);
  });

  it('does not mutate input state, documents, or stored history snapshots', () => {
    const sourceDocument = makeDocument();
    const sourceSnapshot = structuredClone(sourceDocument);
    const state = createBuilderEditorState(sourceDocument);
    const stateSnapshot = structuredClone(state);

    const edited = patchHeading(state, 'Edited');
    const undone = reduceBuilderEditorState(edited, { type: 'undo' });
    const redone = reduceBuilderEditorState(undone, { type: 'redo' });

    expect(sourceDocument).toEqual(sourceSnapshot);
    expect(state).toEqual(stateSnapshot);
    expect(edited.past[0]).toEqual(state.document);
    expect(undone.future[0]).toEqual(edited.document);
    expect(redone.document.sections[0].content.heading).toBe('Edited');
  });
});
