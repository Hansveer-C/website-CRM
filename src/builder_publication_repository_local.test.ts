import { describe, expect, it } from 'vitest';
import type { BuilderDocument } from './builder_document';
import { createBuilderDocument } from './builder_document';
import { createBuilderPublishedRevision } from './builder_publication';
import type { BuilderPublishedRevision } from './builder_publication';
import {
  builderPublishedRevisionToRow,
  InMemoryBuilderPublicationRepository
} from './builder_publication_repository';
import type {
  BuilderPublicationAccessResolver,
  BuilderPublicationTarget,
  BuilderPublishRevisionInput
} from './builder_publication_repository';
import {
  LocalStorageBuilderPublicationRepository
} from './builder_publication_repository_local';
import type {
  BuilderPublicationStorage,
  LocalBuilderPublicationSnapshot,
  LocalStorageBuilderPublicationRepositoryOptions
} from './builder_publication_repository_local';
import type { Page, PageSection, RepoResponse, User } from './types';

const DEFAULT_KEY = 'crm_builder_publications_v1';

class TestPublicationStorage implements BuilderPublicationStorage {
  readonly values = new Map<string, string>();
  getItemCalls = 0;
  setItemCalls = 0;
  removeItemCalls = 0;
  throwOnGet = false;
  throwOnSet = false;

  getItem(key: string): string | null {
    this.getItemCalls += 1;
    if (this.throwOnGet) throw new Error('get failed');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.setItemCalls += 1;
    if (this.throwOnSet) throw new Error('set failed');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.removeItemCalls += 1;
    this.values.delete(key);
  }

  resetCounts(): void {
    this.getItemCalls = 0;
    this.setItemCalls = 0;
    this.removeItemCalls = 0;
  }

  snapshot(key = DEFAULT_KEY): LocalBuilderPublicationSnapshot | undefined {
    const raw = this.values.get(key);
    return raw === undefined
      ? undefined
      : JSON.parse(raw) as LocalBuilderPublicationSnapshot;
  }
}

function makeDocument(
  pageId = 'page-1',
  heading = 'Clean surfaces, clear results',
  sectionType = 'hero'
): BuilderDocument {
  const page: Page = {
    id: pageId,
    user_id: 'owner',
    name: 'Pressure Washing',
    slug: pageId,
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
      imageUrl: 'https://cdn.example.com/pressure-washing.jpg',
      unknownNested: { items: [{ label: 'Preserved', enabled: true }] }
    },
    styles: {
      visible: true,
      unknownStyle: { desktop: { gap: 24 } }
    }
  }];
  return createBuilderDocument(page, sections);
}

interface RevisionOptions {
  websiteId?: string;
  pageId?: string;
  createdAt?: string;
  createdBy?: string;
  heading?: string;
  sectionType?: string;
}

