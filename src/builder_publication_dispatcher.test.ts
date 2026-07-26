import { describe, expect, it, vi } from 'vitest';
import { createBuilderDocument } from './builder_document';
import {
  createBuilderPublishedRevision,
  type BuilderPublishedRevision
} from './builder_publication';
import type {
  BuilderPublicationRepository,
  BuilderPublicationTarget,
  BuilderPublishRevisionResult
} from './builder_publication_repository';
import {
  dispatchBuilderPublicationRequest,
  type BuilderPublicationDispatchRequest,
  type BuilderPublicationDispatchResult
} from './builder_publication_dispatcher';
import type { Page, PageSection, User } from './types';

const revisionsPath = '/api/websites/website-1/pages/page-1/revisions';
const publicationPath = '/api/websites/website-1/pages/page-1/publication';
const rollbackPath = `${publicationPath}/rollback`;
const deletePath = '/api/builder-revisions/revision-1';

const user: User = {
  id: 'user-1',
  email: 'owner@example.com',
  password_hash: 'hash',
  created_at: '2026-07-25T00:00:00.000Z'
};

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

function publishBody(): Record<string, unknown> {
  return {
    revisionId: 'revision-1',
    publishedAt: '2026-07-25T13:00:00.000Z'
  };
}

async function dispatch(
  repository: BuilderPublicationRepository,
  method: string,
  url: string,
  body?: unknown
): Promise<BuilderPublicationDispatchResult | null> {
  return dispatchBuilderPublicationRequest(repository, user, { method, url, body });
}

describe('dispatcher public contract and route recognition', () => {
  it('exports the request, result, and callable dispatcher contracts', async () => {
    const request: BuilderPublicationDispatchRequest = { method: 'GET', url: publicationPath };
    const result: BuilderPublicationDispatchResult | null = await dispatchBuilderPublicationRequest(
      makeRepository(), user, request
    );
    expect(result?.matched).toBe(true);
    expect(typeof dispatchBuilderPublicationRequest).toBe('function');
  });

  it.each([
    '/contacts',
    '/api/contacts',
    '/api/websites/website-1',
    '/api/websites/website-1/pages/page-1'
  ])('returns null for unrelated route %s', async url => {
    expect(await dispatch(makeRepository(), 'GET', url)).toBeNull();
  });

  it.each([
    '/api/websites/website-1/pages/page-1/revision',
    '/api/websites/website-1/pages/publication',
    '/api/builder-revisions',
    '/api/websites//pages/page-1/revisions'
  ])('returns null for partial publication-like path %s', async url => {
    expect(await dispatch(makeRepository(), 'GET', url)).toBeNull();
  });

  it('supports full absolute URLs', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', `https://crm.example.test${publicationPath}`);
    expect(result?.response.status).toBe(200);
    expect(repository.getPublicationTarget).toHaveBeenCalledTimes(1);
  });

  it('supports relative URLs', async () => {
    expect((await dispatch(makeRepository(), 'GET', publicationPath))?.response.status).toBe(200);
  });

  it('ignores URL fragments', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'GET', `${publicationPath}#not-part-of-path`);
    expect(repository.getPublicationTarget).toHaveBeenCalledTimes(1);
  });

  it.each([revisionsPath, publicationPath, rollbackPath, deletePath])(
    'supports one optional trailing slash for %s',
    async path => {
      const method = path === revisionsPath || path === publicationPath ? 'GET'
        : path === rollbackPath ? 'POST'
          : 'DELETE';
      const body = path === rollbackPath ? publishBody() : undefined;
      expect((await dispatch(makeRepository(), method, `${path}/`, body))?.matched).toBe(true);
    }
  );

  it.each([revisionsPath, publicationPath, rollbackPath, deletePath])(
    'does not match repeated trailing slashes for %s',
    async path => {
      expect(await dispatch(makeRepository(), 'GET', `${path}//`)).toBeNull();
    }
  );

  it('keeps literal route segments case-sensitive', async () => {
    expect(await dispatch(
      makeRepository(),
      'GET',
      '/api/Websites/website-1/pages/page-1/publication'
    )).toBeNull();
  });

  it.each(['get', 'Get', 'gEt'])('matches HTTP methods case-insensitively: %s', async method => {
    expect((await dispatch(makeRepository(), method, publicationPath))?.response.status).toBe(200);
  });

  it.each([
    `${revisionsPath}/extra`,
    `${publicationPath}/extra`,
    `${rollbackPath}/extra`,
    `${deletePath}/extra`
  ])('does not match additional path segments: %s', async url => {
    expect(await dispatch(makeRepository(), 'GET', url)).toBeNull();
  });
});

