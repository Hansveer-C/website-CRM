import { describe, expect, it } from 'vitest';
import type { Page, PageSection } from './types';
import { createBuilderDocument } from './builder_document';
import type { BuilderDocument } from './builder_document';
import {
  BUILDER_HISTORY_LIMIT,
  BUILDER_TYPING_COALESCE_MS,
  BuilderHistoryController,
  BuilderSerializedSaveQueue,
  getBuilderHistoryKeyboardCommand,
  handleBuilderHistoryKeyboardShortcut
} from './builder_history_controller';

function makeDocument(pageId = 'page-a'): BuilderDocument {
  const page: Page = {
    id: pageId,
    user_id: 'user-1',
    name: pageId,
    slug: pageId,
    status: 'draft',
    seo_title: pageId,
    seo_description: pageId,
    seo_keywords: [],
    created_at: '2026-07-25T00:00:00.000Z'
  };
  const sections: PageSection[] = [
    {
      id: `${pageId}-hero`,
      page_id: pageId,
      type: 'hero',
      variant: 'standard',
      order: 0,
      content: { heading: 'Original', nested: { preserved: true } },
      styles: { visible: true, background: '#ffffff' }
    },
    {
      id: `${pageId}-gallery`,
      page_id: pageId,
      type: 'gallery',
      variant: 'comparison',
      order: 1,
      content: { title: 'Gallery', unknown: { keep: true } },
      styles: { visible: true, padding: '40px' }
    }
  ];
  return createBuilderDocument(page, sections);
}

function replaceHeading(
  controller: BuilderHistoryController,
  heading: string,
  options: { fieldId?: string; timestamp?: number; coalesce?: boolean } = {}
) {
  return controller.applyMutation(document => ({
    ...document,
    sections: document.sections.map((section, index) => index === 0
      ? { ...section, content: { ...section.content, heading } }
      : section)
  }), {
    category: 'content',
    sectionId: documentHeroId(controller),
    fieldId: options.fieldId ?? 'heading',
    timestamp: options.timestamp,
    coalesce: options.coalesce
  });
}

function documentHeroId(controller: BuilderHistoryController): string {
  return controller.document.sections[0].id;
}

function addSection(controller: BuilderHistoryController, id: string) {
  return controller.applyMutation(document => ({
    ...document,
    sections: [
      ...document.sections,
      {
        id,
        page_id: document.page.id,
        type: 'faq',
        variant: 'accordion',
        order: document.sections.length,
        content: { heading: 'FAQ', unknown: { preserved: true } },
        styles: { visible: true }
      }
    ]
  }), {
    category: 'structural',
    sectionId: id,
    fieldId: 'add-section',
    coalesce: false,
    selectSectionId: id
  });
}

