import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from './builder_document';
import { createBuilderDocument } from './builder_document';
import {
  createBuilderPublishedRevision
} from './builder_publication';
import type { BuilderPublishedRevision } from './builder_publication';
import {
  builderPublishedRevisionFromRow,
  builderPublishedRevisionToRow,
  InMemoryBuilderPublicationRepository
} from './builder_publication_repository';
import type {
  BuilderPublicationAccessResolver,
  BuilderPublicationListOptions,
  BuilderPublicationRepository,
  BuilderPublicationTarget,
  BuilderPublishedRevisionRow,
  BuilderPublishRevisionInput
} from './builder_publication_repository';
import type { Page, PageSection, RepoResponse, User } from './types';

function makeDocument(
  pageId = 'page-1',
  heading = 'Professional pressure washing',
  sectionType = 'hero'
): BuilderDocument {
  const page: Page = {
    id: pageId,
    user_id: 'owner',
    name: 'Pressure Washing',
    slug: 'pressure-washing',
    status: 'draft',
    seo_title: 'Pressure Washing',
    seo_description: 'Exterior cleaning services.',
    seo_keywords: ['pressure washing'],
    created_at: '2026-07-25T00:00:00.000Z',
    funnel_id: 'funnel-1'
  };
  const sections: PageSection[] = [{
    id: `section-${pageId}`,
    page_id: pageId,
    funnel_id: page.funnel_id,
    type: sectionType,
    variant: 'standard',
    order: 10,
    content: {
      heading,
      unknownNested: {
        enabled: true,
        optional: undefined,
        items: [{ label: 'Preserved' }]
      }
    },
    styles: {
      visible: true,
      unknownStyle: { desktop: { gap: 24 } }
    }
  }];

  return createBuilderDocument(page, sections);
}

interface MakeRevisionOptions {
  websiteId?: string;
  pageId?: string;
  createdAt?: string;
  createdBy?: string;
  heading?: string;
  sectionType?: string;
}

function makeRevision(
  id: string,
  options: MakeRevisionOptions = {}
): BuilderPublishedRevision {
  const websiteId = options.websiteId ?? 'website-1';
  const pageId = options.pageId ?? 'page-1';
  return createBuilderPublishedRevision(
    makeDocument(pageId, options.heading ?? id, options.sectionType ?? 'hero'),
    {
      id,
      websiteId,
      createdAt: options.createdAt ?? '2026-07-25T12:00:00.000Z',
      ...(options.createdBy === undefined ? {} : { createdBy: options.createdBy })
    }
  );
}

const canAccessPage: BuilderPublicationAccessResolver = (user, websiteId) => {
  const userId = typeof user === 'string' ? user : user.id;
  if (userId === 'owner') return websiteId === 'website-1';
  if (userId === 'owner-2') return websiteId === 'website-2';
  return false;
};

function makeRepository(
  revisions: readonly BuilderPublishedRevision[] = [],
  targets: readonly BuilderPublicationTarget[] = []
): InMemoryBuilderPublicationRepository {
  return new InMemoryBuilderPublicationRepository({
    canAccessPage,
    revisions,
    targets
  });
}

function publishInput(
  revisionId: string,
  overrides: Partial<BuilderPublishRevisionInput> = {}
): BuilderPublishRevisionInput {
  return {
    websiteId: 'website-1',
    pageId: 'page-1',
    revisionId,
    publishedAt: '2026-07-25T13:00:00.000Z',
    ...overrides
  };
}

function expectFailure(
  response: RepoResponse<unknown>,
  code?: string
): void {
  expect(response.success).toBe(false);
  expect(response.data).toBeUndefined();
  if (code) expect(response.code).toBe(code);
}

