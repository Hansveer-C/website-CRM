import { describe, expect, it, vi } from 'vitest';
import type { BuilderPublishedRevision } from './builder_publication';
import {
  createBuilderPageRevision,
  getBuilderPagePublication,
  listBuilderPageRevisions,
  publishBuilderPageRevision,
  rollbackBuilderPageRevision,
  type BuilderPublicationFetch,
  type ListBuilderPageRevisionsInput,
  type PublishBuilderPageRevisionInput
} from './builder_publication_client';
import type {
  BuilderPublicationTarget,
  BuilderPublishRevisionResult
} from './builder_publication_repository';

function revision(): BuilderPublishedRevision {
  return {
    schemaVersion: 1,
    id: 'revision-1',
    websiteId: 'website-1',
    pageId: 'page-1',
    createdAt: '2026-07-25T12:00:00.000Z',
    createdBy: 'user-1',
    document: {
      schemaVersion: 1,
      page: {
        id: 'page-1',
        user_id: 'user-1',
        name: 'Home',
        slug: 'home',
        status: 'draft',
        seo_title: 'Home',
        seo_description: 'Home page',
        seo_keywords: [],
        created_at: '2026-07-25T00:00:00.000Z'
      },
      sections: []
    },
    documentFingerprint: 'fingerprint'
  };
}

