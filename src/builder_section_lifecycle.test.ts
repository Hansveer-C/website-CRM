import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from './builder_document';
import {
  addSection,
  copySection,
  deleteSection,
  duplicateSection,
  moveSection,
  pasteSection,
  resetSection,
  setSectionVisibility
} from './builder_section_lifecycle';
import {
  createBuilderSection,
  getBuilderSectionDefinition
} from './builder_section_registry';
import type { PageSection } from './types';

const registeredTypes = ['hero', 'proof', 'offer', 'gallery', 'form', 'faq'];
const legacyTypes = ['services', 'benefits', 'before_after', 'cta', 'contact_info', 'map'];

function section(
  id: string,
  order: number,
  overrides: Partial<PageSection> = {}
): PageSection {
  return {
    id,
    page_id: 'page-1',
    funnel_id: 'funnel-1',
    type: 'hero',
    content: { marker: id, nested: { values: [id] } },
    order,
    styles: { visible: true, nested: { token: id } },
    variant: 'standard',
    ...overrides
  };
}

function makeDocument(
  sections: PageSection[] = [
    section('section-a', 0),
    section('section-b', 1, { type: 'gallery', variant: 'grid' }),
    section('section-c', 2, { type: 'faq', variant: 'accordion' })
  ]
): BuilderDocument {
  return {
    schemaVersion: 1,
    page: {
      id: 'page-1',
      user_id: 'user-1',
      name: 'Lifecycle page',
      slug: 'lifecycle-page',
      status: 'draft',
      seo_title: 'Lifecycle page',
      seo_description: 'Lifecycle page',
      seo_keywords: [],
      created_at: '2026-08-27T00:00:00.000Z',
      funnel_id: 'funnel-1'
    },
    sections: structuredClone(sections)
  };
}

function expectContiguous(document: BuilderDocument): void {
  expect(document.sections.map(item => item.order)).toEqual(
    document.sections.map((_item, index) => index)
  );
  expect(new Set(document.sections.map(item => item.order)).size)
    .toBe(document.sections.length);
}

describe('section lifecycle add', () => {
  it.each(registeredTypes)('adds registered %s defaults through the registry factory', type => {
    const input = makeDocument([]);
    const before = structuredClone(input);
    const result = addSection(input, {
      type,
      sectionId: `new-${type}`,
      insertionIndex: 0,
      selectedSectionId: null
    });
    const definition = getBuilderSectionDefinition(type);

    expect(result).toMatchObject({
      changed: true,
      affectedSectionId: `new-${type}`,
      selectedSectionId: `new-${type}`,
      reason: null
    });
    expect(result.document.sections[0]).toEqual(createBuilderSection(type, {
      id: `new-${type}`,
      pageId: 'page-1',
      funnelId: 'funnel-1',
      order: 0
    }));
    expect(result.document.sections[0].content).toEqual(definition?.defaultContent);
    expect(result.document.sections[0].styles).toEqual(definition?.defaultStyles);
    expect(input).toEqual(before);
  });

  it.each([
    ['beginning', 0, ['new', 'section-a', 'section-b', 'section-c']],
    ['middle', 1, ['section-a', 'new', 'section-b', 'section-c']],
    ['end', 3, ['section-a', 'section-b', 'section-c', 'new']]
  ] as const)('inserts at the %s and normalizes order', (_label, insertionIndex, ids) => {
    const result = addSection(makeDocument(), {
      type: 'offer',
      sectionId: 'new',
      insertionIndex,
      selectedSectionId: 'section-b'
    });

    expect(result.document.sections.map(item => item.id)).toEqual(ids);
    expect(result.selectedSectionId).toBe('new');
    expectContiguous(result.document);
  });

  it.each([
    ['negative indexes to the beginning', -10, ['new', 'section-a', 'section-b', 'section-c']],
    ['indexes beyond the end to the end', 99, ['section-a', 'section-b', 'section-c', 'new']]
  ] as const)('clamps %s deterministically', (_label, insertionIndex, ids) => {
    const result = addSection(makeDocument(), {
      type: 'hero',
      sectionId: 'new',
      insertionIndex,
      selectedSectionId: null
    });
    expect(result.document.sections.map(item => item.id)).toEqual(ids);
    expectContiguous(result.document);
  });

  it.each([
    ['duplicate ID', { type: 'hero', sectionId: 'section-a', insertionIndex: 0 }, 'section-id-conflict'],
    ['legacy type', { type: 'services', sectionId: 'new', insertionIndex: 0 }, 'section-type-not-registered'],
    ['fixture-only type', { type: 'testimonials', sectionId: 'new', insertionIndex: 0 }, 'section-type-not-registered'],
    ['fractional index', { type: 'hero', sectionId: 'new', insertionIndex: 1.5 }, 'invalid-insertion-index']
  ] as const)('returns an explicit no-op for %s', (_label, options, reason) => {
    const input = makeDocument();
    const before = structuredClone(input);
    const result = addSection(input, {
      ...options,
      selectedSectionId: 'section-b'
    });

    expect(result).toMatchObject({
      changed: false,
      affectedSectionId: null,
      selectedSectionId: 'section-b',
      reason
    });
    expect(result.document).toEqual(before);
    expect(result.document).not.toBe(input);
    expect(input).toEqual(before);
  });
});