describe('Builder publication row mapping', () => {
  it('maps a persisted row to the immutable domain revision', () => {
    const original = makeRevision('revision-1', { createdBy: 'owner' });
    const row: BuilderPublishedRevisionRow = {
      schema_version: 1,
      id: original.id,
      website_id: original.websiteId,
      page_id: original.pageId,
      created_at: original.createdAt,
      created_by: original.createdBy,
      document: structuredClone(original.document),
      document_fingerprint: original.documentFingerprint
    };

    const mapped = builderPublishedRevisionFromRow(row);

    expect(mapped).toEqual(original);
    expect(Object.isFrozen(mapped)).toBe(true);
    expect(Object.isFrozen(mapped.document.sections[0].content.unknownNested)).toBe(true);
  });

  it('maps a domain revision to snake_case row fields', () => {
    const revision = makeRevision('revision-1', { createdBy: 'owner' });

    expect(builderPublishedRevisionToRow(revision)).toEqual({
      schema_version: 1,
      id: 'revision-1',
      website_id: 'website-1',
      page_id: 'page-1',
      created_at: '2026-07-25T12:00:00.000Z',
      created_by: 'owner',
      document: revision.document,
      document_fingerprint: revision.documentFingerprint
    });
  });

  it('preserves custom sections and unknown nested document fields', () => {
    const revision = makeRevision('custom-1', {
      sectionType: 'custom-pressure-washing-estimator'
    });

    const mapped = builderPublishedRevisionFromRow(
      builderPublishedRevisionToRow(revision)
    );

    expect(mapped.document.sections[0].type).toBe('custom-pressure-washing-estimator');
    expect(mapped.document.sections[0].content.unknownNested).toEqual({
      enabled: true,
      optional: undefined,
      items: [{ label: 'Preserved' }]
    });
    expect(mapped.document.sections[0].styles.unknownStyle.desktop.gap).toBe(24);
  });

  it('does not share document references in either mapping direction', () => {
    const revision = makeRevision('revision-1');
    const row = builderPublishedRevisionToRow(revision);
    const mapped = builderPublishedRevisionFromRow(row);

    expect(row.document).not.toBe(revision.document);
    expect(row.document.sections[0].content).not.toBe(revision.document.sections[0].content);
    expect(mapped.document).not.toBe(row.document);
    expect(mapped.document.sections[0].styles).not.toBe(row.document.sections[0].styles);
  });

  it('rejects a persisted row with an invalid fingerprint', () => {
    const row = builderPublishedRevisionToRow(makeRevision('revision-1'));
    row.document_fingerprint = 'stale-fingerprint';

    expect(() => builderPublishedRevisionFromRow(row))
      .toThrow(/Invalid BuilderPublishedRevisionRow.*fingerprint/i);
  });
});

describe('Builder publication revision creation and reads', () => {
  it('implements the exact repository contract and creates for an authorized user', async () => {
    const repository: BuilderPublicationRepository = makeRepository();
    const revision = makeRevision('revision-1', { createdBy: 'owner' });

    const response = await repository.createRevision(revision, 'owner');

    expect(response).toEqual({ success: true, data: revision });
  });

  it('rejects unauthorized revision creation', async () => {
    const response = await makeRepository().createRevision(
      makeRevision('revision-1'),
      'intruder'
    );

    expectFailure(response, 'UNAUTHORIZED');
  });

  it('rejects createdBy that differs from the acting user ID', async () => {
    const response = await makeRepository().createRevision(
      makeRevision('revision-1', { createdBy: 'someone-else' }),
      'owner'
    );

    expectFailure(response, 'UNAUTHORIZED');
  });

  it('returns invalid-input for an invalid revision without throwing', async () => {
    const invalid = structuredClone(makeRevision('revision-1'));
    invalid.document.sections[0].id = '';

    const response = await makeRepository().createRevision(invalid, 'owner');

    expectFailure(response, 'INVALID_INPUT');
    expect(response.error).toContain('Section ID is required');
  });

  it('rejects duplicate revision IDs without replacing the stored revision', async () => {
    const repository = makeRepository();
    const first = makeRevision('revision-1', { heading: 'First' });
    const duplicate = makeRevision('revision-1', { heading: 'Duplicate' });
    await repository.createRevision(first, 'owner');

    const response = await repository.createRevision(duplicate, 'owner');
    const stored = await repository.getRevisionById('revision-1', 'owner');

    expectFailure(response, 'CONFLICT');
    expect(stored.data?.document.sections[0].content.heading).toBe('First');
  });

  it('allows identical document fingerprints under different revision IDs', async () => {
    const repository = makeRepository();
    const first = makeRevision('revision-1', { heading: 'Same' });
    const second = createBuilderPublishedRevision(first.document, {
      id: 'revision-2',
      websiteId: first.websiteId,
      createdAt: first.createdAt
    });

    expect((await repository.createRevision(first, 'owner')).success).toBe(true);
    expect((await repository.createRevision(second, 'owner')).success).toBe(true);
    expect(first.documentFingerprint).toBe(second.documentFingerprint);
  });

  it('does not create a publication target while creating a revision', async () => {
    const repository = makeRepository();
    await repository.createRevision(makeRevision('revision-1'), 'owner');

    expect(await repository.getPublicationTarget('website-1', 'page-1', 'owner'))
      .toEqual({ success: true, data: null });
  });

  it('scopes reads by ID through the external access resolver', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);

    expectFailure(
      await repository.getRevisionById('revision-1', 'intruder'),
      'UNAUTHORIZED'
    );
    expect((await repository.getRevisionById('missing', 'intruder')).error).toBe('NOT_FOUND');
  });

  it('returns independent deeply immutable clones for separate reads', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);
    const first = (await repository.getRevisionById('revision-1', 'owner')).data!;
    const second = (await repository.getRevisionById('revision-1', 'owner')).data!;

    expect(first).not.toBe(second);
    expect(first.document).not.toBe(second.document);
    expect(first.document.sections[0].content).not.toBe(second.document.sections[0].content);
    expect(Object.isFrozen(first.document.sections[0].styles.unknownStyle)).toBe(true);
  });
});