function makeRevision(
  id: string,
  options: RevisionOptions = {}
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
  storage: TestPublicationStorage,
  storageKey?: string,
  accessResolver = canAccessPage
): LocalStorageBuilderPublicationRepository {
  return new LocalStorageBuilderPublicationRepository({
    storage,
    canAccessPage: accessResolver,
    ...(storageKey === undefined ? {} : { storageKey })
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

function expectFailure(response: RepoResponse<unknown>, code?: string): void {
  expect(response.success).toBe(false);
  expect(response.data).toBeUndefined();
  if (code) expect(response.code).toBe(code);
}

function validSnapshot(
  revisions: BuilderPublishedRevision[] = [],
  targets: BuilderPublicationTarget[] = []
): LocalBuilderPublicationSnapshot {
  return {
    schemaVersion: 1,
    revisions: revisions.map(builderPublishedRevisionToRow),
    targets: structuredClone(targets)
  };
}

function storeSnapshot(
  storage: TestPublicationStorage,
  snapshot: unknown,
  key = DEFAULT_KEY
): void {
  storage.values.set(key, JSON.stringify(snapshot));
}

describe('Local builder publication construction and empty storage', () => {
  it('treats missing storage as an empty repository', async () => {
    const response = await makeRepository(new TestPublicationStorage())
      .listRevisionsForPage('website-1', 'page-1', 'owner');

    expect(response.data?.items).toEqual([]);
  });

  it('does not create the storage key for read-only empty operations', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);

    await repository.getPublicationTarget('website-1', 'page-1', 'owner');
    await repository.getRevisionById('missing', 'owner');

    expect(storage.values.has(DEFAULT_KEY)).toBe(false);
    expect(storage.setItemCalls).toBe(0);
  });

  it('writes a schema-version-1 snapshot on first successful creation', async () => {
    const storage = new TestPublicationStorage();

    await makeRepository(storage).createRevision(makeRevision('revision-1'), 'owner');

    expect(storage.snapshot()).toMatchObject({ schemaVersion: 1, targets: [] });
    expect(storage.snapshot()?.revisions).toHaveLength(1);
  });

  it('uses the default storage key when none is supplied', async () => {
    const storage = new TestPublicationStorage();

    await makeRepository(storage).createRevision(makeRevision('revision-1'), 'owner');

    expect(storage.values.has(DEFAULT_KEY)).toBe(true);
  });

  it('throws clearly for a blank storage key', () => {
    expect(() => makeRepository(new TestPublicationStorage(), '   '))
      .toThrow('storageKey must not be blank');
  });

  it('does not mutate constructor options', () => {
    const storage = new TestPublicationStorage();
    const options: LocalStorageBuilderPublicationRepositoryOptions = {
      storage,
      canAccessPage,
      storageKey: 'custom-key'
    };
    const originalKey = options.storageKey;
    const originalResolver = options.canAccessPage;

    new LocalStorageBuilderPublicationRepository(options);

    expect(options.storageKey).toBe(originalKey);
    expect(options.canAccessPage).toBe(originalResolver);
    expect(options.storage).toBe(storage);
  });

  it('keeps different storage keys isolated', async () => {
    const storage = new TestPublicationStorage();
    await makeRepository(storage, 'key-a').createRevision(makeRevision('a'), 'owner');
    await makeRepository(storage, 'key-b').createRevision(makeRevision('b'), 'owner');

    expect(storage.snapshot('key-a')?.revisions.map(row => row.id)).toEqual(['a']);
    expect(storage.snapshot('key-b')?.revisions.map(row => row.id)).toEqual(['b']);
  });
});

describe('Local builder publication cross-instance storage', () => {
  it('makes created revisions visible to a newly constructed adapter', async () => {
    const storage = new TestPublicationStorage();
    await makeRepository(storage).createRevision(makeRevision('revision-1'), 'owner');

    const response = await makeRepository(storage).getRevisionById('revision-1', 'owner');

    expect(response.data?.id).toBe('revision-1');
  });

  it('makes published targets visible to a newly constructed adapter', async () => {
    const storage = new TestPublicationStorage();
    const first = makeRepository(storage);
    await first.createRevision(makeRevision('revision-1'), 'owner');
    await first.publishRevision(publishInput('revision-1'), 'owner');

    const target = await makeRepository(storage).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    );

    expect(target.data?.publishedRevisionId).toBe('revision-1');
  });

  it('reloads before every operation so two live instances observe changes', async () => {
    const storage = new TestPublicationStorage();
    const first = makeRepository(storage);
    const second = makeRepository(storage);
    await first.createRevision(makeRevision('revision-1'), 'owner');
    await second.createRevision(makeRevision('revision-2'), 'owner');

    const history = await first.listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(history.data?.items.map(item => item.id)).toEqual([
      'revision-2', 'revision-1'
    ]);
    expect(storage.getItemCalls).toBeGreaterThanOrEqual(3);
  });
});

