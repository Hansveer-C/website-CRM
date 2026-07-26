import { describe, expect, it, vi } from 'vitest';
import { createBuilderDocument } from './builder_document';
import {
  createBuilderPublishedRevision,
  type BuilderPublishedRevision
} from './builder_publication';
import type {
  BuilderPublicationHistoryPage,
  BuilderPublicationRepository,
  BuilderPublicationTarget,
  BuilderPublishRevisionInput,
  BuilderPublishRevisionResult
} from './builder_publication_repository';
import {
  BUILDER_PUBLICATION_API_ROUTES,
  createBuilderRevisionController,
  deleteBuilderRevisionController,
  getBuilderPublicationController,
  listBuilderRevisionsController,
  publishBuilderRevisionController,
  rollbackBuilderRevisionController,
  type BuilderPublicationApiResponse,
  type BuilderPublicationApiRoute,
  type CreateBuilderRevisionRequest,
  type DeleteBuilderRevisionRequest,
  type GetBuilderPublicationRequest,
  type ListBuilderRevisionsRequest,
  type PublishBuilderRevisionRequest,
  type RollbackBuilderRevisionRequest
} from './builder_publication_api';
import type { Page, PageSection, RepoResponse, User } from './types';

function makeRevision(): BuilderPublishedRevision {
  const page: Page = {
    id: 'page-1',
    user_id: 'user-1',
    name: 'Pressure Washing',
    slug: 'pressure-washing',
    status: 'draft',
    seo_title: 'Pressure Washing',
    seo_description: 'Professional exterior cleaning.',
    seo_keywords: ['pressure washing'],
    schema_markup: '{}',
    created_at: '2026-07-25T12:00:00.000Z',
    funnel_id: 'funnel-1',
    step_type: 'landing',
    step_order: 1
  };
  const sections: PageSection[] = [{
    id: 'hero-1',
    page_id: page.id,
    funnel_id: page.funnel_id,
    type: 'hero',
    variant: 'standard',
    order: 1,
    content: { heading: 'Restore your curb appeal' },
    styles: { background: '#0f172a' }
  }];

  return createBuilderPublishedRevision(createBuilderDocument(page, sections), {
    id: 'revision-1',
    websiteId: 'website-1',
    createdAt: '2026-07-25T12:34:56.000Z',
    createdBy: 'user-1'
  });
}

function makeTarget(): BuilderPublicationTarget {
  return {
    websiteId: 'website-1',
    pageId: 'page-1',
    publishedRevisionId: 'revision-1',
    publishedAt: '2026-07-25T13:00:00.000Z',
    publishedBy: 'user-1'
  };
}

function makePublishResult(): BuilderPublishRevisionResult {
  return { revision: makeRevision(), target: makeTarget(), previousRevisionId: null };
}

function makeRepository(): BuilderPublicationRepository {
  return {
    createRevision: vi.fn(async revision => ({ success: true, data: revision })),
    getRevisionById: vi.fn(async () => ({ success: true, data: makeRevision() })),
    listRevisionsForPage: vi.fn(async () => ({
      success: true,
      data: { items: [makeRevision()] }
    })),
    getPublishedRevisionForPage: vi.fn(async () => ({ success: true, data: null })),
    getPublicationTarget: vi.fn(async () => ({ success: true, data: null })),
    publishRevision: vi.fn(async () => ({ success: true, data: makePublishResult() })),
    rollbackToRevision: vi.fn(async () => ({ success: true, data: makePublishResult() })),
    deleteRevisionIfUnpublished: vi.fn(async revisionId => ({
      success: true,
      data: { id: revisionId }
    }))
  };
}

const user: User = {
  id: 'user-1',
  email: 'owner@example.com',
  password_hash: 'hash',
  created_at: '2026-07-25T00:00:00.000Z'
};

function createRequest(revision = makeRevision()): CreateBuilderRevisionRequest {
  return { websiteId: 'website-1', pageId: 'page-1', revision };
}

function publishRequest(): PublishBuilderRevisionRequest {
  return {
    websiteId: 'website-1',
    pageId: 'page-1',
    revisionId: 'revision-1',
    publishedAt: '2026-07-25T13:00:00.000Z'
  };
}

function failure<T>(code?: string, error = code): RepoResponse<T> {
  return { success: false, code, error };
}