function target(): BuilderPublicationTarget {
  return {
    websiteId: 'website-1',
    pageId: 'page-1',
    publishedRevisionId: 'revision-1',
    publishedAt: '2026-07-25T12:05:00.000Z',
    publishedBy: 'user-1'
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function fetchMock(body: unknown, status = 200): BuilderPublicationFetch {
  return vi.fn(async () => jsonResponse(body, status));
}

describe('Builder publication client', () => {
  it('loads an existing publication', async () => {
    const data = { publishedRevision: revision(), target: target() };
    const result = await getBuilderPagePublication(
      fetchMock({ success: true, data }), 'website-1', 'page-1'
    );
    expect(result).toEqual({ success: true, status: 200, data });
  });

  it('preserves missing publication null values', async () => {
    const data = { publishedRevision: null, target: null };
    const result = await getBuilderPagePublication(
      fetchMock({ success: true, data }), 'website-1', 'page-1'
    );
    expect(result.success && result.data).toEqual(data);
  });

  it('creates a revision and preserves immutable result identity', async () => {
    const returned = revision();
    const result = await createBuilderPageRevision(
      fetchMock({ success: true, data: returned }, 201),
      'website-1', 'page-1', revision()
    );
    expect(result).toEqual({ success: true, status: 201, data: returned });
  });

  it('publishes a revision', async () => {
    const data: BuilderPublishRevisionResult = {
      revision: revision(), target: target(), previousRevisionId: null
    };
    const result = await publishBuilderPageRevision(
      fetchMock({ success: true, data }),
      'website-1', 'page-1',
      {
        revisionId: 'revision-1',
        publishedAt: '2026-07-25T12:05:00.000Z',
        expectedPublishedRevisionId: null
      }
    );
    expect(result).toEqual({ success: true, status: 200, data });
  });

  it.each([null, 'revision-previous'])(
    'preserves expected revision value %#',
    async expectedPublishedRevisionId => {
      const fetcher = fetchMock({
        success: true,
        data: { revision: revision(), target: target(), previousRevisionId: null }
      });
      await publishBuilderPageRevision(fetcher, 'website-1', 'page-1', {
        revisionId: 'revision-1',
        publishedAt: '2026-07-25T12:05:00.000Z',
        expectedPublishedRevisionId
      });
      const requestBody = JSON.parse(
        String(vi.mocked(fetcher).mock.calls[0][1]?.body)
      ) as PublishBuilderPageRevisionInput;
      expect(requestBody.expectedPublishedRevisionId).toBe(expectedPublishedRevisionId);
    }
  );

  it('returns API error envelopes safely', async () => {
    const result = await publishBuilderPageRevision(
      fetchMock({ success: false, code: 'CONFLICT', error: 'Conflict' }, 409),
      'website-1', 'page-1',
      {
        revisionId: 'revision-1',
        publishedAt: '2026-07-25T12:05:00.000Z',
        expectedPublishedRevisionId: null
      }
    );
    expect(result).toEqual({ success: false, status: 409, error: 'Conflict', code: 'CONFLICT' });
  });

  it.each([
    {},
    { success: 'yes', data: {} },
    { success: true },
    null
  ])('rejects malformed response envelope %#', async envelope => {
    const result = await getBuilderPagePublication(
      fetchMock(envelope), 'website-1', 'page-1'
    );
    expect(result).toEqual({
      success: false,
      status: 200,
      error: 'Invalid publication response',
      code: 'INVALID_RESPONSE'
    });
  });

  it('rejects non-JSON responses safely', async () => {
    const fetcher = vi.fn(async () => new Response('<html>', { status: 200 }));
    const result = await getBuilderPagePublication(fetcher, 'website-1', 'page-1');
    expect(result.success).toBe(false);
    expect(!result.success && result.code).toBe('INVALID_RESPONSE');
  });

  it('returns safe failures for network errors without exposing messages', async () => {
    const fetcher = vi.fn(async () => { throw new Error('private network detail'); });
    const result = await getBuilderPagePublication(fetcher, 'website-1', 'page-1');
    expect(result).toEqual({
      success: false,
      status: 0,
      error: 'Builder publication request failed',
      code: 'NETWORK_ERROR'
    });
    expect(JSON.stringify(result)).not.toContain('private network detail');
  });

  it('sends only the expected create body field', async () => {
    const fetcher = fetchMock({ success: true, data: revision() }, 201);
    const supplied = revision();
    await createBuilderPageRevision(fetcher, 'website-1', 'page-1', supplied);
    const init = vi.mocked(fetcher).mock.calls[0][1];
    expect(JSON.parse(String(init?.body))).toEqual({ revision: supplied });
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('sends only expected publish body fields', async () => {
    const fetcher = fetchMock({
      success: true,
      data: { revision: revision(), target: target(), previousRevisionId: null }
    });
    const input: PublishBuilderPageRevisionInput = {
      revisionId: 'revision-1',
      publishedAt: '2026-07-25T12:05:00.000Z',
      expectedPublishedRevisionId: 'revision-previous'
    };
    await publishBuilderPageRevision(fetcher, 'website-1', 'page-1', input);
    expect(JSON.parse(String(vi.mocked(fetcher).mock.calls[0][1]?.body))).toEqual(input);
  });

  it('does not mutate inputs and uses the injected fetch', async () => {
    const fetcher = fetchMock({
      success: true,
      data: { revision: revision(), target: target(), previousRevisionId: null }
    });
    const input: PublishBuilderPageRevisionInput = {
      revisionId: 'revision-1',
      publishedAt: '2026-07-25T12:05:00.000Z',
      expectedPublishedRevisionId: null
    };
    const snapshot = structuredClone(input);
    await publishBuilderPageRevision(fetcher, 'website-1', 'page-1', input);
    expect(input).toEqual(snapshot);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('encodes website and page route IDs', async () => {
    const fetcher = fetchMock({
      success: true,
      data: { publishedRevision: null, target: null }
    });
    await getBuilderPagePublication(fetcher, 'website one', 'page/one');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/websites/website%20one/pages/page%2Fone/publication',
      { method: 'GET' }
    );
  });

  describe('version history', () => {
    it('uses GET without unnecessary query parameters when options are omitted', async () => {
      const fetcher = fetchMock({ success: true, data: { items: [] } });
      await listBuilderPageRevisions(fetcher, {
        websiteId: 'website-1',
        pageId: 'page-1'
      });
      expect(fetcher).toHaveBeenCalledWith(
        '/api/websites/website-1/pages/page-1/revisions',
        { method: 'GET' }
      );
    });

    it('URL-encodes path IDs and includes the limit', async () => {
      const fetcher = fetchMock({ success: true, data: { items: [] } });
      await listBuilderPageRevisions(fetcher, {
        websiteId: 'website one',
        pageId: 'page/one',
        limit: 25
      });
      expect(fetcher).toHaveBeenCalledWith(
        '/api/websites/website%20one/pages/page%2Fone/revisions?limit=25',
        { method: 'GET' }
      );
    });

    it('encodes a cursor while preserving its exact decoded value', async () => {
      const fetcher = fetchMock({ success: true, data: { items: [] } });
      const cursor = '2026-07-25T12:00:00.000Z|revision / + ?';
      await listBuilderPageRevisions(fetcher, {
        websiteId: 'website-1', pageId: 'page-1', cursor
      });
      const calledUrl = String(vi.mocked(fetcher).mock.calls[0][0]);
      expect(new URL(calledUrl, 'http://local').searchParams.get('cursor')).toBe(cursor);
      expect(calledUrl).not.toContain('revision / + ?');
    });

    it('returns history items and preserves nextCursor', async () => {
      const data = { items: [revision()], nextCursor: 'next cursor' };
      const result = await listBuilderPageRevisions(
        fetchMock({ success: true, data }),
        { websiteId: 'website-1', pageId: 'page-1', limit: 25 }
      );
      expect(result).toEqual({ success: true, status: 200, data });
    });

    it('handles an empty history page', async () => {
      const result = await listBuilderPageRevisions(
        fetchMock({ success: true, data: { items: [] } }),
        { websiteId: 'website-1', pageId: 'page-1' }
      );
      expect(result.success && result.data.items).toEqual([]);
    });

    it('returns history API errors safely', async () => {
      const result = await listBuilderPageRevisions(
        fetchMock({ success: false, code: 'FORBIDDEN', error: 'Forbidden' }, 403),
        { websiteId: 'website-1', pageId: 'page-1' }
      );
      expect(result).toEqual({ success: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' });
    });

    it.each([
      { success: true, data: {} },
      { success: true, data: { items: 'not-an-array' } },
      { success: true, data: { items: [], nextCursor: 7 } }
    ])('rejects malformed history data %#', async envelope => {
      const result = await listBuilderPageRevisions(
        fetchMock(envelope),
        { websiteId: 'website-1', pageId: 'page-1' }
      );
      expect(!result.success && result.code).toBe('INVALID_RESPONSE');
    });

    it('handles history network errors safely', async () => {
      const fetcher = vi.fn(async () => { throw new Error('private history failure'); });
      const result = await listBuilderPageRevisions(fetcher, {
        websiteId: 'website-1', pageId: 'page-1'
      });
      expect(result).toEqual({
        success: false,
        status: 0,
        error: 'Builder publication request failed',
        code: 'NETWORK_ERROR'
      });
      expect(JSON.stringify(result)).not.toContain('private history failure');
    });

    it('does not mutate history input and uses injected fetch', async () => {
      const fetcher = fetchMock({ success: true, data: { items: [] } });
      const input: ListBuilderPageRevisionsInput = {
        websiteId: 'website-1', pageId: 'page-1', limit: 25, cursor: 'cursor-1'
      };
      const snapshot = structuredClone(input);
      await listBuilderPageRevisions(fetcher, input);
      expect(input).toEqual(snapshot);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('rollback', () => {
    function rollbackResult(): BuilderPublishRevisionResult {
      return { revision: revision(), target: target(), previousRevisionId: 'revision-2' };
    }

    it('uses POST at the encoded rollback URL', async () => {
      const fetcher = fetchMock({ success: true, data: rollbackResult() });
      await rollbackBuilderPageRevision(fetcher, {
        websiteId: 'website one', pageId: 'page/one', revisionId: 'revision-1',
        expectedPublishedRevisionId: null, publishedAt: '2026-07-25T13:00:00.000Z'
      });
      const [url, init] = vi.mocked(fetcher).mock.calls[0];
      expect(url).toBe('/api/websites/website%20one/pages/page%2Fone/publication/rollback');
      expect(init?.method).toBe('POST');
    });

    it.each([null, 'revision-current'])(
      'preserves rollback expectation %# and sends only expected body fields',
      async expectedPublishedRevisionId => {
        const fetcher = fetchMock({ success: true, data: rollbackResult() });
        await rollbackBuilderPageRevision(fetcher, {
          websiteId: 'website-1', pageId: 'page-1', revisionId: 'revision-1',
          expectedPublishedRevisionId, publishedAt: '2026-07-25T13:00:00.000Z'
        });
        expect(JSON.parse(String(vi.mocked(fetcher).mock.calls[0][1]?.body))).toEqual({
          revisionId: 'revision-1',
          expectedPublishedRevisionId,
          publishedAt: '2026-07-25T13:00:00.000Z'
        });
      }
    );

    it('returns rollback success', async () => {
      const data = rollbackResult();
      const result = await rollbackBuilderPageRevision(
        fetchMock({ success: true, data }),
        {
          websiteId: 'website-1', pageId: 'page-1', revisionId: 'revision-1',
          expectedPublishedRevisionId: 'revision-2', publishedAt: '2026-07-25T13:00:00.000Z'
        }
      );
      expect(result).toEqual({ success: true, status: 200, data });
    });

    it('returns rollback conflicts safely', async () => {
      const result = await rollbackBuilderPageRevision(
        fetchMock({ success: false, code: 'CONFLICT', error: 'Conflict' }, 409),
        {
          websiteId: 'website-1', pageId: 'page-1', revisionId: 'revision-1',
          expectedPublishedRevisionId: 'revision-2', publishedAt: '2026-07-25T13:00:00.000Z'
        }
      );
      expect(result).toEqual({ success: false, status: 409, error: 'Conflict', code: 'CONFLICT' });
    });

    it.each([
      { success: true, data: {} },
      { success: true, data: { revision: {}, target: {}, previousRevisionId: 7 } }
    ])('rejects malformed rollback data %#', async envelope => {
      const result = await rollbackBuilderPageRevision(fetchMock(envelope), {
        websiteId: 'website-1', pageId: 'page-1', revisionId: 'revision-1',
        expectedPublishedRevisionId: null, publishedAt: '2026-07-25T13:00:00.000Z'
      });
      expect(!result.success && result.code).toBe('INVALID_RESPONSE');
    });

    it('handles rollback network errors without exposing thrown messages', async () => {
      const fetcher = vi.fn(async () => { throw new Error('private rollback failure'); });
      const result = await rollbackBuilderPageRevision(fetcher, {
        websiteId: 'website-1', pageId: 'page-1', revisionId: 'revision-1',
        expectedPublishedRevisionId: null, publishedAt: '2026-07-25T13:00:00.000Z'
      });
      expect(!result.success && result.code).toBe('NETWORK_ERROR');
      expect(JSON.stringify(result)).not.toContain('private rollback failure');
    });

    it('does not mutate rollback input and uses injected fetch', async () => {
      const fetcher = fetchMock({ success: true, data: rollbackResult() });
      const input = {
        websiteId: 'website-1', pageId: 'page-1', revisionId: 'revision-1',
        expectedPublishedRevisionId: 'revision-2', publishedAt: '2026-07-25T13:00:00.000Z'
      };
      const snapshot = structuredClone(input);
      await rollbackBuilderPageRevision(fetcher, input);
      expect(input).toEqual(snapshot);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });
});