describe('Local builder publication storage format and isolation', () => {
  it('stores revisions with the required snake_case row fields', async () => {
    const storage = new TestPublicationStorage();
    await makeRepository(storage).createRevision(
      makeRevision('revision-1', { createdBy: 'owner' }), 'owner'
    );

    expect(storage.snapshot()?.revisions[0]).toEqual(expect.objectContaining({
      schema_version: 1,
      website_id: 'website-1',
      page_id: 'page-1',
      created_at: '2026-07-25T12:00:00.000Z',
      created_by: 'owner',
      document_fingerprint: expect.any(String)
    }));
    expect(storage.snapshot()?.revisions[0]).not.toHaveProperty('websiteId');
  });

  it('preserves unknown custom section data and image URLs through storage', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('custom', {
      sectionType: 'custom-pressure-washing-calculator'
    }), 'owner');

    const read = await repository.getRevisionById('custom', 'owner');
    const section = read.data?.document.sections[0];

    expect(section?.type).toBe('custom-pressure-washing-calculator');
    expect(section?.content.imageUrl).toBe('https://cdn.example.com/pressure-washing.jpg');
    expect(section?.content.unknownNested.items).toEqual([
      { label: 'Preserved', enabled: true }
    ]);
  });

  it('does not share nested references between callers, parsed storage, or reads', async () => {
    const storage = new TestPublicationStorage();
    const mutable = structuredClone(makeRevision('revision-1'));
    const repository = makeRepository(storage);
    await repository.createRevision(mutable, 'owner');
    mutable.document.sections[0].content.heading = 'Caller mutation';

    const first = (await repository.getRevisionById('revision-1', 'owner')).data!;
    const second = (await repository.getRevisionById('revision-1', 'owner')).data!;

    expect(first.document.sections[0].content.heading).toBe('revision-1');
    expect(first).not.toBe(second);
    expect(first.document.sections[0].content).not.toBe(second.document.sections[0].content);
  });

  it('does not create a target when only a revision is created', async () => {
    const storage = new TestPublicationStorage();
    await makeRepository(storage).createRevision(makeRevision('revision-1'), 'owner');

    expect(storage.snapshot()?.targets).toEqual([]);
  });

  it('persists the live target after publication', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.publishRevision(publishInput('revision-1'), 'owner');

    expect(storage.snapshot()?.targets[0]).toMatchObject({
      websiteId: 'website-1',
      pageId: 'page-1',
      publishedRevisionId: 'revision-1',
      publishedBy: 'owner'
    });
  });

  it('replaces the stored target when the live revision is republished', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.publishRevision(publishInput('revision-1'), 'owner');
    await repository.publishRevision(publishInput('revision-1', {
      publishedAt: '2026-07-25T14:00:00.000Z'
    }), 'owner');

    expect(storage.snapshot()?.targets).toHaveLength(1);
    expect(storage.snapshot()?.targets[0].publishedAt)
      .toBe('2026-07-25T14:00:00.000Z');
  });

  it('persists rollback to an older revision', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.createRevision(makeRevision('revision-2'), 'owner');
    await repository.publishRevision(publishInput('revision-2'), 'owner');
    await repository.rollbackToRevision(publishInput('revision-1'), 'owner');

    expect(storage.snapshot()?.targets[0].publishedRevisionId).toBe('revision-1');
  });

  it('persists deletion of an unpublished revision only', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.createRevision(makeRevision('revision-2'), 'owner');

    await repository.deleteRevisionIfUnpublished('revision-1', 'owner');

    expect(storage.snapshot()?.revisions.map(row => row.id)).toEqual(['revision-2']);
  });

  it('stores an explicit empty snapshot after deleting the last revision', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.deleteRevisionIfUnpublished('revision-1', 'owner');

    expect(storage.snapshot()).toEqual({ schemaVersion: 1, revisions: [], targets: [] });
    expect(storage.values.has(DEFAULT_KEY)).toBe(true);
  });

  it('retains protection against deleting a published revision', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.publishRevision(publishInput('revision-1'), 'owner');
    storage.resetCounts();

    const response = await repository.deleteRevisionIfUnpublished('revision-1', 'owner');

    expectFailure(response, 'CONFLICT');
    expect(storage.setItemCalls).toBe(0);
    expect(storage.snapshot()?.revisions).toHaveLength(1);
  });
});

