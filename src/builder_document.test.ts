import { describe, expect, it } from 'vitest';
import type { Page, PageSection } from './types';
import {
  builderDocumentToPageSections,
  createBuilderDocument,
  normalizePersistedBuilderSections,
  validateBuilderDocument
} from './builder_document';

function makePage(): Page {
  return {
    id: 'page-1',
    user_id: 'user-1',
    name: 'House Washing',
    slug: 'house-washing',
    status: 'draft',
    seo_title: 'House Washing',
    seo_description: 'Professional house washing.',
    seo_keywords: ['house washing', 'pressure washing'],
    schema_markup: '{"@type":"Service"}',
    created_at: '2026-07-25T00:00:00.000Z',
    funnel_id: 'funnel-1',
    step_type: 'landing',
    step_order: 1
  };
}

function makeSections(): PageSection[] {
  return [
    {
      id: 'section-later',
      page_id: 'page-1',
      funnel_id: 'funnel-1',
      type: 'gallery',
      variant: 'before-after',
      order: 20,
      content: {
        heading: 'Recent work',
        unknownNested: {
          items: [{ before: 'before.jpg', after: 'after.jpg' }]
        }
      },
      styles: {
        visible: false,
        unknownStyle: {
          mobile: { columns: 1 },
          desktop: { columns: 3 }
        }
      }
    },
    {
      id: 'section-first-tie',
      page_id: 'page-1',
      type: 'hero',
      variant: 'split',
      order: 10,
      content: { heading: 'A cleaner home starts here' },
      styles: { background: '#ffffff' }
    },
    {
      id: 'section-second-tie',
      page_id: 'page-1',
      type: 'proof',
      order: 10,
      content: { rating: 5 },
      styles: { color: '#111827' }
    }
  ];
}

describe('BuilderDocument adapter', () => {
  it('does not mutate inputs and deep-clones unknown content and style fields', () => {
    const page = makePage();
    const sections = makeSections();
    const originalPage = structuredClone(page);
    const originalSections = structuredClone(sections);

    const document = createBuilderDocument(page, sections);
    document.page.seo_keywords.push('mutated document only');
    document.sections[2].content.unknownNested.items[0].before = 'changed.jpg';
    document.sections[2].styles.unknownStyle.mobile.columns = 2;

    expect(page).toEqual(originalPage);
    expect(sections).toEqual(originalSections);
  });

  it('sorts by order while preserving input order for duplicate order values', () => {
    const document = createBuilderDocument(makePage(), makeSections());

    expect(document.sections.map(section => section.id)).toEqual([
      'section-first-tie',
      'section-second-tie',
      'section-later'
    ]);
  });

  it('reports duplicate IDs and other ordinary validation failures without throwing', () => {
    const document = createBuilderDocument(makePage(), makeSections());
    document.sections[1].id = document.sections[0].id;

    const issues = validateBuilderDocument(document);

    expect(issues.some(issue => issue.code === 'duplicate_section_id')).toBe(true);
  });

  it('preserves representative section data through a round trip', () => {
    const originalSections = makeSections();
    const document = createBuilderDocument(makePage(), originalSections);
    const roundTripped = builderDocumentToPageSections(document);

    expect(roundTripped).toEqual([
      originalSections[1],
      originalSections[2],
      originalSections[0]
    ]);
    expect(roundTripped[2]).not.toBe(originalSections[0]);
    expect(roundTripped[2].content).not.toBe(originalSections[0].content);
    expect(roundTripped[2].styles).not.toBe(originalSections[0].styles);
  });

  it('normalizes an exact one-based mixed legacy document to zero-based order losslessly', () => {
    const types = ['hero', 'services', 'benefits', 'before_after', 'cta', 'contact_info', 'map'];
    const sections = types.map((type, index): PageSection => ({
      id: `legacy-${type}`,
      page_id: 'page-1',
      funnel_id: 'funnel-1',
      type,
      variant: `legacy-${index}`,
      order: index + 1,
      content: { marker: type, nested: { values: [index, null, false] } },
      styles: { visible: index % 2 === 0, custom: { token: `style-${index}` } }
    }));

    const document = createBuilderDocument(makePage(), sections);
    const roundTripped = builderDocumentToPageSections(document);

    expect(roundTripped.map(section => section.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(roundTripped.map(({ order: _order, ...section }) => section)).toEqual(
      sections.map(({ order: _order, ...section }) => section)
    );
    expect(sections.map(section => section.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('leaves zero-based documents and non-canonical order shapes unchanged', () => {
    const zeroBased = makeSections().map((section, index) => ({ ...section, order: index }));
    const sparse = makeSections().map((section, index) => ({ ...section, order: index * 2 + 1 }));

    expect(normalizePersistedBuilderSections(zeroBased).map(section => section.order)).toEqual([0, 1, 2]);
    expect(normalizePersistedBuilderSections(sparse).map(section => section.order)).toEqual([1, 3, 5]);
  });

  it('detects unsupported versions, missing fields, page mismatches, invalid orders, and ordering errors', () => {
    const invalidDocument = {
      schemaVersion: 2,
      page: { ...makePage(), id: '' },
      sections: [
        {
          ...makeSections()[0],
          id: '',
          type: '',
          page_id: 'different-page',
          order: Number.NaN
        },
        {
          ...makeSections()[1],
          order: 20
        },
        {
          ...makeSections()[2],
          order: 10
        }
      ]
    };
    const mismatchedPageDocument = createBuilderDocument(makePage(), makeSections());
    mismatchedPageDocument.sections[0].page_id = 'different-page';

    const codes = [
      ...validateBuilderDocument(
        invalidDocument as unknown as Parameters<typeof validateBuilderDocument>[0]
      ),
      ...validateBuilderDocument(mismatchedPageDocument)
    ].map(issue => issue.code);

    expect(codes).toEqual(expect.arrayContaining([
      'unsupported_schema_version',
      'missing_page_id',
      'missing_section_id',
      'missing_section_type',
      'section_page_mismatch',
      'invalid_section_order',
      'sections_out_of_order'
    ]));
  });
});
