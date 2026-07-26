import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from './builder_document';
import { createBuilderDocument } from './builder_document';
import {
  createBuilderDocumentFingerprint,
  createBuilderPublishedRevision,
  getBuilderPublicationState,
  hasBuilderUnpublishedChanges,
  validateBuilderPublishedRevision
} from './builder_publication';
import type {
  BuilderPublicationState,
  BuilderPublishedRevision,
  BuilderPublishedRevisionValidationIssue,
  BuilderPublishedRevisionValidationIssueCode,
  CreateBuilderPublishedRevisionOptions
} from './builder_publication';
import type { Page, PageSection } from './types';

function makeDocument(): BuilderDocument {
  const page: Page = {
    id: 'page-1',
    user_id: 'user-1',
    name: 'Pressure Washing',
    slug: 'pressure-washing',
    status: 'draft',
    seo_title: 'Pressure Washing',
    seo_description: 'Professional exterior cleaning.',
    seo_keywords: ['pressure washing'],
    schema_markup: '{"@type":"Service"}',
    created_at: '2026-07-25T12:00:00.000Z',
    funnel_id: 'funnel-1',
    step_type: 'landing',
    step_order: 1
  };
  const sections: PageSection[] = [
    {
      id: 'gallery-1',
      page_id: page.id,
      funnel_id: page.funnel_id,
      type: 'gallery',
      variant: 'comparison',
      order: 20,
      content: {
        heading: 'Recent work',
        items: [{ before: 'before.jpg', after: 'after.jpg' }],
        unknown: { nested: true }
      },
      styles: {
        visible: true,
        responsive: { mobile: { columns: 1 }, desktop: { columns: 3 } }
      }
    },
    {
      id: 'hero-1',
      page_id: page.id,
      funnel_id: page.funnel_id,
      type: 'hero',
      variant: 'standard',
      order: 10,
      content: {
        heading: 'Restore your curb appeal',
        cta: { label: 'Request a quote', href: '#quote' }
      },
      styles: {
        background: '#0f172a',
        spacing: { top: 64, bottom: 64 }
      }
    }
  ];

  return createBuilderDocument(page, sections);
}

function makeOptions(): CreateBuilderPublishedRevisionOptions {
  return {
    id: 'revision-1',
    websiteId: 'website-1',
    createdAt: '2026-07-25T12:34:56.000Z',
    createdBy: 'user-1'
  };
}

function makeRevision(): BuilderPublishedRevision {
  return createBuilderPublishedRevision(makeDocument(), makeOptions());
}

function mutableRevision(revision = makeRevision()): BuilderPublishedRevision {
  return structuredClone(revision);
}