describe('Local builder publication write discipline', () => {
  it('does not write after an unauthorized mutation', async () => {
    const storage = new TestPublicationStorage();

    const response = await makeRepository(storage).createRevision(
      makeRevision('revision-1'), 'intruder'
    );

    expectFailure(response, 'UNAUTHORIZED');
    expect(storage.setItemCalls).toBe(0);
  });

  it('does not write after an optimistic publication conflict', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.createRevision(makeRevision('revision-2'), 'owner');
    await repository.publishRevision(publishInput('revision-1'), 'owner');
    storage.resetCounts();

    const response = await repository.publishRevision(publishInput('revision-2', {
      expectedPublishedRevisionId: null
    }), 'owner');

    expectFailure(response, 'CONFLICT');
    expect(storage.setItemCalls).toBe(0);
  });

  it('does not write after invalid revision creation', async () => {
    const storage = new TestPublicationStorage();
    const invalid = structuredClone(makeRevision('revision-1'));
    invalid.document.sections[0].id = '';

    const response = await makeRepository(storage).createRevision(invalid, 'owner');

    expectFailure(response, 'INVALID_INPUT');
    expect(storage.setItemCalls).toBe(0);
  });

  it('does not write after duplicate revision creation', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    storage.resetCounts();

    const response = await repository.createRevision(makeRevision('revision-1'), 'owner');

    expectFailure(response, 'CONFLICT');
    expect(storage.setItemCalls).toBe(0);
  });

  it('never writes during any read-only repository operation', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    storage.resetCounts();

    await repository.getRevisionById('revision-1', 'owner');
    await repository.listRevisionsForPage('website-1', 'page-1', 'owner');
    await repository.getPublicationTarget('website-1', 'page-1', 'owner');
    await repository.getPublishedRevisionForPage('website-1', 'page-1', 'owner');

    expect(storage.setItemCalls).toBe(0);
    expect(storage.getItemCalls).toBe(4);
  });

  it('never calls removeItem during normal repository operations', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.getRevisionById('revision-1', 'owner');
    await repository.deleteRevisionIfUnpublished('revision-1', 'owner');

    expect(storage.removeItemCalls).toBe(0);
  });

  it('persists revisions in deterministic date and ID order', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-a', {
      createdAt: '2026-07-25T12:00:00.000Z'
    }), 'owner');
    await repository.createRevision(makeRevision('revision-c', {
      createdAt: '2026-07-25T12:00:00.000Z'
    }), 'owner');
    await repository.createRevision(makeRevision('revision-b', {
      createdAt: '2026-07-25T13:00:00.000Z'
    }), 'owner');

    expect(storage.snapshot()?.revisions.map(row => row.id)).toEqual([
      'revision-b', 'revision-c', 'revision-a'
    ]);
  });

  it('persists targets ordered by website ID and page ID', async () => {
    const storage = new TestPublicationStorage();
    const revisions = [
      makeRevision('b', { pageId: 'page-b' }),
      makeRevision('a', { pageId: 'page-a' }),
      makeRevision('z', { websiteId: 'website-2', pageId: 'page-z' })
    ];
    storeSnapshot(storage, validSnapshot(revisions));
    const ownerOne = makeRepository(storage);
    await ownerOne.publishRevision(publishInput('b', { pageId: 'page-b' }), 'owner');
    await ownerOne.publishRevision(publishInput('a', { pageId: 'page-a' }), 'owner');
    await makeRepository(storage).publishRevision(publishInput('z', {
      websiteId: 'website-2', pageId: 'page-z'
    }), 'owner-2');

    expect(storage.snapshot()?.targets.map(target => (
      `${target.websiteId}/${target.pageId}`
    ))).toEqual([
      'website-1/page-a',
      'website-1/page-b',
      'website-2/page-z'
    ]);
  });
});

