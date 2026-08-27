import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from './builder_document';
import {
  addSection,
  deleteSection,
  duplicateSection,
  moveSection,
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