describe('Builder publication public contract and revision creation', () => {
  it('exports the requested types and callable functions', () => {
    const state: BuilderPublicationState = 'published';
    const code: BuilderPublishedRevisionValidationIssueCode = 'invalid-document';
    const issue: BuilderPublishedRevisionValidationIssue = {
      code,
      message: 'message',
      path: 'document'
    };

    expect(state).toBe('published');
    expect(issue.code).toBe('invalid-document');
    expect(typeof createBuilderPublishedRevision).toBe('function');
    expect(typeof validateBuilderPublishedRevision).toBe('function');
    expect(typeof createBuilderDocumentFingerprint).toBe('function');
    expect(typeof getBuilderPublicationState).toBe('function');
    expect(typeof hasBuilderUnpublishedChanges).toBe('function');
  });

  it('preserves supplied revision metadata', () => {
    const revision = makeRevision();

    expect(revision).toMatchObject({
      schemaVersion: 1,
      id: 'revision-1',
      websiteId: 'website-1',
      createdAt: '2026-07-25T12:34:56.000Z',
      createdBy: 'user-1'
    });
  });

  it('takes pageId from document.page.id', () => {
    expect(makeRevision().pageId).toBe('page-1');
  });

  it('omits createdBy when it is not supplied', () => {
    const options = makeOptions();
    delete options.createdBy;

    const revision = createBuilderPublishedRevision(makeDocument(), options);

    expect('createdBy' in revision).toBe(false);
  });

  it('does not mutate its document or options inputs', () => {
    const document = makeDocument();
    const options = makeOptions();
    const documentSnapshot = structuredClone(document);
    const optionsSnapshot = structuredClone(options);

    createBuilderPublishedRevision(document, options);

    expect(document).toEqual(documentSnapshot);
    expect(options).toEqual(optionsSnapshot);
  });

  it('deep-clones the document into the revision', () => {
    const document = makeDocument();
    const revision = createBuilderPublishedRevision(document, makeOptions());

    expect(revision.document).toEqual(document);
    expect(revision.document).not.toBe(document);
    expect(revision.document.page).not.toBe(document.page);
    expect(revision.document.sections).not.toBe(document.sections);
    expect(revision.document.sections[0].content).not.toBe(document.sections[0].content);
    expect(revision.document.sections[0].styles).not.toBe(document.sections[0].styles);
  });

  it('deep-freezes the revision and all nested document values', () => {
    const revision = makeRevision();
    const section = revision.document.sections[0];

    expect(Object.isFrozen(revision)).toBe(true);
    expect(Object.isFrozen(revision.document)).toBe(true);
    expect(Object.isFrozen(revision.document.page)).toBe(true);
    expect(Object.isFrozen(revision.document.page.seo_keywords)).toBe(true);
    expect(Object.isFrozen(revision.document.sections)).toBe(true);
    expect(Object.isFrozen(section)).toBe(true);
    expect(Object.isFrozen(section.content)).toBe(true);
    expect(Object.isFrozen(section.content.cta)).toBe(true);
    expect(Object.isFrozen(section.styles)).toBe(true);
    expect(Object.isFrozen(section.styles.spacing)).toBe(true);
  });

  it('leaves the original document independently mutable', () => {
    const document = makeDocument();
    const revision = createBuilderPublishedRevision(document, makeOptions());

    document.page.name = 'Changed draft';
    document.sections[0].content.heading = 'Changed draft heading';
    document.sections[0].styles.background = '#ffffff';

    expect(revision.document.page.name).toBe('Pressure Washing');
    expect(revision.document.sections[0].content.heading).toBe('Restore your curb appeal');
    expect(revision.document.sections[0].styles.background).toBe('#0f172a');
  });

  it('does not share nested references between separate revisions', () => {
    const document = makeDocument();
    const first = createBuilderPublishedRevision(document, makeOptions());
    const second = createBuilderPublishedRevision(document, {
      ...makeOptions(),
      id: 'revision-2'
    });

    expect(first.document).not.toBe(second.document);
    expect(first.document.page).not.toBe(second.document.page);
    expect(first.document.sections[0].content).not.toBe(second.document.sections[0].content);
    expect(first.document.sections[0].styles).not.toBe(second.document.sections[0].styles);
  });

  it('throws clearly for a blank revision ID', () => {
    expect(() => createBuilderPublishedRevision(makeDocument(), {
      ...makeOptions(),
      id: '   '
    })).toThrow('Builder published revision ID is required.');
  });

  it('throws clearly for a blank website ID', () => {
    expect(() => createBuilderPublishedRevision(makeDocument(), {
      ...makeOptions(),
      websiteId: ''
    })).toThrow('Builder published revision website ID is required.');
  });

  it('throws clearly for a missing document page ID', () => {
    const document = makeDocument();
    document.page.id = '';

    expect(() => createBuilderPublishedRevision(document, makeOptions()))
      .toThrow('Builder published revision document page ID is required.');
  });

  it('throws clearly for an invalid createdAt value', () => {
    expect(() => createBuilderPublishedRevision(makeDocument(), {
      ...makeOptions(),
      createdAt: '2026-02-30T12:00:00Z'
    })).toThrow('Builder published revision createdAt must be a valid ISO-8601 date-time string.');
  });
});