describe('Local builder publication corrupted snapshot handling', () => {
  it('returns a safe failure for invalid JSON', async () => {
    const storage = new TestPublicationStorage();
    storage.values.set(DEFAULT_KEY, '{ invalid');

    expectFailure(await makeRepository(storage).getRevisionById('x', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for a non-object root', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, []);

    expectFailure(await makeRepository(storage).getRevisionById('x', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for an unsupported schema version', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, { schemaVersion: 2, revisions: [], targets: [] });

    expectFailure(await makeRepository(storage).getRevisionById('x', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure when the revisions array is missing', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, { schemaVersion: 1, targets: [] });

    expectFailure(await makeRepository(storage).getRevisionById('x', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure when the targets array is missing', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, { schemaVersion: 1, revisions: [] });

    expectFailure(await makeRepository(storage).getRevisionById('x', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for malformed revision rows', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, { schemaVersion: 1, revisions: [{}], targets: [] });

    expectFailure(await makeRepository(storage).getRevisionById('x', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for invalid stored fingerprints', async () => {
    const storage = new TestPublicationStorage();
    const snapshot = validSnapshot([makeRevision('revision-1')]);
    snapshot.revisions[0].document_fingerprint = 'stale';
    storeSnapshot(storage, snapshot);

    expectFailure(await makeRepository(storage).getRevisionById('revision-1', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for duplicate revision IDs', async () => {
    const storage = new TestPublicationStorage();
    const row = builderPublishedRevisionToRow(makeRevision('revision-1'));
    storeSnapshot(storage, { schemaVersion: 1, revisions: [row, row], targets: [] });

    expectFailure(await makeRepository(storage).getRevisionById('revision-1', 'owner'), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for malformed targets and blank IDs', async () => {
    const storage = new TestPublicationStorage();
    const revision = makeRevision('revision-1');
    const malformedTargets = [null, {}, {
      websiteId: '', pageId: 'page-1', publishedRevisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00.000Z'
    }];

    for (const target of malformedTargets) {
      storeSnapshot(storage, {
        schemaVersion: 1,
        revisions: [builderPublishedRevisionToRow(revision)],
        targets: [target]
      });
      expectFailure(await makeRepository(storage).getPublicationTarget(
        'website-1', 'page-1', 'owner'
      ), 'PERSISTENCE_ERROR');
    }
  });

  it('returns a safe failure for duplicate website/page targets', async () => {
    const storage = new TestPublicationStorage();
    const revision = makeRevision('revision-1');
    const target: BuilderPublicationTarget = {
      websiteId: 'website-1', pageId: 'page-1', publishedRevisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00.000Z'
    };
    storeSnapshot(storage, validSnapshot([revision], [target, target]));

    expectFailure(await makeRepository(storage).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    ), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure when a target revision is missing', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, validSnapshot([], [{
      websiteId: 'website-1', pageId: 'page-1', publishedRevisionId: 'missing',
      publishedAt: '2026-07-25T13:00:00.000Z'
    }]));

    expectFailure(await makeRepository(storage).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    ), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for a cross-page target', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, validSnapshot([makeRevision('revision-1')], [{
      websiteId: 'website-1', pageId: 'page-2', publishedRevisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00.000Z'
    }]));

    expectFailure(await makeRepository(storage).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    ), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for a cross-website target', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, validSnapshot([makeRevision('revision-1')], [{
      websiteId: 'website-2', pageId: 'page-1', publishedRevisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00.000Z'
    }]));

    expectFailure(await makeRepository(storage).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    ), 'PERSISTENCE_ERROR');
  });

  it('returns a safe failure for invalid target timestamps', async () => {
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, validSnapshot([makeRevision('revision-1')], [{
      websiteId: 'website-1', pageId: 'page-1', publishedRevisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00'
    }]));

    expectFailure(await makeRepository(storage).getPublicationTarget(
      'website-1', 'page-1', 'owner'
    ), 'PERSISTENCE_ERROR');
  });

  it('does not erase or rewrite corrupted storage', async () => {
    const storage = new TestPublicationStorage();
    const corrupted = '{ corrupted snapshot';
    storage.values.set(DEFAULT_KEY, corrupted);

    await makeRepository(storage).listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    );

    expect(storage.values.get(DEFAULT_KEY)).toBe(corrupted);
    expect(storage.setItemCalls).toBe(0);
    expect(storage.removeItemCalls).toBe(0);
  });
});

describe('Local builder publication storage failures', () => {
  it('returns a safe persistence failure when getItem throws', async () => {
    const storage = new TestPublicationStorage();
    storage.throwOnGet = true;

    const response = await makeRepository(storage).getRevisionById('revision-1', 'owner');

    expectFailure(response, 'PERSISTENCE_ERROR');
    expect(response.error).toBe('LOCAL_PUBLICATION_STORAGE_READ_FAILED');
  });

  it('returns a safe persistence failure when setItem throws', async () => {
    const storage = new TestPublicationStorage();
    storage.throwOnSet = true;

    const response = await makeRepository(storage).createRevision(
      makeRevision('revision-1'), 'owner'
    );

    expectFailure(response, 'PERSISTENCE_ERROR');
    expect(response.error).toBe('LOCAL_PUBLICATION_STORAGE_WRITE_FAILED');
  });

  it('does not expose a failed write to a later fresh read', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    storage.throwOnSet = true;
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    storage.throwOnSet = false;

    const response = await repository.getRevisionById('revision-1', 'owner');

    expect(response.error).toBe('NOT_FOUND');
    expect(storage.values.has(DEFAULT_KEY)).toBe(false);
  });

  it('does not call removeItem after failed writes', async () => {
    const storage = new TestPublicationStorage();
    storage.throwOnSet = true;

    await makeRepository(storage).createRevision(makeRevision('revision-1'), 'owner');

    expect(storage.removeItemCalls).toBe(0);
  });

  it('does not overwrite unrelated storage keys', async () => {
    const storage = new TestPublicationStorage();
    storage.values.set('unrelated-key', 'preserve-me');

    await makeRepository(storage).createRevision(makeRevision('revision-1'), 'owner');

    expect(storage.values.get('unrelated-key')).toBe('preserve-me');
    expect(Array.from(storage.values.keys()).sort()).toEqual([
      DEFAULT_KEY, 'unrelated-key'
    ]);
  });
});