describe('section lifecycle duplicate', () => {
  it.each(registeredTypes)('duplicates registered %s sections immediately after the source', type => {
    const source = createBuilderSection(type, {
      id: `source-${type}`,
      pageId: 'page-1',
      funnelId: 'funnel-1',
      order: 0
    });
    source.content = { ...source.content, unknown: { keep: [type] } };
    source.styles = { ...source.styles, visible: false, custom: { keep: type } };
    const input = makeDocument([source, section('tail', 1)]);
    const before = structuredClone(input);
    const result = duplicateSection(input, {
      sectionId: source.id,
      newSectionId: `copy-${type}`,
      selectedSectionId: source.id
    });
    const duplicate = result.document.sections[1];

    expect(result).toMatchObject({
      changed: true,
      affectedSectionId: `copy-${type}`,
      selectedSectionId: `copy-${type}`,
      reason: null
    });
    expect(result.document.sections.map(item => item.id)).toEqual([
      `source-${type}`, `copy-${type}`, 'tail'
    ]);
    expect({ ...duplicate, id: source.id, order: source.order }).toEqual(source);
    expectContiguous(result.document);
    expect(input).toEqual(before);
  });

  it.each(legacyTypes)('duplicates allowlisted legacy %s sections losslessly', type => {
    const legacy = section(`legacy-${type}`, 0, {
      type,
      variant: `legacy-${type}`,
      content: { nested: { values: [type, null, false] } },
      styles: { visible: false, custom: { type } }
    });
    const result = duplicateSection(makeDocument([legacy]), {
      sectionId: legacy.id,
      newSectionId: `copy-${type}`,
      selectedSectionId: legacy.id
    });

    expect(result.changed).toBe(true);
    expect(result.document.sections[1]).toEqual({
      ...legacy,
      id: `copy-${type}`,
      order: 1
    });
  });

  it.each([
    ['Gallery', 'gallery', {
      title: 'Gallery',
      items: [{ id: 'nested-gallery-id', before: 'before.jpg', after: 'after.jpg' }]
    }],
    ['Form', 'form', {
      title: 'Form',
      fields: [{ id: 'nested-form-id', name: 'email', rules: { required: true } }]
    }],
    ['FAQ', 'faq', {
      heading: 'FAQ',
      items: [{ id: 'nested-faq-id', question: 'Q', answer: 'A' }]
    }]
  ] as const)('deep-clones %s nested collections while preserving nested IDs', (_label, type, content) => {
    const source = section('source', 0, {
      type,
      content: structuredClone(content),
      styles: { visible: false, nested: { colors: ['blue'] } }
    });
    const input = makeDocument([source]);
    const result = duplicateSection(input, {
      sectionId: 'source',
      newSectionId: 'copy',
      selectedSectionId: 'source'
    });
    const original = result.document.sections[0];
    const duplicate = result.document.sections[1];

    expect(duplicate.content).toEqual(original.content);
    expect(duplicate.content).not.toBe(original.content);
    expect(duplicate.styles).not.toBe(original.styles);
    const duplicateCollection = duplicate.content.items ?? duplicate.content.fields;
    const originalCollection = original.content.items ?? original.content.fields;
    expect(duplicateCollection).not.toBe(originalCollection);
    expect(duplicateCollection[0]).not.toBe(originalCollection[0]);
    expect(duplicateCollection[0].id).toBe(originalCollection[0].id);

    duplicateCollection[0].id = 'changed-only-on-copy';
    duplicate.styles.nested.colors.push('green');
    expect(originalCollection[0].id).not.toBe('changed-only-on-copy');
    expect(original.styles.nested.colors).toEqual(['blue']);
    expect(input).toEqual(makeDocument([source]));
  });

  it.each([
    ['duplicate ID', { sectionId: 'section-a', newSectionId: 'section-b' }, 'section-id-conflict'],
    ['missing source', { sectionId: 'missing', newSectionId: 'copy' }, 'section-not-found']
  ] as const)('returns an explicit no-op for %s', (_label, options, reason) => {
    const input = makeDocument();
    const before = structuredClone(input);
    const result = duplicateSection(input, {
      ...options,
      selectedSectionId: 'section-c'
    });
    expect(result).toMatchObject({
      changed: false,
      affectedSectionId: null,
      selectedSectionId: 'section-c',
      reason
    });
    expect(result.document).toEqual(before);
    expect(input).toEqual(before);
  });
});

