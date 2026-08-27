import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from './builder_document';
import { BuilderHistoryController } from './builder_history_controller';
import type { BuilderMutationMetadata } from './builder_history_controller';
import {
  addSection,
  copySection,
  deleteSection,
  duplicateSection,
  moveSection,
  pasteSection,
  resetSection,
  setSectionVisibility,
  type BuilderSectionClipboard,
  type BuilderSectionLifecycleResult
} from './builder_section_lifecycle';
import { applyBuilderSectionLifecycleResult } from './builder_section_lifecycle_runtime';
import { createBuilderSection } from './builder_section_registry';
import type { PageSection } from './types';

function section(id: string, order: number): PageSection {
  return {
    id,
    page_id: 'page-1',
    type: 'hero',
    content: { marker: id, nested: { values: [id] } },
    styles: { visible: true, nested: { token: id } },
    variant: 'standard',
    order
  };
}

function makeDocument(ids: string[] = ['a', 'b', 'c']): BuilderDocument {
  return {
    schemaVersion: 1,
    page: {
      id: 'page-1',
      user_id: 'user-1',
      name: 'Runtime lifecycle page',
      slug: 'runtime-lifecycle',
      status: 'draft',
      seo_title: 'Runtime lifecycle page',
      seo_description: 'Runtime lifecycle page',
      seo_keywords: [],
      created_at: '2026-08-27T00:00:00.000Z'
    },
    sections: ids.map((id, index) => section(id, index))
  };
}

function createRuntime(document = makeDocument(), selectedSectionId: string | null = 'b') {
  const history = new BuilderHistoryController(document, { selectedSectionId });
  let mutationCalls = 0;
  let autosaveSchedules = 0;
  let lastMetadata: BuilderMutationMetadata | null = null;

  return {
    history,
    get mutationCalls() { return mutationCalls; },
    get autosaveSchedules() { return autosaveSchedules; },
    get lastMetadata() { return lastMetadata; },
    apply(result: BuilderSectionLifecycleResult, fieldId: string): boolean {
      return applyBuilderSectionLifecycleResult(result, fieldId, (mutator, metadata) => {
        mutationCalls += 1;
        lastMetadata = metadata;
        const applied = history.applyMutation(mutator, metadata);
        if (applied.changed) autosaveSchedules += 1;
        return applied.changed;
      });
    }
  };
}

function expectOneStructuralStep(
  runtime: ReturnType<typeof createRuntime>,
  result: BuilderSectionLifecycleResult
): void {
  expect(runtime.history.snapshot.past).toHaveLength(1);
  expect(runtime.history.isDirty).toBe(true);
  expect(runtime.history.selectedSectionId).toBe(result.selectedSectionId);
  expect(runtime.mutationCalls).toBe(1);
  expect(runtime.autosaveSchedules).toBe(1);
  expect(runtime.lastMetadata).toMatchObject({
    category: 'structural',
    coalesce: false,
    sectionId: result.affectedSectionId,
    selectSectionId: result.selectedSectionId
  });
}

function expectUndoRedoExact(
  runtime: ReturnType<typeof createRuntime>,
  before: BuilderDocument,
  after: BuilderDocument,
  selectedAfter: string | null
): void {
  expect(runtime.history.undo()).toBe(true);
  expect(runtime.history.document).toEqual(before);
  expect(runtime.history.redo()).toBe(true);
  expect(runtime.history.document).toEqual(after);
  expect(runtime.history.selectedSectionId).toBe(selectedAfter);
}