describe('Local adapter delegation parity', () => {
  it('matches in-memory acting-user and page-access outcomes', async () => {
    const revision = makeRevision('revision-1');
    const storage = new TestPublicationStorage();
    const local = makeRepository(storage);
    const memory = new InMemoryBuilderPublicationRepository({ canAccessPage });
    await local.createRevision(revision, 'owner');
    await memory.createRevision(revision, 'owner');

    const localResponse = await local.getRevisionById('revision-1', 'intruder');
    const memoryResponse = await memory.getRevisionById('revision-1', 'intruder');

    expect(localResponse).toEqual(memoryResponse);
  });

  it('matches in-memory cursor pagination behavior', async () => {
    const revisions = [
      makeRevision('revision-c'), makeRevision('revision-b'), makeRevision('revision-a')
    ];
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, validSnapshot(revisions));
    const local = makeRepository(storage);
    const memory = new InMemoryBuilderPublicationRepository({
      canAccessPage,
      revisions
    });
    const localFirst = await local.listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 1 }
    );
    const memoryFirst = await memory.listRevisionsForPage(
      'website-1', 'page-1', 'owner', { limit: 1 }
    );

    expect(localFirst).toEqual(memoryFirst);
    expect(await local.listRevisionsForPage('website-1', 'page-1', 'owner', {
      limit: 1,
      cursor: localFirst.data?.nextCursor
    })).toEqual(await memory.listRevisionsForPage('website-1', 'page-1', 'owner', {
      limit: 1,
      cursor: memoryFirst.data?.nextCursor
    }));
  });

  it('matches in-memory optimistic publication behavior', async () => {
    const revisions = [makeRevision('revision-1'), makeRevision('revision-2')];
    const storage = new TestPublicationStorage();
    storeSnapshot(storage, validSnapshot(revisions));
    const local = makeRepository(storage);
    const memory = new InMemoryBuilderPublicationRepository({ canAccessPage, revisions });
    const firstInput = publishInput('revision-1', { expectedPublishedRevisionId: null });
    expect(await local.publishRevision(firstInput, 'owner'))
      .toEqual(await memory.publishRevision(firstInput, 'owner'));

    const conflictInput = publishInput('revision-2', {
      expectedPublishedRevisionId: null
    });
    expect(await local.publishRevision(conflictInput, 'owner'))
      .toEqual(await memory.publishRevision(conflictInput, 'owner'));
  });

  it('does not mutate caller revisions, inputs, options, or users', async () => {
    const storage = new TestPublicationStorage();
    const revision = structuredClone(makeRevision('revision-1', { createdBy: 'owner' }));
    const input = publishInput('revision-1');
    const user: User = {
      id: 'owner',
      email: 'owner@example.com',
      password_hash: 'hash',
      created_at: '2026-07-25T00:00:00.000Z'
    };
    const options: LocalStorageBuilderPublicationRepositoryOptions = {
      storage,
      canAccessPage
    };
    const revisionSnapshot = structuredClone(revision);
    const inputSnapshot = structuredClone(input);
    const userSnapshot = structuredClone(user);
    const repository = new LocalStorageBuilderPublicationRepository(options);

    await repository.createRevision(revision, user);
    await repository.publishRevision(input, user);

    expect(revision).toEqual(revisionSnapshot);
    expect(input).toEqual(inputSnapshot);
    expect(user).toEqual(userSnapshot);
    expect(options.storage).toBe(storage);
    expect(options.canAccessPage).toBe(canAccessPage);
  });

  it('returns deeply frozen independent revisions, targets, and history collections', async () => {
    const storage = new TestPublicationStorage();
    const repository = makeRepository(storage);
    await repository.createRevision(makeRevision('revision-1'), 'owner');
    await repository.publishRevision(publishInput('revision-1'), 'owner');
    const first = (await repository.getRevisionById('revision-1', 'owner')).data!;
    const second = (await repository.getRevisionById('revision-1', 'owner')).data!;
    const target = (await repository.getPublicationTarget(
      'website-1', 'page-1', 'owner'
    )).data!;
    const history = (await repository.listRevisionsForPage(
      'website-1', 'page-1', 'owner'
    )).data!;

    expect(first).not.toBe(second);
    expect(Object.isFrozen(first.document.sections[0].content)).toBe(true);
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.items)).toBe(true);
  });
});