describe('section lifecycle delete', () => {
  it.each([
    ['first', 'section-a', ['section-b', 'section-c'], 'section-b'],
    ['middle', 'section-b', ['section-a', 'section-c'], 'section-c'],
    ['last', 'section-c', ['section-a', 'section-b'], 'section-b']
  ] as const)('deletes the %s section with deterministic selection', (_label, sectionId, ids, selected) => {
    const input = makeDocument();
    const before = structuredClone(input);
    const result = deleteSection(input, { sectionId, selectedSectionId: sectionId });

    expect(result).toMatchObject({
      changed: true,
      affectedSectionId: sectionId,
      selectedSectionId: selected,
      reason: null
    });
    expect(result.document.sections.map(item => item.id)).toEqual(ids);
    expectContiguous(result.document);
    expect(input).toEqual(before);
  });

  it('deletes the only section and clears selection', () => {
    const result = deleteSection(makeDocument([section('only', 0)]), {
      sectionId: 'only',
      selectedSectionId: 'only'
    });
    expect(result.document.sections).toEqual([]);
    expect(result.selectedSectionId).toBeNull();
  });

  it('deletes a hidden section without changing its siblings', () => {
    const hidden = section('hidden', 1, { styles: { visible: false, keep: true } });
    const input = makeDocument([section('before', 0), hidden, section('after', 2)]);
    const result = deleteSection(input, {
      sectionId: 'hidden',
      selectedSectionId: 'hidden'
    });
    expect(result.document.sections.map(item => item.id)).toEqual(['before', 'after']);
    expect(result.document.sections[0].content).toEqual(input.sections[0].content);
    expect(result.document.sections[1].content).toEqual(input.sections[2].content);
    expect(result.selectedSectionId).toBe('after');
  });

  it('returns an explicit no-op for a missing section and preserves selection', () => {
    const input = makeDocument();
    const before = structuredClone(input);
    const result = deleteSection(input, {
      sectionId: 'missing',
      selectedSectionId: 'section-b'
    });
    expect(result).toMatchObject({
      changed: false,
      affectedSectionId: null,
      selectedSectionId: 'section-b',
      reason: 'section-not-found'
    });
    expect(result.document).toEqual(before);
    expect(input).toEqual(before);
  });
});

describe('section lifecycle reorder', () => {
  it.each([
    ['up', 'section-b', -1, ['section-b', 'section-a', 'section-c']],
    ['down', 'section-b', 1, ['section-a', 'section-c', 'section-b']]
  ] as const)('moves one position %s while preserving the section', (_label, sectionId, direction, ids) => {
    const input = makeDocument();
    const before = structuredClone(input);
    const source = structuredClone(input.sections[1]);
    const result = moveSection(input, {
      sectionId,
      direction,
      selectedSectionId: 'section-a'
    });
    const moved = result.document.sections.find(item => item.id === sectionId);

    expect(result).toMatchObject({
      changed: true,
      affectedSectionId: sectionId,
      selectedSectionId: sectionId,
      reason: null
    });
    expect(result.document.sections.map(item => item.id)).toEqual(ids);
    expect({ ...moved, order: source.order }).toEqual(source);
    expectContiguous(result.document);
    expect(input).toEqual(before);
  });

  it.each([
    ['first up', 'section-a', -1, 'move-boundary'],
    ['last down', 'section-c', 1, 'move-boundary'],
    ['missing section', 'missing', 1, 'section-not-found']
  ] as const)('returns an explicit no-op for %s', (_label, sectionId, direction, reason) => {
    const input = makeDocument();
    const before = structuredClone(input);
    const result = moveSection(input, {
      sectionId,
      direction,
      selectedSectionId: 'section-b'
    });
    expect(result).toMatchObject({
      changed: false,
      affectedSectionId: null,
      selectedSectionId: 'section-b',
      reason
    });
    expect(result.document).toEqual(before);
    expect(input).toEqual(before);
  });
});

