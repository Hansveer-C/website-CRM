import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicSitePayload } from '../supabase/functions/_shared/public_site_contract';
import {
  clearPublicSitePayloadCache,
  getPublicSitePayload,
  type PublicSiteFetcher
} from './public_site_client';

function payload(overrides: Partial<PublicSitePayload> = {}): PublicSitePayload {
  return {
    schemaVersion: 1,
    requestedHost: 'clean.example.com',
    requestedPath: '/',
    website: { id: 'website-1', name: 'Clean Co', domain: 'clean.example.com' },
    route: { id: 'route-1', websiteId: 'website-1', path: '/', funnelId: 'funnel-1' },
    settings: { businessName: 'Clean Co', phone: '555-0100', primaryColor: '#123456' },
    layout: {
      header: { navigation: [{ label: 'Home', path: '/' }] },
      footer: { links: [] }
    },
    page: { id: 'page-1', name: 'Home', slug: 'home', path: '/', seoTitle: 'Clean Co' },
    sections: [{
      id: 'section-1', type: 'custom-widget', order: 1,
      content: { nested: { keep: true } }, styles: { color: 'blue' }
    }],
    publication: { source: 'revision', fingerprint: 'public-fingerprint' },
    ...overrides
  };
}

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ETag: '"etag-1"', ...headers }
  });
}

function input(overrides: Partial<{ endpoint: string; host: string; path: string }> = {}) {
  return {
    endpoint: 'https://project.supabase.co/functions/v1/public-site',
    host: 'clean.example.com',
    path: '/',
    ...overrides
  };
}