describe('create revision dispatch', () => {
  it('delegates a valid create request', async () => {
    const repository = makeRepository();
    const revision = makeRevision();
    const result = await dispatch(repository, 'POST', revisionsPath, { revision });
    expect(result?.response.status).toBe(201);
    expect(repository.createRevision).toHaveBeenCalledWith(revision, user);
  });

  it('derives website and page IDs from the URL', async () => {
    const repository = makeRepository();
    const revision = makeRevision();
    await dispatch(repository, 'POST', revisionsPath, {
      revision,
      websiteId: 'body-website',
      pageId: 'body-page'
    });
    expect(repository.createRevision).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, [], ['revision']])('rejects invalid create body %#', async body => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'POST', revisionsPath, body);
    expect(result?.response.status).toBe(400);
    expect(result?.response.body.code).toBe('INVALID_INPUT');
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it('rejects a create body without an own revision property', async () => {
    const repository = makeRepository();
    const inherited = Object.create({ revision: makeRevision() }) as Record<string, unknown>;
    const result = await dispatch(repository, 'POST', revisionsPath, inherited);
    expect(result?.response.status).toBe(400);
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it('passes only the own revision value to the controller', async () => {
    const repository = makeRepository();
    const revision = makeRevision();
    await dispatch(repository, 'POST', revisionsPath, { revision, ignored: 'value' });
    expect(repository.createRevision).toHaveBeenCalledWith(revision, user);
  });
});

describe('list revisions query parsing', () => {
  it('delegates a valid list request', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', revisionsPath);
    expect(result?.response.status).toBe(200);
    expect(repository.listRevisionsForPage).toHaveBeenCalledTimes(1);
  });

  it('keeps omitted options undefined', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'GET', revisionsPath);
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website-1', 'page-1', user, undefined
    );
  });

  it.each([
    ['10', 10],
    ['2.75', 2.75],
    ['1e2', 100]
  ])('parses numeric limit %s as %s', async (raw, expected) => {
    const repository = makeRepository();
    await dispatch(repository, 'GET', `${revisionsPath}?limit=${raw}`);
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website-1', 'page-1', user, { limit: expected }
    );
  });

  it.each(['', 'abc', 'Infinity', 'NaN'])('rejects invalid limit %s', async limit => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', `${revisionsPath}?limit=${limit}`);
    expect(result?.response.status).toBe(400);
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });

  it('rejects duplicate limits', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', `${revisionsPath}?limit=1&limit=2`);
    expect(result?.response.status).toBe(400);
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });

  it('passes a decoded cursor through unchanged', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'GET', `${revisionsPath}?cursor=opaque%20cursor%2Bvalue`);
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website-1', 'page-1', user, { cursor: 'opaque cursor+value' }
    );
  });

  it('rejects an empty cursor', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', `${revisionsPath}?cursor=`);
    expect(result?.response.status).toBe(400);
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });

  it('rejects duplicate cursors', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', `${revisionsPath}?cursor=a&cursor=b`);
    expect(result?.response.status).toBe(400);
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });

  it('ignores unknown query parameters', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'GET', `${revisionsPath}?unknown=value`);
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website-1', 'page-1', user, undefined
    );
  });
});