describe('section lifecycle visibility', () => {
  it.each([
    ['visible to hidden', { visible: true }, false],
    ['hidden to visible', { visible: false }, true],
    ['missing visibility to hidden', { background: '#fff' }, false]
  ] as const)('changes %s using only styles.visible', (_label, styles, visible) => {
    const target = section('target', 0, {
      content: { untouched: { values: [1, 2] } },
      styles: structuredClone(styles),
      variant: 'split'
    });
    const input = makeDocument([target]);
    const before = structuredClone(input);
    const result = setSectionVisibility(input, {
      sectionId: 'target',
      visible,
      selectedSectionId: null
    });
    const changedSection = result.document.sections[0];

    expect(result).toMatchObject({
      changed: true,
      affectedSectionId: 'target',
      selectedSectionId: 'target',
      reason: null
    });
    expect(changedSection).toEqual({
      ...target,
      styles: { ...target.styles, visible }
    });
    expect(input).toEqual(before);
  });

  it.each([
    ['same value', 'section-a', true, 'visibility-unchanged'],
    ['missing visibility already means visible', 'section-without-visibility', true, 'visibility-unchanged'],
    ['missing section', 'missing', false, 'section-not-found']
  ] as const)('returns an explicit no-op for %s', (_label, sectionId, visible, reason) => {
    const input = makeDocument([
      section('section-a', 0),
      section('section-without-visibility', 1, { styles: { background: '#fff' } }),
      section('section-c', 2)
    ]);
    const before = structuredClone(input);
    const result = setSectionVisibility(input, {
      sectionId,
      visible,
      selectedSectionId: 'section-c'
    });
    expect(result).toMatchObject({
      changed: false,
      affectedSectionId: null,
      selectedSectionId: 'section-c',
      reason
    });
    expect(result.document).toEqual(before);
    expect(input).toEqual(before);
  });
});

describe('section lifecycle unknown data preservation', () => {
  it('preserves unknown page, section, content, and style data across operations', () => {
    const extendedSection = {
      ...section('extended', 0, {
        type: 'services',
        content: { unknown: { arrays: [{ value: 1 }] } },
        styles: { visible: true, unknown: { breakpoint: { gap: 12 } } }
      }),
      unknown_top_level: { preserve: ['yes'] }
    } as PageSection;
    const input = makeDocument([extendedSection, section('tail', 1)]);
    (input.page as typeof input.page & { unknown_page: { value: string } })
      .unknown_page = { value: 'preserve' };
    const snapshot = structuredClone(input);

    const duplicated = duplicateSection(input, {
      sectionId: 'extended',
      newSectionId: 'extended-copy',
      selectedSectionId: 'extended'
    });
    const moved = moveSection(duplicated.document, {
      sectionId: 'extended-copy',
      direction: 1,
      selectedSectionId: 'extended-copy'
    });
    const hidden = setSectionVisibility(moved.document, {
      sectionId: 'extended-copy',
      visible: false,
      selectedSectionId: 'extended-copy'
    });

    expect(hidden.document.page).toEqual(input.page);
    expect(hidden.document.sections.find(item => item.id === 'extended'))
      .toEqual(input.sections[0]);
    expect(hidden.document.sections.find(item => item.id === 'extended-copy'))
      .toEqual({
        ...input.sections[0],
        id: 'extended-copy',
        order: 2,
        styles: { ...input.sections[0].styles, visible: false }
      });
    expect(input).toEqual(snapshot);
  });

  it('rejects an invalid input document without weakening validation', () => {
    const input = makeDocument();
    input.sections[1].id = input.sections[0].id;
    const before = structuredClone(input);
    const result = deleteSection(input, {
      sectionId: 'section-a',
      selectedSectionId: 'section-a'
    });
    expect(result).toMatchObject({ changed: false, reason: 'invalid-document' });
    expect(result.document).toEqual(before);
    expect(input).toEqual(before);
  });
});