describe('Builder publication history', () => {
  it('includes only revisions for the requested website and page', async () => {
    const repository = makeRepository([
      makeRevision('matching'),
      makeRevision('other-page', { pageId: 'page-2' }),
      makeRevision('other-website', { websiteId: 'website-2' })
    ]);

    const response = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(response.data?.items.map(item => item.id)).toEqual(['matching']);
  });

  it('sorts by createdAt descending and revision ID descending for ties', async () => {
    const repository = makeRepository([
      makeRevision('revision-a', { createdAt: '2026-07-25T12:00:00.000Z' }),
      makeRevision('revision-c', { createdAt: '2026-07-25T12:00:00.000Z' }),
      makeRevision('revision-b', { createdAt: '2026-07-25T13:00:00.000Z' })
    ]);

    const response = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(response.data?.items.map(item => item.id)).toEqual([
      'revision-b', 'revision-c', 'revision-a'
    ]);
  });

  it('defaults history limit to 25', async () => {
    const revisions = Array.from({ length: 30 }, (_, index) => (
      makeRevision(`revision-${String(index).padStart(2, '0')}`)
    ));

    const response = await makeRepository(revisions).listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(response.data?.items).toHaveLength(25);
    expect(response.data?.nextCursor).toBeTypeOf('string');
  });

  it('caps requested history limits at 100', async () => {
    const revisions = Array.from({ length: 105 }, (_, index) => (
      makeRevision(`revision-${String(index).padStart(3, '0')}`)
    ));

    const response = await makeRepository(revisions).listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 1000 }
    );

    expect(response.data?.items).toHaveLength(100);
    expect(response.data?.nextCursor).toBeTypeOf('string');
  });

  it('rejects limits below one or non-finite limits', async () => {
    const repository = makeRepository();
    const options: BuilderPublicationListOptions[] = [
      { limit: 0 },
      { limit: -1 },
      { limit: Number.NaN },
      { limit: Number.POSITIVE_INFINITY }
    ];

    for (const option of options) {
      expectFailure(
        await repository.listRevisionsForPage(
          'website-1', 'page-1', 'owner', option
        ),
        'INVALID_INPUT'
      );
    }
  });

  it('paginates deterministically after the cursor revision', async () => {
    const repository = makeRepository([
      makeRevision('revision-c'),
      makeRevision('revision-b'),
      makeRevision('revision-a')
    ]);
    const first = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 1 }
    );
    const second = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner', {
        limit: 1,
        cursor: first.data?.nextCursor
      }
    );

    expect(first.data?.items[0].id).toBe('revision-c');
    expect(second.data?.items[0].id).toBe('revision-b');
    expect(second.data?.nextCursor).toBeTypeOf('string');
  });

  it('rejects malformed and page-unknown cursors', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);
    const malformed = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner', { cursor: 'not valid!' }
    );
    const otherPage = await repository.listRevisionsForPage(
      'website-1', 'page-2', 'owner', { cursor: 'cmV2aXNpb24tMQ' }
    );

    expectFailure(malformed, 'INVALID_INPUT');
    expectFailure(otherPage, 'INVALID_INPUT');
  });
});