describe('Builder publication API public contract and routes', () => {
  it('exports all request, response, route, and controller contracts', async () => {
    const response: BuilderPublicationApiResponse<{ id: string }> = {
      status: 200,
      body: { success: true, data: { id: 'revision-1' } }
    };
    const route: BuilderPublicationApiRoute = BUILDER_PUBLICATION_API_ROUTES[0];
    const create: CreateBuilderRevisionRequest = createRequest();
    const list: ListBuilderRevisionsRequest = { websiteId: 'website-1', pageId: 'page-1' };
    const get: GetBuilderPublicationRequest = list;
    const publish: PublishBuilderRevisionRequest = publishRequest();
    const rollback: RollbackBuilderRevisionRequest = publish;
    const remove: DeleteBuilderRevisionRequest = { revisionId: 'revision-1' };

    expect(response.status).toBe(200);
    expect(route.operation).toBe('create-revision');
    expect([create, list, get, publish, rollback, remove]).toHaveLength(6);
    expect(typeof createBuilderRevisionController).toBe('function');
    expect(typeof listBuilderRevisionsController).toBe('function');
    expect(typeof getBuilderPublicationController).toBe('function');
    expect(typeof publishBuilderRevisionController).toBe('function');
    expect(typeof rollbackBuilderRevisionController).toBe('function');
    expect(typeof deleteBuilderRevisionController).toBe('function');
  });

  it('contains all six routes in deterministic order', () => {
    expect(BUILDER_PUBLICATION_API_ROUTES).toEqual([
      { method: 'POST', path: '/api/websites/:websiteId/pages/:pageId/revisions', operation: 'create-revision' },
      { method: 'GET', path: '/api/websites/:websiteId/pages/:pageId/revisions', operation: 'list-revisions' },
      { method: 'GET', path: '/api/websites/:websiteId/pages/:pageId/publication', operation: 'get-publication' },
      { method: 'PUT', path: '/api/websites/:websiteId/pages/:pageId/publication', operation: 'publish-revision' },
      { method: 'POST', path: '/api/websites/:websiteId/pages/:pageId/publication/rollback', operation: 'rollback-revision' },
      { method: 'DELETE', path: '/api/builder-revisions/:revisionId', operation: 'delete-revision' }
    ]);
  });

  it('deep-freezes the route array and route objects', () => {
    const before = BUILDER_PUBLICATION_API_ROUTES.map(route => ({ ...route }));
    expect(Object.isFrozen(BUILDER_PUBLICATION_API_ROUTES)).toBe(true);
    expect(BUILDER_PUBLICATION_API_ROUTES.every(Object.isFrozen)).toBe(true);
    Reflect.set(BUILDER_PUBLICATION_API_ROUTES[0], 'path', '/changed');
    Reflect.set(BUILDER_PUBLICATION_API_ROUTES, '0', undefined);
    expect(BUILDER_PUBLICATION_API_ROUTES).toEqual(before);
  });
});