describe('section lifecycle reset', () => {
  it.each(registeredTypes)('restores all canonical %s defaults and preserves identity', type => {
    const canonical = createBuilderSection(type, {
      id: 'target',
      pageId: 'page-1',
      funnelId: 'funnel-1',
      order: 0
    });
    const customized = {
      ...canonical,
      content: { replaced: { nested: ['custom'] } },
      styles: { visible: false, custom: { padding: 999 } },
      variant: 'custom-variant',
      unknown_metadata: { remove: true }
    } as PageSection;
    const input = makeDocument([customized, section('tail', 1)]);
    const before = structuredClone(input);
    const result = resetSection(input, {
      sectionId: 'target',
      selectedSectionId: 'target'
    });

    expect(result).toMatchObject({
      changed: true,
      affectedSectionId: 'target',
      selectedSectionId: 'target',
      reason: null
    });
    expect(result.document.sections[0]).toEqual(canonical);
    expect(result.document.sections[0]).toMatchObject({
      id: 'target',
      page_id: 'page-1',
      funnel_id: 'funnel-1',
      order: 0,
      type,
      styles: { visible: true }
    });
    expect(input).toEqual(before);
  });

  it.each(['gallery', 'form', 'faq'])('creates independent nested %s defaults', type => {
    const input = makeDocument([section('target', 0, {
      type,
      content: { stale: { nested: ['value'] } },
      styles: { visible: false },
      variant: 'stale'
    })]);
    const priorContent = input.sections[0].content;
    const definition = getBuilderSectionDefinition(type)!;
    const defaultSnapshot = structuredClone(definition.defaultContent);
    const result = resetSection(input, {
      sectionId: 'target',
      selectedSectionId: 'target'
    });

    expect(result.document.sections[0].content).toEqual(defaultSnapshot);
    expect(result.document.sections[0].content).not.toBe(definition.defaultContent);
    expect(result.document.sections[0].styles).not.toBe(definition.defaultStyles);
    expect(result.document.sections[0].content).not.toBe(priorContent);
    const mutable = result.document.sections[0].content as Record<string, unknown>;
    mutable.testMutation = true;
    expect(definition.defaultContent).toEqual(defaultSnapshot);
    expect(input.sections[0].content).toEqual({ stale: { nested: ['value'] } });
  });

  it.each([
    ['missing target', makeDocument(), 'missing', 'section-not-found'],
    ['legacy target', makeDocument([section('legacy', 0, { type: 'services' })]), 'legacy', 'reset-unsupported-section-type'],
    ['already default', makeDocument([createBuilderSection('faq', {
      id: 'default-faq', pageId: 'page-1', funnelId: 'funnel-1', order: 0
    })]), 'default-faq', 'reset-unchanged']
  ] as const)('returns an immutable no-op for %s', (_label, input, sectionId, reason) => {
    const before = structuredClone(input);
    const result = resetSection(input, { sectionId, selectedSectionId: sectionId });

    expect(result).toMatchObject({
      changed: false,
      affectedSectionId: null,
      selectedSectionId: sectionId,
      reason
    });
    expect(result.document).toEqual(before);
    expect(input).toEqual(before);
  });
});