describe('Builder document fingerprints', () => {
  it('is deterministic for equivalent documents', () => {
    expect(createBuilderDocumentFingerprint(makeDocument()))
      .toBe(createBuilderDocumentFingerprint(makeDocument()));
  });

  it('ignores plain-object key insertion order recursively', () => {
    const first = makeDocument();
    const second = makeDocument();
    first.sections[0].content.metadata = {
      alpha: 1,
      nested: { first: true, second: false }
    };
    second.sections[0].content.metadata = {
      nested: { second: false, first: true },
      alpha: 1
    };

    expect(createBuilderDocumentFingerprint(first))
      .toBe(createBuilderDocumentFingerprint(second));
  });

  it('changes for meaningful page metadata edits', () => {
    const first = makeDocument();
    const second = makeDocument();
    second.page.seo_title = 'Updated SEO title';

    expect(createBuilderDocumentFingerprint(first))
      .not.toBe(createBuilderDocumentFingerprint(second));
  });

  it('changes for section content edits', () => {
    const first = makeDocument();
    const second = makeDocument();
    second.sections[0].content.heading = 'Updated heading';

    expect(createBuilderDocumentFingerprint(first))
      .not.toBe(createBuilderDocumentFingerprint(second));
  });

  it('changes for section style edits', () => {
    const first = makeDocument();
    const second = makeDocument();
    second.sections[0].styles.background = '#ffffff';

    expect(createBuilderDocumentFingerprint(first))
      .not.toBe(createBuilderDocumentFingerprint(second));
  });

  it('changes for section variant edits', () => {
    const first = makeDocument();
    const second = makeDocument();
    second.sections[0].variant = 'split';

    expect(createBuilderDocumentFingerprint(first))
      .not.toBe(createBuilderDocumentFingerprint(second));
  });

  it('changes when a section order value changes', () => {
    const first = makeDocument();
    const second = makeDocument();
    second.sections[0].order = 30;

    expect(createBuilderDocumentFingerprint(first))
      .not.toBe(createBuilderDocumentFingerprint(second));
  });

  it('normalizes equivalent section arrays by their order fields', () => {
    const first = makeDocument();
    const second = makeDocument();
    second.sections.reverse();

    expect(createBuilderDocumentFingerprint(first))
      .toBe(createBuilderDocumentFingerprint(second));
  });

  it('includes unknown nested fields', () => {
    const first = makeDocument();
    const second = makeDocument();
    second.sections[1].content.unknown.additional = 'meaningful';

    expect(createBuilderDocumentFingerprint(first))
      .not.toBe(createBuilderDocumentFingerprint(second));
  });

  it('handles undefined consistently without conflating it with a missing key', () => {
    const first = makeDocument();
    const second = makeDocument();
    first.sections[0].content.optional = undefined;

    expect(createBuilderDocumentFingerprint(first))
      .not.toBe(createBuilderDocumentFingerprint(second));
    expect(createBuilderDocumentFingerprint(first))
      .toBe(createBuilderDocumentFingerprint(structuredClone(first)));
  });

  it('throws clearly for circular values', () => {
    const document = makeDocument();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    document.sections[0].content.circular = circular;

    expect(() => createBuilderDocumentFingerprint(document))
      .toThrow(/circular structure.*document\.sections/i);
  });
});

describe('Builder publication state', () => {
  it('returns never-published when no revision exists', () => {
    expect(getBuilderPublicationState(makeDocument())).toBe('never-published');
    expect(getBuilderPublicationState(makeDocument(), null)).toBe('never-published');
  });

  it('returns published for a matching revision', () => {
    const document = makeDocument();
    const revision = createBuilderPublishedRevision(document, makeOptions());

    expect(getBuilderPublicationState(document, revision)).toBe('published');
  });

  it('returns changes-pending for a changed draft', () => {
    const document = makeDocument();
    const revision = createBuilderPublishedRevision(document, makeOptions());
    document.sections[0].content.heading = 'Changed after publication';

    expect(getBuilderPublicationState(document, revision)).toBe('changes-pending');
  });

  it('reports unpublished changes consistently with all publication states', () => {
    const document = makeDocument();
    const revision = createBuilderPublishedRevision(document, makeOptions());

    expect(hasBuilderUnpublishedChanges(document)).toBe(true);
    expect(hasBuilderUnpublishedChanges(document, revision)).toBe(false);

    document.page.name = 'Changed draft';
    expect(hasBuilderUnpublishedChanges(document, revision)).toBe(true);
  });

  it('recomputes the published document fingerprint instead of trusting stale metadata', () => {
    const draft = makeDocument();
    const revision = mutableRevision();
    revision.document.page.name = 'Older published page';
    revision.documentFingerprint = createBuilderDocumentFingerprint(draft);

    expect(getBuilderPublicationState(draft, revision)).toBe('changes-pending');
    expect(hasBuilderUnpublishedChanges(draft, revision)).toBe(true);
  });
});