describe('create revision controller', () => {
  it('returns 201 and preserves the repository revision', async () => {
    const repository = makeRepository();
    const returned = makeRevision();
    vi.mocked(repository.createRevision).mockResolvedValue({ success: true, data: returned });
    const response = await createBuilderRevisionController(repository, user, createRequest());
    expect(response).toEqual({ status: 201, body: { success: true, data: returned } });
    expect(response.body.data).toBe(returned);
  });

  it('calls createRevision exactly once', async () => {
    const repository = makeRepository();
    const request = createRequest();
    await createBuilderRevisionController(repository, user, request);
    expect(repository.createRevision).toHaveBeenCalledTimes(1);
    expect(repository.createRevision).toHaveBeenCalledWith(request.revision, user);
  });

  it('does not publish automatically', async () => {
    const repository = makeRepository();
    await createBuilderRevisionController(repository, user, createRequest());
    expect(repository.publishRevision).not.toHaveBeenCalled();
  });

  it.each([
    ['websiteId', '  '],
    ['pageId', '']
  ])('rejects blank %s without calling the repository', async (field, value) => {
    const repository = makeRepository();
    const request = { ...createRequest(), [field]: value };
    const response = await createBuilderRevisionController(repository, user, request);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_INPUT');
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it('rejects a missing revision', async () => {
    const repository = makeRepository();
    const response = await createBuilderRevisionController(
      repository,
      user,
      { websiteId: 'website-1', pageId: 'page-1' } as CreateBuilderRevisionRequest
    );
    expect(response.status).toBe(400);
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it('rejects a revision website mismatch', async () => {
    const revision = structuredClone(makeRevision());
    revision.websiteId = 'website-2';
    const response = await createBuilderRevisionController(makeRepository(), user, createRequest(revision));
    expect(response.status).toBe(400);
  });

  it('rejects a revision page mismatch', async () => {
    const revision = structuredClone(makeRevision());
    revision.pageId = 'page-2';
    const response = await createBuilderRevisionController(makeRepository(), user, createRequest(revision));
    expect(response.status).toBe(400);
  });

  it('rejects an invalid revision', async () => {
    const revision = structuredClone(makeRevision());
    revision.id = '';
    const response = await createBuilderRevisionController(makeRepository(), user, createRequest(revision));
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('revision is invalid');
  });

  it('rejects a stale fingerprint', async () => {
    const revision = structuredClone(makeRevision());
    revision.document.sections[0].content.heading = 'Changed after fingerprinting';
    const response = await createBuilderRevisionController(makeRepository(), user, createRequest(revision));
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_INPUT');
  });

  it.each([undefined, null, '', '   ', {}, { id: '' }])('returns 401 for invalid runtime user %#', async invalidUser => {
    const repository = makeRepository();
    const response = await createBuilderRevisionController(
      repository,
      invalidUser as unknown as User,
      createRequest()
    );
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it.each([
    ['UNAUTHORIZED', 403],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['INVALID_INPUT', 400],
    ['VALIDATION_ERROR', 400],
    ['PERSISTENCE_ERROR', 500],
    ['SOMETHING_NEW', 500]
  ])('maps repository code %s to %i', async (code, status) => {
    const repository = makeRepository();
    vi.mocked(repository.createRevision).mockResolvedValue(failure(code, `failure-${code}`));
    const response = await createBuilderRevisionController(repository, user, createRequest());
    expect(response).toEqual({
      status,
      body: { success: false, error: `failure-${code}`, code }
    });
  });

  it('maps semantic error text when a repository code is absent', async () => {
    const repository = makeRepository();
    vi.mocked(repository.createRevision).mockResolvedValue(failure(undefined, 'NOT_FOUND'));
    expect((await createBuilderRevisionController(repository, user, createRequest())).status).toBe(404);
  });

  it('maps unexpected repository throws to a safe 500', async () => {
    const repository = makeRepository();
    vi.mocked(repository.createRevision).mockRejectedValue(new Error('secret database detail'));
    const response = await createBuilderRevisionController(repository, user, createRequest());
    expect(response).toEqual({
      status: 500,
      body: {
        success: false,
        code: 'INTERNAL_ERROR',
        error: 'Builder publication request failed'
      }
    });
    expect(JSON.stringify(response)).not.toContain('secret database detail');
  });
});

describe('list revisions controller', () => {
  it('returns an unchanged history page with status 200', async () => {
    const repository = makeRepository();
    const history: BuilderPublicationHistoryPage = { items: [makeRevision()], nextCursor: 'next' };
    vi.mocked(repository.listRevisionsForPage).mockResolvedValue({ success: true, data: history });
    const response = await listBuilderRevisionsController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1'
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toBe(history);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '10'])('rejects invalid limit %#', async limit => {
    const repository = makeRepository();
    const response = await listBuilderRevisionsController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1', limit: limit as number
    });
    expect(response.status).toBe(400);
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });

  it('passes a fractional limit through unchanged', async () => {
    const repository = makeRepository();
    await listBuilderRevisionsController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1', limit: 2.75
    });
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website-1', 'page-1', user, { limit: 2.75 }
    );
  });

  it('passes omitted list options through as omitted', async () => {
    const repository = makeRepository();
    await listBuilderRevisionsController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1'
    });
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website-1', 'page-1', user, undefined
    );
  });

  it('rejects a blank cursor', async () => {
    const repository = makeRepository();
    const response = await listBuilderRevisionsController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1', cursor: '  '
    });
    expect(response.status).toBe(400);
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });

  it('passes a valid cursor through unchanged', async () => {
    const repository = makeRepository();
    await listBuilderRevisionsController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1', cursor: 'opaque cursor'
    });
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website-1', 'page-1', user, { cursor: 'opaque cursor' }
    );
  });
});