describe('section lifecycle copy', () => {
  it.each(registeredTypes)('copies complete registered %s data without mutation', type => {
    const input = makeDocument([section('target', 0, {
      type,
      content: { nested: { values: [type] } },
      styles: { visible: false, nested: { color: type } },
      variant: 'custom'
    })]);
    const before = structuredClone(input);
    const result = copySection(input, {
      sectionId: 'target',
      selectedSectionId: 'target'
    });

    expect(result).toMatchObject({
      copiedSectionId: 'target',
      selectedSectionId: 'target',
      reason: null,
      clipboard: {
        sourcePageId: 'page-1',
        sourceSectionType: type,
        section: before.sections[0]
      }
    });
    expect(result.clipboard?.section).not.toBe(input.sections[0]);
    expect(result.clipboard?.section.content).not.toBe(input.sections[0].content);
    expect(input).toEqual(before);
  });

  it('copies an allowlisted legacy section with exact independent data', () => {
    const input = makeDocument([section('legacy', 0, {
      type: 'services',
      content: { services: [{ name: 'Driveway' }] },
      styles: { visible: false, layout: { columns: 3 } },
      variant: 'legacy-grid'
    })]);
    const result = copySection(input, {
      sectionId: 'legacy',
      selectedSectionId: null
    });

    expect(result.reason).toBeNull();
    expect(result.selectedSectionId).toBeNull();
    expect(result.clipboard?.section).toEqual(input.sections[0]);
    (input.sections[0].content.services as Array<{ name: string }>)[0].name = 'Changed';
    expect(result.clipboard?.section.content.services[0].name).toBe('Driveway');
  });

  it.each([
    ['missing target', makeDocument(), 'missing', 'section-not-found'],
    ['unsupported text', makeDocument([section('unsupported', 0, { type: 'text' })]), 'unsupported', 'section-type-not-saveable'],
    ['unsupported testimonials', makeDocument([section('unsupported', 0, { type: 'testimonials' })]), 'unsupported', 'section-type-not-saveable']
  ] as const)('rejects %s without a clipboard payload', (_label, input, sectionId, reason) => {
    const before = structuredClone(input);
    const result = copySection(input, { sectionId, selectedSectionId: 'kept' });

    expect(result).toEqual({
      clipboard: null,
      copiedSectionId: null,
      selectedSectionId: 'kept',
      reason
    });
    expect(input).toEqual(before);
  });
});