describe('Builder published revision validation', () => {
  it('detects unsupported schema version, missing IDs, and invalid createdAt', () => {
    const revision = mutableRevision() as unknown as Record<string, unknown>;
    revision.schemaVersion = 2;
    revision.id = ' ';
    revision.websiteId = '';
    revision.pageId = '';
    revision.createdAt = 'not-a-date';

    const codes = validateBuilderPublishedRevision(
      revision as unknown as BuilderPublishedRevision
    ).map(issue => issue.code);

    expect(codes).toEqual(expect.arrayContaining([
      'unsupported-schema-version',
      'missing-revision-id',
      'missing-website-id',
      'missing-page-id',
      'invalid-created-at'
    ]));
  });

  it('detects a revision/document page ID mismatch', () => {
    const revision = mutableRevision();
    revision.pageId = 'different-page';

    expect(validateBuilderPublishedRevision(revision))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'document-page-id-mismatch',
          path: 'document.page.id'
        })
      ]));
  });

  it('converts nested BuilderDocument issues and preserves useful paths and meaning', () => {
    const revision = mutableRevision();
    revision.document.sections[0].id = '';
    revision.document.sections[0].type = '';
    revision.document.sections[0].page_id = 'different-page';

    const issues = validateBuilderPublishedRevision(revision);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'invalid-document',
        path: 'document.sections[0].id',
        message: expect.stringContaining('missing_section_id')
      }),
      expect.objectContaining({
        code: 'invalid-document',
        path: 'document.sections[0].type',
        message: expect.stringContaining('missing_section_type')
      }),
      expect.objectContaining({
        code: 'invalid-document',
        path: 'document.sections[0].page_id',
        message: expect.stringContaining('section_page_mismatch')
      })
    ]));
  });

  it('detects a missing or blank fingerprint', () => {
    const revision = mutableRevision();
    revision.documentFingerprint = ' ';

    expect(validateBuilderPublishedRevision(revision))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-fingerprint' })
      ]));
  });

  it('detects a fingerprint that differs from the revision document', () => {
    const revision = mutableRevision();
    revision.documentFingerprint = 'fnv1a32:00000000:0';

    expect(validateBuilderPublishedRevision(revision))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-fingerprint',
          message: expect.stringContaining('does not match')
        })
      ]));
  });

  it('does not mutate the revision while validating it', () => {
    const revision = mutableRevision();
    revision.documentFingerprint = 'stale';
    const snapshot = structuredClone(revision);

    validateBuilderPublishedRevision(revision);

    expect(revision).toEqual(snapshot);
  });

  it('supports unknown custom section types and preserves their nested data', () => {
    const document = makeDocument();
    document.sections.push({
      id: 'custom-1',
      page_id: document.page.id,
      funnel_id: document.page.funnel_id,
      type: 'custom-pressure-washing-calculator',
      variant: 'advanced',
      order: 30,
      content: { formula: { squareFeet: true, multiplier: 0.25 } },
      styles: { custom: { accent: '#22c55e' } }
    });

    const revision = createBuilderPublishedRevision(document, makeOptions());

    expect(validateBuilderPublishedRevision(revision)).toEqual([]);
    expect(revision.document.sections[2]).toEqual(document.sections[2]);
  });
});