describe('Builder publication targets and publishing', () => {
  it('returns null for a page without a target', async () => {
    expect(await makeRepository().getPublicationTarget(
      'website-1', 'page-1', 'owner'
    )).toEqual({ success: true, data: null });
  });

  it('rejects invalid or timezone-free publication timestamps without creating a target', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);

    const response = await repository.publishRevision(
      publishInput('revision-1', { publishedAt: '2026-07-25T13:00:00' }),
      'owner'
    );
    const target = await repository.getPublicationTarget(
      'website-1', 'page-1', 'owner'
    );

    expectFailure(response, 'INVALID_INPUT');
    expect(target).toEqual({ success: true, data: null });
  });

  it('creates the first target when publishing a stored revision', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);

    const response = await repository.publishRevision(
      publishInput('revision-1'), 'owner'
    );

    expect(response.success).toBe(true);
    expect(response.data?.target).toMatchObject({
      websiteId: 'website-1',
      pageId: 'page-1',
      publishedRevisionId: 'revision-1',
      publishedBy: 'owner'
    });
  });

  it('returns previousRevisionId null on the first publish', async () => {
    const response = await makeRepository([makeRevision('revision-1')])
      .publishRevision(publishInput('revision-1'), 'owner');

    expect(response.data?.previousRevisionId).toBeNull();
  });

  it('returns the previous revision ID when publishing another revision', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    const response = await repository.publishRevision(
      publishInput('revision-2'), 'owner'
    );

    expect(response.data?.previousRevisionId).toBe('revision-1');
    expect(response.data?.target.publishedRevisionId).toBe('revision-2');
  });

  it('resolves the published revision through the live target', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    const response = await repository.getPublishedRevisionForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(response.data?.id).toBe('revision-1');
    expect(Object.isFrozen(response.data)).toBe(true);
  });

  it('rejects publishing a revision from another page', async () => {
    const repository = makeRepository([
      makeRevision('other-page', { pageId: 'page-2' })
    ]);

    expectFailure(
      await repository.publishRevision(publishInput('other-page'), 'owner'),
      'INVALID_INPUT'
    );
  });

  it('rejects publishing a revision from another website', async () => {
    const repository = makeRepository([
      makeRevision('other-website', { websiteId: 'website-2' })
    ]);

    expectFailure(
      await repository.publishRevision(publishInput('other-website'), 'owner'),
      'INVALID_INPUT'
    );
  });

  it('allows expectedPublishedRevisionId null only when no target exists', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    const first = await repository.publishRevision(
      publishInput('revision-1', { expectedPublishedRevisionId: null }),
      'owner'
    );
    const second = await repository.publishRevision(
      publishInput('revision-2', { expectedPublishedRevisionId: null }),
      'owner'
    );

    expect(first.success).toBe(true);
    expectFailure(second, 'CONFLICT');
  });

  it('updates the pointer when the expected revision ID matches', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    const response = await repository.publishRevision(
      publishInput('revision-2', {
        expectedPublishedRevisionId: 'revision-1'
      }),
      'owner'
    );

    expect(response.data?.target.publishedRevisionId).toBe('revision-2');
  });

  it('leaves the target unchanged when an expected revision ID conflicts', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    const response = await repository.publishRevision(
      publishInput('revision-2', {
        expectedPublishedRevisionId: 'stale-revision'
      }),
      'owner'
    );
    const target = await repository.getPublicationTarget(
      'website-1', 'page-1', 'owner'
    );

    expectFailure(response, 'CONFLICT');
    expect(target.data?.publishedRevisionId).toBe('revision-1');
  });

  it('performs an unconditional pointer update when expectation is omitted', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    await repository.publishRevision(
      publishInput('revision-1', { expectedPublishedRevisionId: null }), 'owner'
    );

    const response = await repository.publishRevision(
      publishInput('revision-2'), 'owner'
    );

    expect(response.success).toBe(true);
    expect(response.data?.target.publishedRevisionId).toBe('revision-2');
  });

  it('republishes the live revision with a new timestamp without adding history', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    const response = await repository.publishRevision(
      publishInput('revision-1', {
        publishedAt: '2026-07-25T14:00:00.000Z',
        expectedPublishedRevisionId: 'revision-1'
      }),
      'owner'
    );
    const history = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(response.data?.previousRevisionId).toBe('revision-1');
    expect(response.data?.target.publishedAt).toBe('2026-07-25T14:00:00.000Z');
    expect(history.data?.items).toHaveLength(1);
  });
});