describe('section lifecycle paste', () => {
  function clipboardFor(
    source: BuilderDocument,
    sectionId = source.sections[0].id
  ) {
    const copied = copySection(source, { sectionId, selectedSectionId: sectionId });
    expect(copied.reason).toBeNull();
    return copied.clipboard!;
  }

  it('pastes immediately after canonical selection with new ownership, order, and selection', () => {
    const source = makeDocument([section('source', 0, {
      type: 'gallery',
      content: { items: [{ before: 'a', after: 'b' }] },
      styles: { visible: false },
      variant: 'grid'
    })]);
    const clipboard = clipboardFor(source);
    const input = makeDocument();
    const before = structuredClone(input);
    const clipboardBefore = structuredClone(clipboard);
    const result = pasteSection(input, {
      clipboard,
      newSectionId: 'sec-pasted',
      selectedSectionId: 'section-b'
    });

    expect(result).toMatchObject({
      changed: true,
      affectedSectionId: 'sec-pasted',
      selectedSectionId: 'sec-pasted',
      reason: null
    });
    expect(result.document.sections.map(item => item.id)).toEqual([
      'section-a', 'section-b', 'sec-pasted', 'section-c'
    ]);
    expect(result.document.sections.map(item => item.order)).toEqual([0, 1, 2, 3]);
    expect(result.document.sections[2]).toMatchObject({
      id: 'sec-pasted',
      page_id: 'page-1',
      funnel_id: 'funnel-1',
      type: 'gallery',
      content: clipboard.section.content,
      styles: clipboard.section.styles,
      variant: 'grid'
    });
    expect(input).toEqual(before);
    expect(clipboard).toEqual(clipboardBefore);
    expect(result.document.sections[2].content).not.toBe(clipboard.section.content);
  });

  it.each([
    ['null selection', null],
    ['stale selection', 'removed']
  ])('appends when %s is unavailable', (_label, selectedSectionId) => {
    const input = makeDocument();
    const clipboard = clipboardFor(makeDocument([section('source', 0)]));
    const result = pasteSection(input, {
      clipboard,
      newSectionId: 'appended',
      selectedSectionId
    });

    expect(result.document.sections.map(item => item.id)).toEqual([
      'section-a', 'section-b', 'section-c', 'appended'
    ]);
    expect(result.selectedSectionId).toBe('appended');
  });

  it('pastes allowlisted legacy data independently on the current page', () => {
    const source = makeDocument([section('legacy-source', 0, {
      type: 'services',
      content: { items: [{ title: 'Soft wash' }] },
      styles: { visible: false, nested: { gap: 4 } },
      variant: 'cards'
    })]);
    const clipboard = clipboardFor(source);
    const input = makeDocument([section('a', 0)]);
    const result = pasteSection(input, {
      clipboard,
      newSectionId: 'legacy-pasted',
      selectedSectionId: 'a'
    });
    const pasted = result.document.sections[1];

    expect(pasted).toEqual({
      ...source.sections[0],
      id: 'legacy-pasted',
      page_id: 'page-1',
      funnel_id: 'funnel-1',
      order: 1
    });
    pasted.content.items[0].title = 'Changed paste';
    expect(clipboard.section.content.items[0].title).toBe('Soft wash');
  });

  it('supports repeated independent paste from the original clipboard', () => {
    const source = makeDocument([section('source', 0, {
      type: 'faq',
      content: { items: [{ question: 'Original?', answer: 'Yes' }] }
    })]);
    const clipboard = clipboardFor(source);
    const first = pasteSection(makeDocument([section('a', 0)]), {
      clipboard,
      newSectionId: 'paste-one',
      selectedSectionId: 'a'
    });
    first.document.sections[1].content.items[0].answer = 'Mutated';
    const second = pasteSection(first.document, {
      clipboard,
      newSectionId: 'paste-two',
      selectedSectionId: 'paste-one'
    });

    expect(second.document.sections.map(item => item.id)).toEqual(['a', 'paste-one', 'paste-two']);
    expect(second.document.sections[2].content.items[0].answer).toBe('Yes');
    expect(second.document.sections[2].content).not.toBe(clipboard.section.content);
    expect(clipboard.section.content.items[0].answer).toBe('Yes');
  });

  it.each(['gallery', 'form', 'faq'])('keeps %s source, clipboard, and repeated pastes independent', type => {
    const source = makeDocument([section('source', 0, {
      type,
      content: { nested: { values: [type] } },
      styles: { visible: true, nested: { token: type } }
    })]);
    const clipboard = clipboardFor(source);
    source.sections[0].content.nested.values[0] = 'source-mutated';
    const first = pasteSection(makeDocument([section('anchor', 0)]), {
      clipboard,
      newSectionId: 'first',
      selectedSectionId: 'anchor'
    });
    first.document.sections[1].content.nested.values[0] = 'paste-mutated';
    const second = pasteSection(first.document, {
      clipboard,
      newSectionId: 'second',
      selectedSectionId: 'first'
    });

    expect(clipboard.section.content.nested.values[0]).toBe(type);
    expect(second.document.sections[2].content.nested.values[0]).toBe(type);
    expect(second.document.sections[2].content).not.toBe(clipboard.section.content);
    expect(second.document.sections[2].styles).not.toBe(clipboard.section.styles);
  });

  it('rejects a valid clipboard from a different page', () => {
    const source = makeDocument([section('source', 0)]);
    source.page.id = 'page-other';
    source.sections[0].page_id = 'page-other';
    const clipboard = clipboardFor(source);
    const input = makeDocument();
    const result = pasteSection(input, {
      clipboard,
      newSectionId: 'cross-page',
      selectedSectionId: 'b'
    });

    expect(result).toMatchObject({
      changed: false,
      selectedSectionId: 'b',
      reason: 'clipboard-page-mismatch'
    });
    expect(result.document).toEqual(input);
  });

  it.each([
    ['missing copied section', { sourcePageId: 'page-1', sourceSectionType: 'hero' }, 'invalid-clipboard'],
    ['malformed snapshot', { sourcePageId: 'page-1', sourceSectionType: 'hero', section: { id: 'x' } }, 'invalid-clipboard'],
    ['unsupported type', {
      sourcePageId: 'page-1',
      sourceSectionType: 'text',
      section: section('unsupported', 0, { type: 'text' })
    }, 'section-type-not-saveable']
  ] as const)('rejects %s', (_label, clipboard, reason) => {
    const input = makeDocument();
    const result = pasteSection(input, {
      clipboard,
      newSectionId: 'pasted',
      selectedSectionId: 'b'
    });

    expect(result).toMatchObject({ changed: false, reason, selectedSectionId: 'b' });
    expect(result.document).toEqual(input);
  });

  it('rejects a pasted ID collision without mutating document or clipboard', () => {
    const input = makeDocument();
    const clipboard = clipboardFor(makeDocument([section('source', 0)]));
    const clipboardBefore = structuredClone(clipboard);
    const result = pasteSection(input, {
      clipboard,
      newSectionId: 'section-b',
      selectedSectionId: 'section-b'
    });

    expect(result).toMatchObject({ changed: false, reason: 'section-id-conflict' });
    expect(result.document).toEqual(input);
    expect(clipboard).toEqual(clipboardBefore);
  });
});