describe('BuilderHistoryController baseline and history', () => {
  it('starts clean with no undo or redo and owns its document', () => {
    const input = makeDocument();
    const controller = new BuilderHistoryController(input);

    expect(controller.canUndo).toBe(false);
    expect(controller.canRedo).toBe(false);
    expect(controller.isDirty).toBe(false);
    expect(controller.document).toEqual(input);
    expect(controller.document).not.toBe(input);
  });

  it('records one mutation, undo, and redo', () => {
    const controller = new BuilderHistoryController(makeDocument());
    expect(replaceHeading(controller, 'Edited').changed).toBe(true);
    expect(controller.canUndo).toBe(true);
    expect(controller.document.sections[0].content.heading).toBe('Edited');

    expect(controller.undo()).toBe(true);
    expect(controller.document.sections[0].content.heading).toBe('Original');
    expect(controller.canRedo).toBe(true);

    expect(controller.redo()).toBe(true);
    expect(controller.document.sections[0].content.heading).toBe('Edited');
  });

  it('synchronizes page metadata without adding it to section history', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'Edited', { coalesce: false });
    const canUndoBefore = controller.canUndo;
    const nextPage = { ...controller.document.page, name: 'Updated page', seo_title: 'Updated SEO' };

    expect(controller.synchronizePageMetadata(nextPage)).toBe(true);
    expect(controller.canUndo).toBe(canUndoBefore);
    expect(controller.document.page.name).toBe('Updated page');
    expect(controller.undo()).toBe(true);
    expect(controller.document.sections[0].content.heading).toBe('Original');
    expect(controller.document.page.name).toBe('Updated page');
    expect(controller.synchronizePageMetadata({ ...nextPage, id: 'other' })).toBe(false);
  });

  it('clears redo after a new mutation', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'First', { coalesce: false });
    controller.undo();
    replaceHeading(controller, 'Branch', { coalesce: false });
    expect(controller.canRedo).toBe(false);
  });

  it('does not record no-op or invalid mutations', () => {
    const controller = new BuilderHistoryController(makeDocument());
    expect(replaceHeading(controller, 'Original').changed).toBe(false);
    const invalid = controller.applyMutation(document => ({
      ...document,
      sections: [{ ...document.sections[0], id: '' }]
    }), { category: 'structural', coalesce: false });

    expect(invalid.changed).toBe(false);
    expect(invalid.issues.length).toBeGreaterThan(0);
    expect(controller.canUndo).toBe(false);
  });

  it('does not mutate inputs, returned documents, or prior snapshots', () => {
    const input = makeDocument();
    const before = structuredClone(input);
    const controller = new BuilderHistoryController(input);
    replaceHeading(controller, 'Edited', { coalesce: false });
    const exposed = controller.document;
    exposed.sections[0].content.heading = 'External mutation';
    controller.undo();

    expect(input).toEqual(before);
    expect(controller.document.sections[0].content.heading).toBe('Original');
  });

  it('keeps selection and viewport out of document history', () => {
    const controller = new BuilderHistoryController(makeDocument(), {
      selectedSectionId: 'page-a-hero',
      viewport: 'desktop'
    });
    expect(controller.selectSection('page-a-gallery')).toBe(true);
    expect(controller.setViewport('tablet')).toBe(true);
    expect(controller.canUndo).toBe(false);
    expect(controller.selectedSectionId).toBe('page-a-gallery');
    expect(controller.viewport).toBe('tablet');
  });

  it('bounds history and removes oldest entries deterministically', () => {
    const controller = new BuilderHistoryController(makeDocument());
    for (let index = 1; index <= BUILDER_HISTORY_LIMIT + 5; index += 1) {
      replaceHeading(controller, `Edit ${index}`, { coalesce: false });
    }
    expect(controller.snapshot.past).toHaveLength(BUILDER_HISTORY_LIMIT);
    expect(controller.snapshot.past[0].sections[0].content.heading).toBe('Edit 5');
  });

  it('isolates page histories by controller and page baseline', () => {
    const pageA = new BuilderHistoryController(makeDocument('page-a'));
    const pageB = new BuilderHistoryController(makeDocument('page-b'));
    replaceHeading(pageA, 'A edited', { coalesce: false });

    expect(pageA.canUndo).toBe(true);
    expect(pageB.canUndo).toBe(false);
    expect(pageB.undo()).toBe(false);
    expect(pageB.document.page.id).toBe('page-b');
  });
});

describe('BuilderHistoryController typing coalescing', () => {
  it('coalesces continuous changes to the same field', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'E', { timestamp: 100 });
    replaceHeading(controller, 'Ed', { timestamp: 200 });
    replaceHeading(controller, 'Edited', { timestamp: 300 });

    expect(controller.snapshot.past).toHaveLength(1);
    controller.undo();
    expect(controller.document.sections[0].content.heading).toBe('Original');
    controller.redo();
    expect(controller.document.sections[0].content.heading).toBe('Edited');
  });

  it.each([
    ['different field', { fieldId: 'subheading', timestamp: 200 }],
    ['expired window', { timestamp: 100 + BUILDER_TYPING_COALESCE_MS + 1 }],
    ['explicit boundary', { timestamp: 200, coalesce: false }]
  ])('starts a new entry for %s', (_label, nextOptions) => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'First', { timestamp: 100 });
    replaceHeading(controller, 'Second', nextOptions);
    expect(controller.snapshot.past).toHaveLength(2);
  });

  it('starts a new entry for another section', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'First', { timestamp: 100 });
    controller.applyMutation(document => ({
      ...document,
      sections: document.sections.map((section, index) => index === 1
        ? { ...section, content: { ...section.content, title: 'Changed' } }
        : section)
    }), {
      category: 'content',
      sectionId: 'page-a-gallery',
      fieldId: 'heading',
      timestamp: 200
    });
    expect(controller.snapshot.past).toHaveLength(2);
  });

  it.each(['undo', 'redo', 'selection', 'structural'] as const)(
    '%s breaks the active typing transaction',
    boundary => {
      const controller = new BuilderHistoryController(makeDocument());
      replaceHeading(controller, 'First', { timestamp: 100 });
      if (boundary === 'undo') controller.undo();
      if (boundary === 'redo') {
        controller.undo();
        controller.redo();
      }
      if (boundary === 'selection') controller.selectSection('page-a-gallery');
      if (boundary === 'structural') addSection(controller, 'faq-new');
      replaceHeading(controller, 'After boundary', { timestamp: 200 });

      if (boundary === 'undo') {
        expect(controller.snapshot.past).toHaveLength(1);
        controller.undo();
        expect(controller.document.sections[0].content.heading).toBe('Original');
      } else {
        expect(controller.snapshot.past.length).toBeGreaterThan(1);
      }
    }
  );
});