describe('Builder publication rollback and safe deletion', () => {
  it('rolls back by repointing to an existing earlier revision', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    await repository.publishRevision(publishInput('revision-2'), 'owner');

    const response = await repository.rollbackToRevision(
      publishInput('revision-1', {
        expectedPublishedRevisionId: 'revision-2'
      }),
      'owner'
    );

    expect(response.data?.previousRevisionId).toBe('revision-2');
    expect(response.data?.target.publishedRevisionId).toBe('revision-1');
  });

  it('does not mutate or recreate revisions during rollback', async () => {
    const first = makeRevision('revision-1');
    const second = makeRevision('revision-2');
    const repository = makeRepository([first, second]);
    await repository.publishRevision(publishInput('revision-2'), 'owner');
    await repository.rollbackToRevision(publishInput('revision-1'), 'owner');
    const history = await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(history.data?.items).toHaveLength(2);
    expect(history.data?.items).toEqual(expect.arrayContaining([first, second]));
  });

  it('leaves the target unchanged when rollback concurrency conflicts', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    await repository.publishRevision(publishInput('revision-2'), 'owner');

    const response = await repository.rollbackToRevision(
      publishInput('revision-1', {
        expectedPublishedRevisionId: 'revision-1'
      }),
      'owner'
    );
    const target = await repository.getPublicationTarget(
      'website-1', 'page-1', 'owner'
    );

    expectFailure(response, 'CONFLICT');
    expect(target.data?.publishedRevisionId).toBe('revision-2');
  });

  it('refuses deletion of a revision referenced by any target', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    const response = await repository.deleteRevisionIfUnpublished(
      'revision-1', 'owner'
    );

    expectFailure(response, 'CONFLICT');
    expect((await repository.getRevisionById('revision-1', 'owner')).success).toBe(true);
  });

  it('deletes an authorized unreferenced revision only', async () => {
    const repository = makeRepository([
      makeRevision('revision-1'), makeRevision('revision-2')
    ]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    const response = await repository.deleteRevisionIfUnpublished(
      'revision-2', 'owner'
    );

    expect(response).toEqual({ success: true, data: { id: 'revision-2' } });
    expect((await repository.getRevisionById('revision-2', 'owner')).error).toBe('NOT_FOUND');
    expect((await repository.getRevisionById('revision-1', 'owner')).success).toBe(true);
  });

  it('rejects unauthorized deletion without removing the revision', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);

    expectFailure(
      await repository.deleteRevisionIfUnpublished('revision-1', 'intruder'),
      'UNAUTHORIZED'
    );
    expect((await repository.getRevisionById('revision-1', 'owner')).success).toBe(true);
  });
});

describe('Builder publication repository defensive isolation', () => {
  it('validates and clones seeded revisions and targets', async () => {
    const seededRevision = structuredClone(makeRevision('revision-1'));
    const seededTarget: BuilderPublicationTarget = {
      websiteId: 'website-1',
      pageId: 'page-1',
      publishedRevisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00.000Z',
      publishedBy: 'owner'
    };
    const repository = makeRepository([seededRevision], [seededTarget]);
    seededRevision.document.sections[0].content.heading = 'Mutated seed';
    seededTarget.publishedAt = '2026-07-25T15:00:00.000Z';

    const revision = await repository.getRevisionById('revision-1', 'owner');
    const target = await repository.getPublicationTarget(
      'website-1', 'page-1', 'owner'
    );

    expect(revision.data?.document.sections[0].content.heading).toBe('revision-1');
    expect(target.data?.publishedAt).toBe('2026-07-25T13:00:00.000Z');
    expect(() => makeRepository([], [seededTarget])).toThrow(/invalid revision/i);
  });

  it('returns immutable independent target clones', async () => {
    const repository = makeRepository([makeRevision('revision-1')]);
    await repository.publishRevision(publishInput('revision-1'), 'owner');
    const first = (await repository.getPublicationTarget(
      'website-1', 'page-1', 'owner'
    )).data!;
    const second = (await repository.getPublicationTarget(
      'website-1', 'page-1', 'owner'
    )).data!;

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('does not mutate input revisions, constructor options, users, or publish inputs', async () => {
    const revision = makeRevision('revision-1', { createdBy: 'owner' });
    const user: User = {
      id: 'owner',
      email: 'owner@example.com',
      password_hash: 'hash',
      created_at: '2026-07-25T00:00:00.000Z'
    };
    const options = { canAccessPage, revisions: [revision] };
    const optionsSnapshot = structuredClone(options.revisions);
    const userSnapshot = structuredClone(user);
    const input = publishInput('revision-1');
    const inputSnapshot = structuredClone(input);
    const repository = new InMemoryBuilderPublicationRepository(options);

    await repository.createRevision(
      makeRevision('revision-2', { createdBy: 'owner' }), user
    );
    await repository.publishRevision(input, user);

    expect(options.revisions).toEqual(optionsSnapshot);
    expect(user).toEqual(userSnapshot);
    expect(input).toEqual(inputSnapshot);
    expect(revision.document.sections[0].content.heading).toBe('revision-1');
  });

  it('supports unknown custom section types throughout storage and publication', async () => {
    const revision = makeRevision('custom-1', {
      sectionType: 'custom-roof-treatment-calculator'
    });
    const repository = makeRepository();
    await repository.createRevision(revision, 'owner');
    await repository.publishRevision(publishInput('custom-1'), 'owner');

    const published = await repository.getPublishedRevisionForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(published.data?.document.sections[0].type)
      .toBe('custom-roof-treatment-calculator');
    expect(published.data?.document.sections[0].content.unknownNested.items)
      .toEqual([{ label: 'Preserved' }]);
  });
});
