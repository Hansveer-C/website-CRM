import { describe, expect, it, vi } from 'vitest';
import { createBuilderDocument } from './builder_document';
import {
  createBuilderPublishedRevision,
  type BuilderPublishedRevision
} from './builder_publication';
import {
  handleBuilderPublicationBrowserRequest,
  isBuilderPublicationBrowserRequest
} from './builder_publication_browser';
import type {
  BuilderPublicationRepository,
  BuilderPublicationTarget,
  BuilderPublishRevisionResult
} from './builder_publication_repository';
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
    listRevisionsForPage: vi.fn(async () => ({ success: true, data: { items: [] } })),
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

async function readJson(response: Response | null): Promise<Record<string, unknown>> {
  expect(response).not.toBeNull();
  return response!.json() as Promise<Record<string, unknown>>;
}

describe('browser publication route precheck', () => {
  it.each(['/api/contacts', '/api/pages/page-1/sections', 'https://example.test/dashboard'])(
    'returns null for unrelated route %s',
    async url => {
      expect(await handleBuilderPublicationBrowserRequest(makeRepository(), user, url)).toBeNull();
      expect(isBuilderPublicationBrowserRequest(url)).toBe(false);
    }
  );

  it('allows publication-like but unmatched website routes to fall through', async () => {
    const repository = makeRepository();
    const result = await handleBuilderPublicationBrowserRequest(
      repository,
      user,
      '/api/websites/generate',
      { method: 'POST', body: JSON.stringify({ name: 'New website' }) }
    );
    expect(result).toBeNull();
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it('does not turn malformed unrelated website JSON into a publication response', async () => {
    const result = await handleBuilderPublicationBrowserRequest(
      makeRepository(),
      user,
      '/api/websites/generate',
      { method: 'POST', body: '{bad json' }
    );
    expect(result).toBeNull();
  });

  it.each([revisionsPath, publicationPath, deletePath])(
    'identifies publication API candidate %s',
    path => expect(isBuilderPublicationBrowserRequest(path)).toBe(true)
  );
});

describe('response conversion and method/URL normalization', () => {
  it('converts a matched result to a JSON Response', async () => {
    const response = await handleBuilderPublicationBrowserRequest(
      makeRepository(), user, publicationPath
    );
    expect(response).toBeInstanceOf(Response);
    expect(await readJson(response)).toEqual({
      success: true,
      data: { publishedRevision: null, target: null }
    });
  });

  it('preserves dispatcher status', async () => {
    const response = await handleBuilderPublicationBrowserRequest(
      makeRepository(),
      user,
      revisionsPath,
      { method: 'POST', body: JSON.stringify({ revision: makeRevision() }) }
    );
    expect(response?.status).toBe(201);
  });

  it('sets application/json content type', async () => {
    const response = await handleBuilderPublicationBrowserRequest(
      makeRepository(), user, publicationPath
    );
    expect(response?.headers.get('Content-Type')).toBe('application/json');
  });

  it('supports relative URLs', async () => {
    expect((await handleBuilderPublicationBrowserRequest(
      makeRepository(), user, publicationPath
    ))?.status).toBe(200);
  });

  it('supports absolute URLs', async () => {
    expect((await handleBuilderPublicationBrowserRequest(
      makeRepository(), user, `https://crm.example.test${publicationPath}`
    ))?.status).toBe(200);
  });

  it('defaults string inputs to GET', async () => {
    const repository = makeRepository();
    await handleBuilderPublicationBrowserRequest(repository, user, publicationPath);
    expect(repository.getPublicationTarget).toHaveBeenCalledTimes(1);
  });

  it.each(['post', 'POST', 'Post'])('preserves explicit method semantics: %s', async method => {
    const repository = makeRepository();
    const response = await handleBuilderPublicationBrowserRequest(
      repository,
      user,
      revisionsPath,
      { method, body: JSON.stringify({ revision: makeRevision() }) }
    );
    expect(response?.status).toBe(201);
    expect(repository.createRevision).toHaveBeenCalledTimes(1);
  });

  it('uses a native Request method and safely clones its body', async () => {
    const repository = makeRepository();
    const request = new Request(`https://crm.example.test${revisionsPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: makeRevision() })
    });
    const response = await handleBuilderPublicationBrowserRequest(repository, user, request);
    expect(response?.status).toBe(201);
    expect(request.bodyUsed).toBe(false);
  });
});

describe('publication body parsing', () => {
  it('parses valid JSON bodies', async () => {
    const repository = makeRepository();
    const revision = makeRevision();
    await handleBuilderPublicationBrowserRequest(repository, user, revisionsPath, {
      method: 'POST',
      body: JSON.stringify({ revision })
    });
    expect(repository.createRevision).toHaveBeenCalledWith(revision, user);
  });

  it('preserves already parsed plain object bodies', async () => {
    const repository = makeRepository();
    const revision = makeRevision();
    const body = { revision };
    await handleBuilderPublicationBrowserRequest(repository, user, revisionsPath, {
      method: 'POST',
      body: body as unknown as BodyInit
    });
    expect(repository.createRevision).toHaveBeenCalledWith(revision, user);
  });

  it('keeps missing bodies undefined for dispatcher validation', async () => {
    const repository = makeRepository();
    const response = await handleBuilderPublicationBrowserRequest(
      repository, user, revisionsPath, { method: 'POST' }
    );
    expect(response?.status).toBe(400);
    expect((await readJson(response)).code).toBe('INVALID_INPUT');
    expect(repository.createRevision).not.toHaveBeenCalled();
  });

  it.each(['', '   ', '\n\t'])('returns 400 for blank JSON body %#', async body => {
    const response = await handleBuilderPublicationBrowserRequest(
      makeRepository(), user, revisionsPath, { method: 'POST', body }
    );
    expect(response?.status).toBe(400);
    expect(await readJson(response)).toEqual({
      success: false,
      code: 'INVALID_INPUT',
      error: 'Invalid JSON request body'
    });
  });

  it.each(['{bad', '{"revision":', 'not-json'])('returns safe 400 for malformed JSON %#', async body => {
    const response = await handleBuilderPublicationBrowserRequest(
      makeRepository(), user, revisionsPath, { method: 'POST', body }
    );
    const json = await readJson(response);
    expect(response?.status).toBe(400);
    expect(json.error).toBe('Invalid JSON request body');
    expect(JSON.stringify(json)).not.toContain('Unexpected');
    expect(JSON.stringify(json)).not.toContain('position');
  });

  it('does not parse GET bodies', async () => {
    const repository = makeRepository();
    const response = await handleBuilderPublicationBrowserRequest(
      repository,
      user,
      publicationPath,
      { method: 'GET', body: '{bad json' }
    );
    expect(response?.status).toBe(200);
    expect(repository.getPublicationTarget).toHaveBeenCalledTimes(1);
  });

  it('ignores DELETE bodies', async () => {
    const repository = makeRepository();
    const response = await handleBuilderPublicationBrowserRequest(
      repository,
      user,
      deletePath,
      { method: 'DELETE', body: '{bad json' }
    );
    expect(response?.status).toBe(200);
    expect(repository.deleteRevisionIfUnpublished).toHaveBeenCalledWith('revision-1', user);
  });

  it.each([
    ['array'],
    new URLSearchParams('revision=value'),
    new Blob(['binary']),
    42
  ])('rejects unsupported publication body type %#', async body => {
    const repository = makeRepository();
    const response = await handleBuilderPublicationBrowserRequest(
      repository,
      user,
      revisionsPath,
      { method: 'POST', body: body as BodyInit }
    );
    expect(response?.status).toBe(400);
    expect((await readJson(response)).error).toBe('Unsupported publication request body');
    expect(repository.createRevision).not.toHaveBeenCalled();
  });
});

describe('delegation, immutability, and error safety', () => {
  it('preserves dispatcher/controller success data', async () => {
    const repository = makeRepository();
    const result = makePublishResult();
    vi.mocked(repository.publishRevision).mockResolvedValue({ success: true, data: result });
    const response = await handleBuilderPublicationBrowserRequest(
      repository,
      user,
      publicationPath,
      {
        method: 'PUT',
        body: JSON.stringify({
          revisionId: 'revision-1',
          publishedAt: '2026-07-25T13:00:00.000Z'
        })
      }
    );
    expect(await readJson(response)).toEqual({ success: true, data: result });
  });

  it('preserves dispatcher/controller errors', async () => {
    const repository = makeRepository();
    vi.mocked(repository.deleteRevisionIfUnpublished).mockResolvedValue({
      success: false,
      code: 'CONFLICT',
      error: 'Revision is currently published'
    });
    const response = await handleBuilderPublicationBrowserRequest(
      repository, user, deletePath, { method: 'DELETE' }
    );
    expect(response?.status).toBe(409);
    expect(await readJson(response)).toEqual({
      success: false,
      code: 'CONFLICT',
      error: 'Revision is currently published'
    });
  });

  it('does not mutate input, RequestInit, or parsed body', async () => {
    const repository = makeRepository();
    const revision = makeRevision();
    const body = { revision };
    const init = { method: 'POST', body: body as unknown as BodyInit };
    const input = new URL(`https://crm.example.test${revisionsPath}`);
    const inputBefore = input.toString();
    const initBefore = { ...init };
    const bodyBefore = structuredClone(body);
    await handleBuilderPublicationBrowserRequest(repository, user, input, init);
    expect(input.toString()).toBe(inputBefore);
    expect(init).toEqual(initBefore);
    expect(body).toEqual(bodyBefore);
  });

  it('does not mutate users', async () => {
    const repository = makeRepository();
    const suppliedUser = structuredClone(user);
    const snapshot = structuredClone(suppliedUser);
    await handleBuilderPublicationBrowserRequest(repository, suppliedUser, publicationPath);
    expect(suppliedUser).toEqual(snapshot);
  });

  it('does not mutate repositories', async () => {
    const repository = makeRepository();
    const keys = Reflect.ownKeys(repository);
    await handleBuilderPublicationBrowserRequest(repository, user, publicationPath);
    expect(Reflect.ownKeys(repository)).toEqual(keys);
  });

  it('returns safe 500 for unexpected bridge exceptions', async () => {
    const request = new Request(`https://crm.example.test${revisionsPath}`, {
      method: 'POST',
      body: JSON.stringify({ revision: makeRevision() })
    });
    Object.defineProperty(request, 'clone', {
      value: () => { throw new Error('private stream detail'); }
    });
    const response = await handleBuilderPublicationBrowserRequest(makeRepository(), user, request);
    expect(response?.status).toBe(500);
    const json = await readJson(response);
    expect(json).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Builder publication request failed'
    });
    expect(JSON.stringify(json)).not.toContain('private stream detail');
  });

  it('delegates rollback without calling publish', async () => {
    const repository = makeRepository();
    await handleBuilderPublicationBrowserRequest(repository, user, rollbackPath, {
      method: 'POST',
      body: JSON.stringify({
        revisionId: 'revision-1',
        publishedAt: '2026-07-25T13:00:00.000Z'
      })
    });
    expect(repository.rollbackToRevision).toHaveBeenCalledTimes(1);
    expect(repository.publishRevision).not.toHaveBeenCalled();
  });
});