describe('get publication controller', () => {
  it('returns both values as null for a missing publication', async () => {
    const response = await getBuilderPublicationController(makeRepository(), user, {
      websiteId: 'website-1', pageId: 'page-1'
    });
    expect(response).toEqual({
      status: 200,
      body: { success: true, data: { publishedRevision: null, target: null } }
    });
  });

  it('returns the target and revision without cloning them', async () => {
    const repository = makeRepository();
    const target = makeTarget();
    const revision = makeRevision();
    vi.mocked(repository.getPublicationTarget).mockResolvedValue({ success: true, data: target });
    vi.mocked(repository.getPublishedRevisionForPage).mockResolvedValue({ success: true, data: revision });
    const response = await getBuilderPublicationController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1'
    });
    expect(response.body.data?.target).toBe(target);
    expect(response.body.data?.publishedRevision).toBe(revision);
  });

  it('returns a target lookup failure without querying a revision', async () => {
    const repository = makeRepository();
    vi.mocked(repository.getPublicationTarget).mockResolvedValue(failure('NOT_FOUND'));
    const response = await getBuilderPublicationController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1'
    });
    expect(response.status).toBe(404);
    expect(repository.getPublishedRevisionForPage).not.toHaveBeenCalled();
  });

  it('returns a revision lookup failure rather than partial target state', async () => {
    const repository = makeRepository();
    vi.mocked(repository.getPublicationTarget).mockResolvedValue({ success: true, data: makeTarget() });
    vi.mocked(repository.getPublishedRevisionForPage).mockResolvedValue(failure('PERSISTENCE_ERROR'));
    const response = await getBuilderPublicationController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1'
    });
    expect(response.status).toBe(500);
    expect(response.body.data).toBeUndefined();
  });
});

describe('publish revision controller', () => {
  it('returns status 200 and preserves successful result data', async () => {
    const repository = makeRepository();
    const result = makePublishResult();
    vi.mocked(repository.publishRevision).mockResolvedValue({ success: true, data: result });
    const response = await publishBuilderRevisionController(repository, user, publishRequest());
    expect(response.status).toBe(200);
    expect(response.body.data).toBe(result);
  });

  it('keeps an omitted expectation omitted', async () => {
    const repository = makeRepository();
    await publishBuilderRevisionController(repository, user, publishRequest());
    const input = vi.mocked(repository.publishRevision).mock.calls[0][0];
    expect(Object.hasOwn(input, 'expectedPublishedRevisionId')).toBe(false);
  });

  it.each([null, 'revision-previous'])('preserves expectation value %#', async expectation => {
    const repository = makeRepository();
    await publishBuilderRevisionController(repository, user, {
      ...publishRequest(), expectedPublishedRevisionId: expectation
    });
    expect(vi.mocked(repository.publishRevision).mock.calls[0][0].expectedPublishedRevisionId)
      .toBe(expectation);
  });

  it('rejects a blank expectation without a repository call', async () => {
    const repository = makeRepository();
    const response = await publishBuilderRevisionController(repository, user, {
      ...publishRequest(), expectedPublishedRevisionId: ' '
    });
    expect(response.status).toBe(400);
    expect(repository.publishRevision).not.toHaveBeenCalled();
  });

  it.each([
    '2026-07-25',
    '2026-07-25T13:00:00',
    '2026-02-30T13:00:00Z',
    'not-a-date'
  ])('rejects invalid publishedAt %s', async publishedAt => {
    const repository = makeRepository();
    const response = await publishBuilderRevisionController(repository, user, {
      ...publishRequest(), publishedAt
    });
    expect(response.status).toBe(400);
    expect(repository.publishRevision).not.toHaveBeenCalled();
  });

  it('maps publish conflicts to 409', async () => {
    const repository = makeRepository();
    vi.mocked(repository.publishRevision).mockResolvedValue(failure('CONFLICT'));
    expect((await publishBuilderRevisionController(repository, user, publishRequest())).status).toBe(409);
  });

  it('never creates a revision implicitly', async () => {
    const repository = makeRepository();
    await publishBuilderRevisionController(repository, user, publishRequest());
    expect(repository.createRevision).not.toHaveBeenCalled();
  });
});