describe('publication, publish, rollback, and delete dispatch', () => {
  it('delegates get-publication', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'GET', publicationPath);
    expect(repository.getPublicationTarget).toHaveBeenCalledWith('website-1', 'page-1', user);
    expect(repository.getPublishedRevisionForPage).toHaveBeenCalledWith('website-1', 'page-1', user);
  });

  it('delegates a valid publish request', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'PUT', publicationPath, publishBody());
    expect(result?.response.status).toBe(200);
    expect(repository.publishRevision).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, [], 'json'])('requires an object publish body: %#', async body => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'PUT', publicationPath, body);
    expect(result?.response.status).toBe(400);
    expect(repository.publishRevision).not.toHaveBeenCalled();
  });

  it('keeps an omitted publish expectation omitted', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'PUT', publicationPath, publishBody());
    const input = vi.mocked(repository.publishRevision).mock.calls[0][0];
    expect(Object.hasOwn(input, 'expectedPublishedRevisionId')).toBe(false);
  });

  it('accepts an explicitly present undefined expectation without coercing it', async () => {
    const repository = makeRepository();
    const body = { ...publishBody(), expectedPublishedRevisionId: undefined };
    const snapshot = { ...body };
    const result = await dispatch(repository, 'PUT', publicationPath, body);
    expect(result?.response.status).toBe(200);
    expect(body).toEqual(snapshot);
    expect(Object.hasOwn(body, 'expectedPublishedRevisionId')).toBe(true);
  });

  it.each([null, 'revision-previous'])('preserves publish expectation %#', async expectation => {
    const repository = makeRepository();
    await dispatch(repository, 'PUT', publicationPath, {
      ...publishBody(), expectedPublishedRevisionId: expectation
    });
    expect(vi.mocked(repository.publishRevision).mock.calls[0][0].expectedPublishedRevisionId)
      .toBe(expectation);
  });

  it('matches rollback before the general publication route', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'POST', rollbackPath, publishBody());
    expect(repository.rollbackToRevision).toHaveBeenCalledTimes(1);
    expect(repository.publishRevision).not.toHaveBeenCalled();
    expect(repository.getPublicationTarget).not.toHaveBeenCalled();
  });

  it('delegates rollback with decoded path IDs', async () => {
    const repository = makeRepository();
    await dispatch(
      repository,
      'POST',
      '/api/websites/website%2D1/pages/page%2D1/publication/rollback',
      publishBody()
    );
    expect(repository.rollbackToRevision).toHaveBeenCalledTimes(1);
  });

  it('derives the delete revision ID only from the path', async () => {
    const repository = makeRepository();
    await dispatch(repository, 'DELETE', deletePath, { revisionId: 'body-revision' });
    expect(repository.deleteRevisionIfUnpublished).toHaveBeenCalledWith('revision-1', user);
  });

  it('ignores delete bodies, including arrays', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'DELETE', deletePath, ['ignored']);
    expect(result?.response.status).toBe(200);
    expect(repository.deleteRevisionIfUnpublished).toHaveBeenCalledTimes(1);
  });
});

describe('method handling and parameter decoding', () => {
  it.each([
    [revisionsPath, 'PATCH'],
    [publicationPath, 'POST'],
    [rollbackPath, 'PUT'],
    [deletePath, 'GET']
  ])('returns 405 for unsupported method on %s', async (url, method) => {
    const result = await dispatch(makeRepository(), method, url, publishBody());
    expect(result).toEqual({
      matched: true,
      response: {
        status: 405,
        body: { success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed' }
      }
    });
  });

  it.each([
    '/api/websites/%E0%A4%A/pages/page-1/revisions',
    '/api/websites/website-1/pages/%ZZ/publication',
    '/api/builder-revisions/%E0%A4%A'
  ])('returns safe 400 for malformed route encoding: %s', async url => {
    const result = await dispatch(makeRepository(), 'GET', url);
    expect(result?.response.status).toBe(400);
    expect(result?.response.body.code).toBe('INVALID_INPUT');
  });

  it.each([
    `${revisionsPath}?cursor=%E0%A4%A`,
    `${revisionsPath}?limit=%ZZ`
  ])('returns safe 400 for malformed query encoding: %s', async url => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', url);
    expect(result?.response.status).toBe(400);
    expect(result?.response.body.code).toBe('INVALID_INPUT');
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });

  it('decodes route IDs before delegation', async () => {
    const repository = makeRepository();
    await dispatch(
      repository,
      'GET',
      '/api/websites/website%20one/pages/page%2Bone/revisions'
    );
    expect(repository.listRevisionsForPage).toHaveBeenCalledWith(
      'website one', 'page+one', user, undefined
    );
  });

  it('allows encoded blank route IDs to reach controller validation', async () => {
    const repository = makeRepository();
    const result = await dispatch(repository, 'GET', '/api/websites/%20/pages/page-1/revisions');
    expect(result?.response.status).toBe(400);
    expect(repository.listRevisionsForPage).not.toHaveBeenCalled();
  });
});