describe('BuilderHistoryController structural operations and selection', () => {
  it('undoes and redoes add with the same stable ID and defaults', () => {
    const controller = new BuilderHistoryController(makeDocument());
    addSection(controller, 'faq-stable');
    const added = controller.document.sections[2];
    controller.undo();
    expect(controller.document.sections.some(section => section.id === 'faq-stable')).toBe(false);
    controller.redo();
    expect(controller.document.sections[2]).toEqual(added);
    expect(controller.selectedSectionId).toBe('faq-stable');
  });

  it('undoes deletion, restores unknown data, and reselects the section', () => {
    const controller = new BuilderHistoryController(makeDocument(), {
      selectedSectionId: 'page-a-gallery'
    });
    controller.applyMutation(document => ({
      ...document,
      sections: document.sections.filter(section => section.id !== 'page-a-gallery')
    }), {
      category: 'structural',
      coalesce: false,
      selectSectionId: 'page-a-hero'
    });
    controller.undo();

    expect(controller.selectedSectionId).toBe('page-a-gallery');
    expect(controller.document.sections[1].content.unknown).toEqual({ keep: true });
    controller.redo();
    expect(controller.selectedSectionId).toBe('page-a-hero');
  });

  it('handles deletion of the final section with no invalid selection', () => {
    const single = makeDocument();
    single.sections = [single.sections[0]];
    const controller = new BuilderHistoryController(single, {
      selectedSectionId: single.sections[0].id
    });
    controller.applyMutation(document => ({ ...document, sections: [] }), {
      category: 'structural',
      coalesce: false,
      selectSectionId: null
    });
    expect(controller.selectedSectionId).toBeNull();
  });

  it('undoes and redoes normalized reorder without duplicate IDs', () => {
    const controller = new BuilderHistoryController(makeDocument());
    controller.applyMutation(document => ({
      ...document,
      sections: [
        { ...document.sections[1], order: 0 },
        { ...document.sections[0], order: 1 }
      ]
    }), { category: 'structural', coalesce: false });
    expect(controller.document.sections.map(section => section.id)).toEqual([
      'page-a-gallery', 'page-a-hero'
    ]);
    controller.undo();
    expect(controller.document.sections.map(section => section.id)).toEqual([
      'page-a-hero', 'page-a-gallery'
    ]);
    controller.redo();
    expect(new Set(controller.document.sections.map(section => section.id)).size).toBe(2);
  });

  it.each([
    ['visibility', (document: BuilderDocument) => ({
      ...document,
      sections: document.sections.map((section, index) => index === 0
        ? { ...section, styles: { ...section.styles, visible: false } }
        : section)
    })],
    ['variant', (document: BuilderDocument) => ({
      ...document,
      sections: document.sections.map((section, index) => index === 0
        ? { ...section, variant: 'split' }
        : section)
    })],
    ['design', (document: BuilderDocument) => ({
      ...document,
      sections: document.sections.map((section, index) => index === 0
        ? { ...section, styles: { ...section.styles, background: '#000000' } }
        : section)
    })]
  ] as const)('undoes and redoes %s changes', (_label, mutator) => {
    const controller = new BuilderHistoryController(makeDocument());
    const before = controller.document;
    controller.applyMutation(mutator, { category: 'structural', coalesce: false });
    const after = controller.document;
    controller.undo();
    expect(controller.document).toEqual(before);
    controller.redo();
    expect(controller.document).toEqual(after);
  });
});