describe('rollback revision controller', () => {
  it('returns status 200 for a valid rollback', async () => {
    const response = await rollbackBuilderRevisionController(makeRepository(), user, publishRequest());
    expect(response.status).toBe(200);
  });

  it('uses rollbackToRevision instead of publishRevision', async () => {
    const repository = makeRepository();
    await rollbackBuilderRevisionController(repository, user, publishRequest());
    expect(repository.rollbackToRevision).toHaveBeenCalledTimes(1);
    expect(repository.publishRevision).not.toHaveBeenCalled();
  });

  it('passes the validated rollback input unchanged', async () => {
    const repository = makeRepository();
    const request = { ...publishRequest(), expectedPublishedRevisionId: null };
    await rollbackBuilderRevisionController(repository, user, request);
    expect(repository.rollbackToRevision).toHaveBeenCalledWith(request, user);
  });

  it('maps rollback conflicts to 409', async () => {
    const repository = makeRepository();
    vi.mocked(repository.rollbackToRevision).mockResolvedValue(failure('CONFLICT'));
    expect((await rollbackBuilderRevisionController(repository, user, publishRequest())).status).toBe(409);
  });
});

describe('delete revision controller', () => {
  it('returns status 200 and the repository ID', async () => {
    const repository = makeRepository();
    const returned = { id: 'revision-1' };
    vi.mocked(repository.deleteRevisionIfUnpublished).mockResolvedValue({ success: true, data: returned });
    const response = await deleteBuilderRevisionController(repository, user, { revisionId: 'revision-1' });
    expect(response.status).toBe(200);
    expect(response.body.data).toBe(returned);
  });

  it('maps published-revision conflicts to 409', async () => {
    const repository = makeRepository();
    vi.mocked(repository.deleteRevisionIfUnpublished).mockResolvedValue(failure('CONFLICT'));
    expect((await deleteBuilderRevisionController(repository, user, { revisionId: 'revision-1' })).status)
      .toBe(409);
  });

  it('maps absent revisions to 404', async () => {
    const repository = makeRepository();
    vi.mocked(repository.deleteRevisionIfUnpublished).mockResolvedValue(failure('NOT_FOUND'));
    expect((await deleteBuilderRevisionController(repository, user, { revisionId: 'revision-1' })).status)
      .toBe(404);
  });

  it('rejects a blank revision ID without inferring other IDs', async () => {
    const repository = makeRepository();
    const response = await deleteBuilderRevisionController(repository, user, { revisionId: ' ' });
    expect(response.status).toBe(400);
    expect(repository.deleteRevisionIfUnpublished).not.toHaveBeenCalled();
  });
});

describe('controller immutability and exception safety', () => {
  it('does not mutate request objects', async () => {
    const repository = makeRepository();
    const create = createRequest();
    const list = { websiteId: 'website-1', pageId: 'page-1', limit: 2.5, cursor: 'cursor' };
    const publish = { ...publishRequest(), expectedPublishedRevisionId: null };
    const snapshots = [structuredClone(create), structuredClone(list), structuredClone(publish)];
    await createBuilderRevisionController(repository, user, create);
    await listBuilderRevisionsController(repository, user, list);
    await publishBuilderRevisionController(repository, user, publish);
    expect([create, list, publish]).toEqual(snapshots);
  });

  it('does not mutate user objects', async () => {
    const repository = makeRepository();
    const suppliedUser = structuredClone(user);
    const snapshot = structuredClone(suppliedUser);
    await createBuilderRevisionController(repository, suppliedUser, createRequest());
    expect(suppliedUser).toEqual(snapshot);
  });

  it('creates separate response body wrappers', async () => {
    const repository = makeRepository();
    const first = await deleteBuilderRevisionController(repository, user, { revisionId: 'revision-1' });
    const second = await deleteBuilderRevisionController(repository, user, { revisionId: 'revision-1' });
    expect(first.body).not.toBe(second.body);
  });

  it('hides thrown messages from get-publication errors', async () => {
    const repository = makeRepository();
    vi.mocked(repository.getPublicationTarget).mockRejectedValue(new Error('private target error'));
    const response = await getBuilderPublicationController(repository, user, {
      websiteId: 'website-1', pageId: 'page-1'
    });
    expect(response.status).toBe(500);
    expect(JSON.stringify(response)).not.toContain('private target error');
  });

  it('accepts a non-blank string user unchanged', async () => {
    const repository = makeRepository();
    await deleteBuilderRevisionController(repository, ' user-1 ', { revisionId: 'revision-1' });
    expect(repository.deleteRevisionIfUnpublished).toHaveBeenCalledWith('revision-1', ' user-1 ');
  });

  it('preserves all publish input fields and does not add unrelated data', async () => {
    const repository = makeRepository();
    const request = publishRequest();
    await publishBuilderRevisionController(repository, user, request);
    const expected: BuilderPublishRevisionInput = { ...request };
    expect(vi.mocked(repository.publishRevision).mock.calls[0][0]).toEqual(expected);
  });
});