describe('section lifecycle runtime adapter', () => {
  it('applies add as one structural history and autosave cycle with undo/redo', () => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const result = addSection(before, {
      type: 'faq',
      sectionId: 'sec-canonical-add',
      insertionIndex: 1,
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(result, 'add-section')).toBe(true);
    expect(runtime.history.document.sections.map(item => item.id)).toEqual([
      'a', 'sec-canonical-add', 'b', 'c'
    ]);
    expectOneStructuralStep(runtime, result);
    expectUndoRedoExact(runtime, before, result.document, 'sec-canonical-add');
  });

  it('applies adjacent deep duplicate as one cycle with undo/redo', () => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const result = duplicateSection(before, {
      sectionId: 'b',
      newSectionId: 'sec-canonical-duplicate',
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(result, 'duplicate-section')).toBe(true);
    expect(runtime.history.document.sections.map(item => item.id)).toEqual([
      'a', 'b', 'sec-canonical-duplicate', 'c'
    ]);
    expect(runtime.history.document.sections[2]).toMatchObject({
      content: before.sections[1].content,
      styles: before.sections[1].styles,
      variant: before.sections[1].variant
    });
    expectOneStructuralStep(runtime, result);
    expectUndoRedoExact(runtime, before, result.document, 'sec-canonical-duplicate');
  });

  it.each([
    ['first', ['a', 'b', 'c'], 'a', 'b'],
    ['middle', ['a', 'b', 'c'], 'b', 'c'],
    ['last', ['a', 'b', 'c'], 'c', 'b'],
    ['only', ['a'], 'a', null]
  ] as const)('uses domain selection when deleting the %s section', (_label, ids, target, selected) => {
    const runtime = createRuntime(makeDocument([...ids]), target);
    const before = runtime.history.document;
    const result = deleteSection(before, {
      sectionId: target,
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(result, 'delete-section')).toBe(true);
    expect(runtime.history.selectedSectionId).toBe(selected);
    expect(runtime.history.document.sections.some(item => item.id === target)).toBe(false);
    expectOneStructuralStep(runtime, result);
    expectUndoRedoExact(runtime, before, result.document, selected);
  });

  it('deletes a hidden section without leaving a dangling selection', () => {
    const document = makeDocument();
    document.sections[1].styles = { ...document.sections[1].styles, visible: false };
    const runtime = createRuntime(document, 'b');
    const result = deleteSection(runtime.history.document, {
      sectionId: 'b',
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(result, 'delete-section')).toBe(true);
    expect(runtime.history.document.sections.map(item => item.id)).toEqual(['a', 'c']);
    expect(runtime.history.selectedSectionId).toBe('c');
    expectOneStructuralStep(runtime, result);
  });

  it.each([
    ['up', 'b', -1, ['b', 'a', 'c']],
    ['down', 'b', 1, ['a', 'c', 'b']]
  ] as const)('applies move %s once and retains selection through redo', (_label, id, direction, ids) => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const result = moveSection(before, {
      sectionId: id,
      direction,
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(result, 'reorder-section')).toBe(true);
    expect(runtime.history.document.sections.map(item => item.id)).toEqual(ids);
    expectOneStructuralStep(runtime, result);
    expectUndoRedoExact(runtime, before, result.document, id);
  });

  it('applies hide and show as separate structural steps while retaining selection', () => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const hidden = setSectionVisibility(before, {
      sectionId: 'b',
      visible: false,
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(hidden, 'visibility')).toBe(true);
    expect(runtime.history.document.sections[1].styles?.visible).toBe(false);
    expectOneStructuralStep(runtime, hidden);
    expectUndoRedoExact(runtime, before, hidden.document, 'b');

    const shown = setSectionVisibility(runtime.history.document, {
      sectionId: 'b',
      visible: true,
      selectedSectionId: runtime.history.selectedSectionId
    });
    expect(runtime.apply(shown, 'visibility')).toBe(true);
    expect(runtime.history.document.sections[1].styles?.visible).toBe(true);
    expect(runtime.history.selectedSectionId).toBe('b');
    expect(runtime.history.snapshot.past).toHaveLength(2);
    expect(runtime.autosaveSchedules).toBe(2);
  });

  it('applies reset once and restores exact prior/default states through undo/redo', () => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const result = resetSection(before, {
      sectionId: 'b',
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(result, 'reset-section')).toBe(true);
    expect(runtime.history.document.sections[1]).toEqual(createBuilderSection('hero', {
      id: 'b', pageId: 'page-1', order: 1
    }));
    expectOneStructuralStep(runtime, result);
    expectUndoRedoExact(runtime, before, result.document, 'b');
  });

  it('keeps copy outside history, dirty state, autosave, and selection', () => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const copied = copySection(before, {
      sectionId: 'b',
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(copied.clipboard?.section).toEqual(before.sections[1]);
    expect(runtime.history.document).toEqual(before);
    expect(runtime.history.selectedSectionId).toBe('b');
    expect(runtime.history.snapshot.past).toHaveLength(0);
    expect(runtime.history.isDirty).toBe(false);
    expect(runtime.mutationCalls).toBe(0);
    expect(runtime.autosaveSchedules).toBe(0);
  });

  it('applies paste once and restores the exact pasted ID through undo/redo', () => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const copied = copySection(before, {
      sectionId: 'a',
      selectedSectionId: runtime.history.selectedSectionId
    });
    const clipboardBefore = structuredClone(copied.clipboard);
    const result = pasteSection(before, {
      clipboard: copied.clipboard,
      newSectionId: 'sec-runtime-paste',
      selectedSectionId: runtime.history.selectedSectionId
    });

    expect(runtime.apply(result, 'paste-section')).toBe(true);
    expect(runtime.history.document.sections.map(item => item.id)).toEqual([
      'a', 'b', 'sec-runtime-paste', 'c'
    ]);
    expectOneStructuralStep(runtime, result);
    expectUndoRedoExact(runtime, before, result.document, 'sec-runtime-paste');
    expect(copied.clipboard).toEqual(clipboardBefore);
  });

  it('reuses an unchanged clipboard for independent repeated paste', () => {
    const runtime = createRuntime();
    const copied = copySection(runtime.history.document, {
      sectionId: 'a',
      selectedSectionId: runtime.history.selectedSectionId
    });
    const clipboard = copied.clipboard as BuilderSectionClipboard;
    const clipboardBefore = structuredClone(clipboard);
    const first = pasteSection(runtime.history.document, {
      clipboard,
      newSectionId: 'paste-one',
      selectedSectionId: runtime.history.selectedSectionId
    });
    expect(runtime.apply(first, 'paste-section')).toBe(true);
    const second = pasteSection(runtime.history.document, {
      clipboard,
      newSectionId: 'paste-two',
      selectedSectionId: runtime.history.selectedSectionId
    });
    expect(runtime.apply(second, 'paste-section')).toBe(true);

    expect(runtime.history.document.sections.map(item => item.id)).toEqual([
      'a', 'b', 'paste-one', 'paste-two', 'c'
    ]);
    expect(runtime.history.document.sections[2].content)
      .not.toBe(runtime.history.document.sections[3].content);
    expect(runtime.history.snapshot.past).toHaveLength(2);
    expect(runtime.autosaveSchedules).toBe(2);
    expect(clipboard).toEqual(clipboardBefore);
  });

  it.each([
    ['missing delete', (document: BuilderDocument) => deleteSection(document, {
      sectionId: 'missing', selectedSectionId: 'b'
    })],
    ['first up', (document: BuilderDocument) => moveSection(document, {
      sectionId: 'a', direction: -1, selectedSectionId: 'b'
    })],
    ['last down', (document: BuilderDocument) => moveSection(document, {
      sectionId: 'c', direction: 1, selectedSectionId: 'b'
    })],
    ['same visibility', (document: BuilderDocument) => setSectionVisibility(document, {
      sectionId: 'b', visible: true, selectedSectionId: 'b'
    })],
    ['default reset', (document: BuilderDocument) => resetSection({
      ...document,
      sections: [createBuilderSection('hero', { id: 'default', pageId: 'page-1', order: 0 })]
    }, {
      sectionId: 'default', selectedSectionId: 'default'
    })],
    ['cross-page paste', (document: BuilderDocument) => pasteSection(document, {
      clipboard: {
        sourcePageId: 'other-page',
        sourceSectionType: 'hero',
        section: { ...section('source', 0), page_id: 'other-page' }
      },
      newSectionId: 'paste',
      selectedSectionId: 'b'
    })]
  ])('keeps %s a clean no-op with no history or autosave', (_label, operation) => {
    const runtime = createRuntime();
    const before = runtime.history.document;
    const result = operation(before);

    expect(runtime.apply(result, 'no-op')).toBe(false);
    expect(runtime.history.document).toEqual(before);
    expect(runtime.history.selectedSectionId).toBe('b');
    expect(runtime.history.snapshot.past).toHaveLength(0);
    expect(runtime.history.isDirty).toBe(false);
    expect(runtime.mutationCalls).toBe(0);
    expect(runtime.autosaveSchedules).toBe(0);
  });
});

describe('active Builder lifecycle wiring', () => {
  const source = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');

  function handler(name: string, nextName: string): string {
    const start = source.indexOf(`(window as any).${name} =`);
    const end = source.indexOf(`(window as any).${nextName} =`, start + 1);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('delegates all five active handlers to the lifecycle authority', () => {
    expect(handler('toggleSectionVisibility', 'duplicateGalleryItem'))
      .toContain('setBuilderSectionVisibility(');
    expect(handler('addStructuredSection', 'addSectionToPage')).toContain('addBuilderSection(');
    expect(handler('duplicateBuilderSection', 'addStructuredSectionAt'))
      .toContain('duplicateBuilderSection(');
    expect(handler('removeSection', 'moveSection')).toContain('deleteBuilderSection(');
    expect(handler('moveSection', 'switchSectionVariant')).toContain('moveBuilderSection(');
  });

  it('wires reset and paste through history while keeping copy non-mutating', () => {
    const reset = handler('resetBuilderSection', 'copyBuilderSection');
    const copy = handler('copyBuilderSection', 'pasteBuilderSection');
    const paste = handler('pasteBuilderSection', 'toggleSectionVisibility');

    expect(reset).toContain('resetBuilderSection(');
    expect(reset).toContain('applyLiveBuilderSectionLifecycleResult(');
    expect(copy).toContain('copyBuilderSection(');
    expect(copy).toContain('builderSectionClipboard = result.clipboard');
    expect(copy).not.toContain('applyLiveBuilderMutation');
    expect(copy).not.toContain('applyLiveBuilderSectionLifecycleResult');
    expect(paste).toContain('pasteBuilderSection(');
    expect(paste).toContain('applyLiveBuilderSectionLifecycleResult(');
    expect(paste).toContain('selectedSectionId: history.selectedSectionId');
  });

  it('uses canonical IDs for paste and no local random-ID implementation', () => {
    const paste = handler('pasteBuilderSection', 'toggleSectionVisibility');

    expect(paste).toContain('createBuilderSectionId()');
    expect(paste).not.toContain('crypto.randomUUID');
    expect(paste).not.toContain('Date.now()');
    expect(paste).not.toContain('Math.random');
  });

  it('keeps clipboard in memory and clears it on page/context/runtime transitions', () => {
    expect(source).toContain('let builderSectionClipboard: BuilderSectionClipboard | null = null;');
    expect(source).not.toMatch(/localStorage[^\n]*builderSectionClipboard/);
    expect(source).not.toContain('navigator.clipboard');
    expect(source).toMatch(/if \(pageChanged\) \{[\s\S]*?builderSectionClipboard = null;/);
    expect(source).toMatch(/switchBuilderPage[\s\S]*?builderSectionClipboard = null;[\s\S]*?builderPageId = id;/);
    expect(source).toMatch(/previousView === 'builder' && view !== 'builder'[\s\S]*?builderSectionClipboard = null;/);
  });

  it('uses only the canonical section ID generator in add and duplicate handlers', () => {
    const add = handler('addStructuredSection', 'addSectionToPage');
    const duplicate = handler('duplicateBuilderSection', 'addStructuredSectionAt');

    expect(add).toContain('createBuilderSectionId()');
    expect(duplicate).toContain('createBuilderSectionId()');
    expect(duplicate).not.toContain('crypto.randomUUID');
    expect(duplicate).not.toContain('Date.now()');
    expect(duplicate).not.toContain('structuredClone');
  });

  it('synchronizes lifecycle selection through history and persisted context', () => {
    const start = source.indexOf('function applyLiveBuilderSectionLifecycleResult(');
    const end = source.indexOf('function applyBuilderHistoryTransition(', start);
    const adapter = source.slice(start, end);

    expect(adapter).toContain('applyLiveBuilderMutation');
    expect(adapter).toContain('persistBuilderContext({');
    expect(adapter).toContain('sectionId: result.selectedSectionId');
  });
});