describe('getPublicSitePayload', () => {
  beforeEach(clearPublicSitePayloadCache);

  it('uses GET with encoded query parameters', async () => {
    const fetcher = vi.fn<Parameters<PublicSiteFetcher>, ReturnType<PublicSiteFetcher>>().mockResolvedValue(jsonResponse(payload({
      requestedHost: 'wash.example.com', requestedPath: '/driveway washing',
      website: { id: 'website-1', name: 'Clean Co' },
      route: { id: 'route-1', websiteId: 'website-1', path: '/driveway washing', funnelId: 'funnel-1' },
      page: { id: 'page-1', name: 'Driveway', slug: 'driveway-washing', path: '/driveway washing' }
    })));
    await getPublicSitePayload(fetcher, input({ host: 'wash.example.com', path: '/driveway washing' }));
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain('host=wash.example.com');
    expect(String(url)).toContain('path=%2Fdriveway+washing');
    expect(init?.method).toBe('GET');
  });

  it('omits credentials and authorization', async () => {
    const fetcher = vi.fn<Parameters<PublicSiteFetcher>, ReturnType<PublicSiteFetcher>>().mockResolvedValue(jsonResponse(payload()));
    await getPublicSitePayload(fetcher, input());
    const init = fetcher.mock.calls[0][1]!;
    expect(init.credentials).toBe('omit');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('returns a validated payload', async () => {
    const result = await getPublicSitePayload(vi.fn().mockResolvedValue(jsonResponse(payload())), input());
    expect(result).toMatchObject({ state: 'success', payload: { schemaVersion: 1 } });
  });

  it('clones and deeply freezes the payload', async () => {
    const source = payload();
    const result = await getPublicSitePayload(vi.fn().mockResolvedValue(jsonResponse(source)), input());
    expect(result.state).toBe('success');
    if (result.state !== 'success') return;
    expect(result.payload).not.toBe(source);
    expect(Object.isFrozen(result.payload)).toBe(true);
    expect(Object.isFrozen(result.payload.sections[0].content.nested)).toBe(true);
  });

  it('uses a cached ETag and payload on 304', async () => {
    const fetcher = vi.fn<Parameters<PublicSiteFetcher>, ReturnType<PublicSiteFetcher>>()
      .mockResolvedValueOnce(jsonResponse(payload()))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const first = await getPublicSitePayload(fetcher, input());
    const second = await getPublicSitePayload(fetcher, input());
    expect(first.state).toBe('success');
    expect(second).toMatchObject({ state: 'not-modified', etag: '"etag-1"' });
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('If-None-Match')).toBe('"etag-1"');
  });

  it('rejects 304 without a cached payload', async () => {
    expect(await getPublicSitePayload(
      vi.fn().mockResolvedValue(new Response(null, { status: 304 })), input()
    )).toEqual({ state: 'malformed-response' });
  });

  it.each([
    [400, 'invalid-request'],
    [404, 'not-found'],
    [503, 'unavailable'],
    [500, 'unavailable'],
    [401, 'unavailable'],
    [418, 'unavailable']
  ])('maps HTTP %i to %s', async (status, state) => {
    const result = await getPublicSitePayload(
      vi.fn().mockResolvedValue(jsonResponse({ private: 'detail' }, status)), input()
    );
    expect(result.state).toBe(state);
  });

  it('rejects invalid JSON', async () => {
    const response = new Response('{bad', { status: 200, headers: { 'Content-Type': 'application/json' } });
    expect(await getPublicSitePayload(vi.fn().mockResolvedValue(response), input()))
      .toEqual({ state: 'malformed-response' });
  });

  it('rejects the wrong content type', async () => {
    const response = new Response(JSON.stringify(payload()), { status: 200, headers: { 'Content-Type': 'text/plain' } });
    expect(await getPublicSitePayload(vi.fn().mockResolvedValue(response), input()))
      .toEqual({ state: 'malformed-response' });
  });

  it('rejects an unsupported schema version', async () => {
    expect((await getPublicSitePayload(
      vi.fn().mockResolvedValue(jsonResponse({ ...payload(), schemaVersion: 2 })), input()
    )).state).toBe('malformed-response');
  });

  it.each(['website', 'route', 'settings', 'layout', 'page', 'sections', 'publication'])
    ('rejects a missing %s field', async field => {
      const candidate = { ...payload() } as Record<string, unknown>;
      delete candidate[field];
      expect((await getPublicSitePayload(vi.fn().mockResolvedValue(jsonResponse(candidate)), input())).state)
        .toBe('malformed-response');
    });

  it.each(['user_id', 'created_by', 'published_by', 'build_brief', 'history'])
    ('rejects forbidden top-level field %s', async field => {
      const candidate = { ...payload(), [field]: 'private' };
      expect((await getPublicSitePayload(vi.fn().mockResolvedValue(jsonResponse(candidate)), input())).state)
        .toBe('malformed-response');
    });

  it('rejects route scope mismatch', async () => {
    const candidate = payload({ route: { id: 'route-1', websiteId: 'other', path: '/', funnelId: 'funnel-1' } });
    expect((await getPublicSitePayload(vi.fn().mockResolvedValue(jsonResponse(candidate)), input())).state)
      .toBe('malformed-response');
  });

  it.each([
    [{ id: '', type: 'hero', order: 1, content: {}, styles: {} }],
    [{ id: 'one', type: '', order: 1, content: {}, styles: {} }],
    [{ id: 'one', type: 'hero', order: Infinity, content: {}, styles: {} }],
    [{ id: 'one', type: 'hero', order: 1, content: [], styles: {} }],
    [{ id: 'one', type: 'hero', order: 1, content: {}, styles: [], user_id: 'private' }]
  ])('rejects malformed section %#', async section => {
    expect((await getPublicSitePayload(
      vi.fn().mockResolvedValue(jsonResponse(payload({
        sections: [section] as unknown as PublicSitePayload['sections']
      }))), input()
    )).state).toBe('malformed-response');
  });

  it('preserves unknown custom section content', async () => {
    const result = await getPublicSitePayload(vi.fn().mockResolvedValue(jsonResponse(payload())), input());
    expect(result.state === 'success' && result.payload.sections[0].content).toEqual({ nested: { keep: true } });
  });

  it('isolates ETags by host', async () => {
    const fetcher = vi.fn<Parameters<PublicSiteFetcher>, ReturnType<PublicSiteFetcher>>()
      .mockResolvedValueOnce(jsonResponse(payload()))
      .mockResolvedValueOnce(jsonResponse(payload({
        requestedHost: 'other.example.com',
        website: { id: 'website-2', name: 'Other' },
        route: { id: 'route-2', websiteId: 'website-2', path: '/', funnelId: 'funnel-2' }
      }), 200, { ETag: '"etag-2"' }));
    await getPublicSitePayload(fetcher, input());
    await getPublicSitePayload(fetcher, input({ host: 'other.example.com' }));
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).has('If-None-Match')).toBe(false);
  });

  it('isolates ETags by path', async () => {
    const nested = payload({
      requestedPath: '/services',
      route: { id: 'route-2', websiteId: 'website-1', path: '/services', funnelId: 'funnel-2' },
      page: { id: 'page-2', name: 'Services', slug: 'services', path: '/services' }
    });
    const fetcher = vi.fn<Parameters<PublicSiteFetcher>, ReturnType<PublicSiteFetcher>>()
      .mockResolvedValueOnce(jsonResponse(payload()))
      .mockResolvedValueOnce(jsonResponse(nested, 200, { ETag: '"etag-2"' }));
    await getPublicSitePayload(fetcher, input());
    await getPublicSitePayload(fetcher, input({ path: '/services' }));
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).has('If-None-Match')).toBe(false);
  });

  it('sanitizes fetch failures', async () => {
    expect(await getPublicSitePayload(
      vi.fn().mockRejectedValue(new Error('database private detail')), input()
    )).toEqual({ state: 'network-failure' });
  });

  it('handles abort without exposing details', async () => {
    expect(await getPublicSitePayload(
      vi.fn().mockRejectedValue(new DOMException('secret', 'AbortError')), input()
    )).toEqual({ state: 'aborted' });
  });

  it('does not mutate inputs', async () => {
    const frozen = Object.freeze(input());
    await getPublicSitePayload(vi.fn().mockResolvedValue(jsonResponse(payload())), frozen);
    expect(frozen).toEqual(input());
  });

  it('rejects malformed ETags', async () => {
    expect((await getPublicSitePayload(
      vi.fn().mockResolvedValue(jsonResponse(payload(), 200, { ETag: 'raw-etag' })), input()
    )).state).toBe('malformed-response');
  });

  it('rejects excessive Content-Length', async () => {
    expect((await getPublicSitePayload(
      vi.fn().mockResolvedValue(jsonResponse(payload(), 200, { 'Content-Length': '3000000' })), input()
    )).state).toBe('malformed-response');
  });

  it('returns safe configuration failure for an invalid endpoint', async () => {
    const fetcher = vi.fn();
    expect(await getPublicSitePayload(fetcher, input({ endpoint: 'javascript:alert(1)' })))
      .toEqual({ state: 'configuration-failure' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