describe('BuilderHistoryController save generations and dirty state', () => {
  it('marks the exact acknowledged snapshot clean', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'Saved', { coalesce: false });
    const save = controller.createSaveSnapshot();
    expect(save).not.toBeNull();
    if (!save) throw new Error('Expected a save snapshot.');
    expect(controller.acknowledgeSave(save.generation, true)).toEqual({
      accepted: true,
      stale: false,
      isDirty: false
    });
  });

  it('ignores an older acknowledgement that finishes after a newer save', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'A', { coalesce: false });
    const saveA = controller.createSaveSnapshot();
    replaceHeading(controller, 'B', { coalesce: false });
    const saveB = controller.createSaveSnapshot();
    if (!saveA || !saveB) throw new Error('Expected save snapshots.');

    expect(controller.acknowledgeSave(saveB.generation, true).accepted).toBe(true);
    expect(controller.acknowledgeSave(saveA.generation, true)).toMatchObject({
      accepted: false,
      stale: true
    });
    expect(controller.document.sections[0].content.heading).toBe('B');
    expect(controller.isDirty).toBe(false);
  });

  it('does not corrupt history after save failure', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'Unsaved', { coalesce: false });
    const save = controller.createSaveSnapshot();
    if (!save) throw new Error('Expected a save snapshot.');
    expect(controller.acknowledgeSave(save.generation, false).accepted).toBe(false);
    expect(controller.isDirty).toBe(true);
    expect(controller.canUndo).toBe(true);
  });

  it('becomes clean when undo returns to the persisted snapshot', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'Changed', { coalesce: false });
    expect(controller.isDirty).toBe(true);
    controller.undo();
    expect(controller.isDirty).toBe(false);
  });

  it('save snapshots contain documents only, never history stacks', () => {
    const controller = new BuilderHistoryController(makeDocument());
    replaceHeading(controller, 'Changed', { coalesce: false });
    const save = controller.createSaveSnapshot();
    if (!save) throw new Error('Expected a save snapshot.');
    expect(save.document).not.toHaveProperty('past');
    expect(save.document).not.toHaveProperty('future');
  });

  it('does not create duplicate saves for a clean or already queued document', () => {
    const controller = new BuilderHistoryController(makeDocument());
    expect(controller.createSaveSnapshot()).toBeNull();
    replaceHeading(controller, 'Changed', { coalesce: false });
    expect(controller.createSaveSnapshot()).not.toBeNull();
    expect(controller.createSaveSnapshot()).toBeNull();
  });

  it('serializes physical saves so an older write cannot finish after a newer write', async () => {
    const queue = new BuilderSerializedSaveQueue();
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const first = queue.enqueue(async () => {
      order.push('first-start');
      await new Promise<void>(resolve => { releaseFirst = resolve; });
      order.push('first-end');
    });
    const second = queue.enqueue(async () => {
      order.push('second-start');
      order.push('second-end');
    });

    await Promise.resolve();
    expect(order).toEqual(['first-start']);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(order).toEqual([
      'first-start', 'first-end', 'second-start', 'second-end'
    ]);
  });
});

describe('Builder history keyboard shortcuts', () => {
  function event(overrides: Partial<Parameters<typeof getBuilderHistoryKeyboardCommand>[0]> = {}) {
    return {
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      isComposing: false,
      preventDefault() {},
      ...overrides
    };
  }

  const enabled = {
    isBuilderActive: true,
    publicationModalOpen: false,
    targetIsEditable: false,
    targetIsBuilderDocumentControl: false,
    canUndo: true,
    canRedo: true
  };

  it.each([
    ['Ctrl+Z', event(), 'undo'],
    ['Command+Z', event({ ctrlKey: false, metaKey: true }), 'undo'],
    ['Ctrl+Shift+Z', event({ shiftKey: true }), 'redo'],
    ['Command+Shift+Z', event({ ctrlKey: false, metaKey: true, shiftKey: true }), 'redo'],
    ['Ctrl+Y', event({ key: 'y' }), 'redo']
  ])('maps %s', (_label, keyboardEvent, command) => {
    expect(getBuilderHistoryKeyboardCommand(keyboardEvent, enabled)).toBe(command);
  });

  it.each([
    ['Alt combination', event({ altKey: true }), enabled],
    ['IME composition', event({ isComposing: true }), enabled],
    ['outside Builder', event(), { ...enabled, isBuilderActive: false }],
    ['publication modal', event(), { ...enabled, publicationModalOpen: true }],
    ['unrelated editable input', event(), { ...enabled, targetIsEditable: true }],
    ['unavailable undo', event(), { ...enabled, canUndo: false }]
  ])('ignores %s', (_label, keyboardEvent, context) => {
    expect(getBuilderHistoryKeyboardCommand(keyboardEvent, context)).toBeNull();
  });

  it('allows Builder inspector/canvas editable controls', () => {
    expect(getBuilderHistoryKeyboardCommand(event(), {
      ...enabled,
      targetIsEditable: true,
      targetIsBuilderDocumentControl: true
    })).toBe('undo');
  });

  it('prevents default only when an action is handled', () => {
    let prevented = 0;
    let undoCalls = 0;
    const handled = handleBuilderHistoryKeyboardShortcut(
      event({ preventDefault: () => { prevented += 1; } }),
      enabled,
      { undo: () => { undoCalls += 1; return true; }, redo: () => true }
    );
    const ignored = handleBuilderHistoryKeyboardShortcut(
      event({ preventDefault: () => { prevented += 1; } }),
      { ...enabled, canUndo: false },
      { undo: () => true, redo: () => true }
    );

    expect(handled).toBe(true);
    expect(ignored).toBe(false);
    expect(undoCalls).toBe(1);
    expect(prevented).toBe(1);
  });
});