describe('immutability, response preservation, and exception safety', () => {
  it('does not mutate dispatch requests or URLs', async () => {
    const repository = makeRepository();
    const request: BuilderPublicationDispatchRequest = {
      method: 'GET',
      url: `${revisionsPath}?limit=2.5&cursor=next#fragment`
    };
    const snapshot = structuredClone(request);
    await dispatchBuilderPublicationRequest(repository, user, request);
    expect(request).toEqual(snapshot);
  });

  it('does not mutate body values', async () => {
    const repository = makeRepository();
    const body = { ...publishBody(), expectedPublishedRevisionId: null, nested: { ignored: true } };
    const snapshot = structuredClone(body);
    await dispatch(repository, 'PUT', publicationPath, body);
    expect(body).toEqual(snapshot);
  });

  it('does not mutate user values', async () => {
    const repository = makeRepository();
    const suppliedUser = structuredClone(user);
    const snapshot = structuredClone(suppliedUser);
    await dispatchBuilderPublicationRequest(repository, suppliedUser, {
      method: 'GET', url: publicationPath
    });
    expect(suppliedUser).toEqual(snapshot);
  });

  it('preserves controller success data identity', async () => {
    const repository = makeRepository();
    const resultData = makePublishResult();
    vi.mocked(repository.publishRevision).mockResolvedValue({ success: true, data: resultData });
    const result = await dispatch(repository, 'PUT', publicationPath, publishBody());
    expect(result?.response.body.data).toBe(resultData);
  });

  it('preserves controller error status, code, and message', async () => {
    const repository = makeRepository();
    vi.mocked(repository.deleteRevisionIfUnpublished).mockResolvedValue({
      success: false,
      code: 'CONFLICT',
      error: 'Revision is currently published'
    });
    const result = await dispatch(repository, 'DELETE', deletePath);
    expect(result?.response).toEqual({
      status: 409,
      body: {
        success: false,
        code: 'CONFLICT',
        error: 'Revision is currently published'
      }
    });
  });

  it('returns safe 500 when delegated controller work throws unexpectedly', async () => {
    const repository = makeRepository();
    Object.defineProperty(repository, 'createRevision', {
      get: () => { throw new Error('private implementation detail'); }
    });
    const result = await dispatch(repository, 'POST', revisionsPath, { revision: makeRevision() });
    expect(result).toEqual({
      matched: true,
      response: {
        status: 500,
        body: {
          success: false,
          code: 'INTERNAL_ERROR',
          error: 'Builder publication request failed'
        }
      }
    });
    expect(JSON.stringify(result)).not.toContain('private implementation detail');
  });

  it('returns a fresh generated response wrapper on each transport error', async () => {
    const repository = makeRepository();
    const first = await dispatch(repository, 'PATCH', revisionsPath);
    const second = await dispatch(repository, 'PATCH', revisionsPath);
    expect(first).not.toBe(second);
    expect(first?.response).not.toBe(second?.response);
    expect(first?.response.body).not.toBe(second?.response.body);
  });

  it('does not invoke inherited publish body properties', async () => {
    const repository = makeRepository();
    const body = Object.create({
      revisionId: 'revision-1',
      publishedAt: '2026-07-25T13:00:00.000Z'
    }) as Record<string, unknown>;
    const result = await dispatch(repository, 'PUT', publicationPath, body);
    expect(result?.response.status).toBe(400);
    expect(repository.publishRevision).not.toHaveBeenCalled();
  });
});
