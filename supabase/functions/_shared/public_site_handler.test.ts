import { describe, expect, it, vi } from 'vitest';
import { createBuilderDocumentFingerprint } from '../../../src/builder_publication';
import type { BuilderDocument } from '../../../src/builder_document';
import {
  handlePublicSiteRequest,
  normalizePublicHost,
  normalizePublicPath,
  type PublicSiteLogEvent
} from './public_site_handler';
import type {
  PublicLegacySectionRecord,
  PublicPageRecord,
  PublicPublicationTargetRecord,
  PublicPublishedRevisionRecord,
  PublicSiteDataSource,
  PublicWebsiteLayoutRecord,
  PublicWebsiteRecord,
  PublicWebsiteRouteRecord,
  PublicWebsiteSettingsRecord
} from './public_site_data_source';
import { PublicSiteDataSourceError } from './public_site_data_source';

const website: PublicWebsiteRecord = {
  id: 'website-1', ownerId: 'owner-1', name: 'Clean Co', domain: 'clean.example.com', subdomain: 'clean',
  homepageFunnelId: 'funnel-home'
};
const route: PublicWebsiteRouteRecord = {
  id: 'route-1', websiteId: website.id, path: '/', funnelId: 'funnel-home'
};
const page: PublicPageRecord = {
  id: 'page-1', ownerId: 'owner-1', name: 'Home', slug: 'home', status: 'published', seoTitle: 'Clean Co',
  seoDescription: 'Pressure washing', seoKeywords: null, funnelId: 'funnel-home', stepOrder: 1
};
const settings: PublicWebsiteSettingsRecord & Record<string, unknown> = {
  businessName: 'Clean Co', phone: '555-0100', email: 'hi@example.com', logoUrl: '/logo.svg',
  primaryColor: '#123456', facebookPixelId: 'pixel', gtmId: 'GTM-X', ga4MeasurementId: 'G-ABC',
  build_brief: 'private', user_id: 'owner-private'
};
const layout: PublicWebsiteLayoutRecord = {
  headerConfig: {
    logo_text: 'Clean Co', nav_items: [{ label: 'Home', path: '/', secret: 'omit' }],
    private_admin_link: '/admin'
  },
  footerConfig: { business_name: 'Clean Co', phone_number: '555-0100', links: [] }
};
const legacySections: PublicLegacySectionRecord[] = [
  { id: 'legacy-b', pageId: page.id, type: 'custom-widget', order: 2, content: { nested: { keep: true } }, styles: {} },
  { id: 'legacy-hidden', pageId: page.id, type: 'offer', order: 1, content: { secret: 'hidden' }, styles: { visible: false } },
  { id: 'legacy-a', pageId: page.id, type: 'hero', order: 1, content: { title: 'Wash' }, styles: { color: 'blue' } }
];

function builderDocument(sectionOverrides: Array<Record<string, unknown>> = []): BuilderDocument {
  const sections = sectionOverrides.length ? sectionOverrides : [
    { id: 'revision-visible', page_id: page.id, type: 'hero', variant: 'standard', order: 1,
      content: { title: 'Published', custom: { keep: true } }, styles: { color: 'blue' } },
    { id: 'revision-hidden', page_id: page.id, type: 'offer', variant: 'banner', order: 2,
      content: { privateDraftCopy: 'never return' }, styles: { visible: false } }
  ];
  return {
    schemaVersion: 1,
    page: {
      id: page.id, user_id: 'owner-private', name: page.name, slug: page.slug,
      status: page.status as 'published', seo_title: page.seoTitle ?? '',
      seo_description: page.seoDescription ?? '', seo_keywords: [], created_at: '2026-01-01',
      ...(page.funnelId ? { funnel_id: page.funnelId } : {}), step_type: 'landing', step_order: 1
    },
    sections: sections as unknown as BuilderDocument['sections']
  };
}

function revisionFor(document = builderDocument()): PublicPublishedRevisionRecord {
  return {
    id: 'revision-1', websiteId: website.id, pageId: page.id, schemaVersion: 1,
    document, documentFingerprint: createBuilderDocumentFingerprint(document)
  };
}

class FakeDataSource implements PublicSiteDataSource {
  calls: string[] = [];
  website: PublicWebsiteRecord | null = { ...website };
  route: PublicWebsiteRouteRecord | null = { ...route };
  page: PublicPageRecord | null = { ...page };
  settings: PublicWebsiteSettingsRecord | null = structuredClone(settings);
  layout: PublicWebsiteLayoutRecord | null = structuredClone(layout);
  target: PublicPublicationTargetRecord | null = null;
  revision: PublicPublishedRevisionRecord | null = null;
  legacy: readonly PublicLegacySectionRecord[] = structuredClone(legacySections);
  failure: Error | null = null;

  private call(name: string): void {
    this.calls.push(name);
    if (this.failure) throw this.failure;
  }
  async findWebsiteByHost(): Promise<PublicWebsiteRecord | null> { this.call('website'); return this.website; }
  async findRouteForWebsite(): Promise<PublicWebsiteRouteRecord | null> { this.call('route'); return this.route; }
  async findPageForRoute(): Promise<PublicPageRecord | null> { this.call('page'); return this.page; }
  async getPublicWebsiteSettings(): Promise<PublicWebsiteSettingsRecord | null> { this.call('settings'); return this.settings; }
  async getPublicWebsiteLayout(): Promise<PublicWebsiteLayoutRecord | null> { this.call('layout'); return this.layout; }
  async getPublicationTarget(): Promise<PublicPublicationTargetRecord | null> { this.call('target'); return this.target; }
  async getRevisionById(): Promise<PublicPublishedRevisionRecord | null> { this.call('revision'); return this.revision; }
  async getLegacySections(): Promise<readonly PublicLegacySectionRecord[]> { this.call('legacy'); return this.legacy; }
}

function targetDataSource(): FakeDataSource {
  const source = new FakeDataSource();
  source.target = {
    websiteId: website.id, pageId: page.id, publishedRevisionId: 'revision-1',
    publishedAt: '2026-07-25T00:00:00Z'
  };
  source.revision = revisionFor();
  return source;
}

function request(path = '/', init?: RequestInit): Request {
  return new Request(`https://edge.example/functions/v1/public-site?host=clean.example.com&path=${encodeURIComponent(path)}`, init);
}

async function json(result: Response): Promise<Record<string, unknown>> {
  return await result.json() as Record<string, unknown>;
}

describe('public request normalization', () => {
  it.each([
    [' Example.COM ', false, 'example.com'],
    ['example.com:443', false, 'example.com'],
    ['example.com.', false, 'example.com'],
    ['example.com.:8443', false, 'example.com'],
    ['localhost:54321', true, 'localhost'],
    ['site.localhost', true, 'site.localhost'],
    ['127.0.0.1:8000', true, '127.0.0.1']
  ])('normalizes host case %#', (input, allowDevelopment, expected) => {
    expect(normalizePublicHost(input, allowDevelopment)).toBe(expected);
  });

  it.each([
    [null, false],
    ['', false],
    ['https://example.com', false],
    ['user@example.com', false],
    ['example.com/path', false],
    ['example.com?x=1', false],
    ['example.com#x', false],
    ['bad host.com', false],
    ['-bad.example.com', false],
    ['localhost', false],
    ['example.com:99999', false]
  ])('rejects invalid host %#', (input, allowDevelopment) => {
    expect(normalizePublicHost(input, allowDevelopment)).toBeNull();
  });

  it.each([
    [null, '/'],
    ['', '/'],
    [' /services/ ', '/services'],
    ['//services///wash//', '/services/wash'],
    ['/pressure%20washing', '/pressure washing'],
    ['/', '/']
  ])('normalizes path %#', (input, expected) => {
    expect(normalizePublicPath(input)).toBe(expected);
  });

  it.each([
    ['services'],
    ['https://example.com/services'],
    ['/services?draft=true'],
    ['/services#draft'],
    ['/../admin'],
    ['/./admin'],
    ['/%2e%2e/admin'],
    ['/bad%2fsegment'],
    ['/bad\\segment'],
    ['/bad%00segment'],
    ['/bad%zz']
  ])('rejects unsafe path %#', input => {
    expect(normalizePublicPath(input)).toBeNull();
  });
});

describe('public-site handler requests and resolution', () => {
  it('returns OPTIONS without database access', async () => {
    const source = new FakeDataSource();
    const result = await handlePublicSiteRequest(request('/', { method: 'OPTIONS' }), { dataSource: source });
    expect(result.status).toBe(204);
    expect(source.calls).toEqual([]);
  });

  it('accepts GET', async () => {
    expect((await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() })).status).toBe(200);
  });

  it('rejects POST with Allow header', async () => {
    const source = new FakeDataSource();
    const result = await handlePublicSiteRequest(request('/', { method: 'POST' }), { dataSource: source });
    expect(result.status).toBe(405);
    expect(result.headers.get('Allow')).toBe('GET, OPTIONS');
    expect(source.calls).toEqual([]);
  });

  it('rejects a missing host', async () => {
    const result = await handlePublicSiteRequest(new Request('https://edge.example/?path=/'), { dataSource: new FakeDataSource() });
    expect(result.status).toBe(400);
  });

  it('uses / when path is omitted', async () => {
    const source = new FakeDataSource();
    const result = await handlePublicSiteRequest(new Request('https://edge.example/?host=clean.example.com'), { dataSource: source });
    expect((await json(result)).requestedPath).toBe('/');
  });

  it('normalizes inputs before lookup', async () => {
    const source = new FakeDataSource();
    source.findWebsiteByHost = vi.fn(source.findWebsiteByHost.bind(source));
    source.findRouteForWebsite = vi.fn(source.findRouteForWebsite.bind(source));
    await handlePublicSiteRequest(new Request('https://edge.example/?host=%20CLEAN.EXAMPLE.COM%3A443%20&path=%2F%2F'), { dataSource: source });
    expect(source.findWebsiteByHost).toHaveBeenCalledWith('clean.example.com');
    expect(source.findRouteForWebsite).toHaveBeenCalledWith(website.id, '/');
  });

  it('does not mutate the request', async () => {
    const original = request();
    const url = original.url;
    await handlePublicSiteRequest(original, { dataSource: new FakeDataSource() });
    expect(original.url).toBe(url);
  });

  it('returns 404 for an unknown website', async () => {
    const source = new FakeDataSource(); source.website = null;
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
    expect(source.calls).toEqual(['website']);
  });

  it('returns 404 for an unknown route', async () => {
    const source = new FakeDataSource(); source.route = null;
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
  });

  it('enforces exact route website scope', async () => {
    const source = new FakeDataSource(); source.route = { ...route, websiteId: 'website-other' };
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
  });

  it('enforces homepage funnel scope', async () => {
    const source = new FakeDataSource(); source.route = { ...route, funnelId: 'funnel-other' };
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
  });

  it('resolves a homepage', async () => {
    const body = await json(await handlePublicSiteRequest(request('/'), { dataSource: new FakeDataSource() }));
    expect((body.page as Record<string, unknown>).path).toBe('/');
    expect((body.route as Record<string, unknown>).websiteId).toBe(website.id);
  });

  it('resolves an exact non-home route', async () => {
    const source = new FakeDataSource();
    source.route = { ...route, id: 'route-services', path: '/services' };
    source.page = { ...page, slug: 'services' };
    const result = await handlePublicSiteRequest(request('/services'), { dataSource: source });
    expect(result.status).toBe(200);
    expect((await json(result)).requestedPath).toBe('/services');
  });

  it('rejects a page from another funnel', async () => {
    const source = new FakeDataSource(); source.page = { ...page, funnelId: 'funnel-other' };
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
  });

  it('does not establish page scope from owner equality', async () => {
    const source = new FakeDataSource();
    source.page = { ...page, funnelId: 'funnel-other', user_id: 'same-owner' } as PublicPageRecord;
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
  });

  it('does not choose an arbitrary page when resolution returns none', async () => {
    const source = new FakeDataSource(); source.page = null;
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
    expect(source.calls).not.toContain('legacy');
  });
});

describe('revision-backed publication', () => {
  it('returns the selected revision', async () => {
    const body = await json(await handlePublicSiteRequest(request(), { dataSource: targetDataSource() }));
    expect((body.sections as Array<Record<string, unknown>>)[0].id).toBe('revision-visible');
    expect((body.publication as Record<string, unknown>).source).toBe('revision');
  });

  it('does not read legacy sections when a target is valid', async () => {
    const source = targetDataSource();
    await handlePublicSiteRequest(request(), { dataSource: source });
    expect(source.calls).not.toContain('legacy');
  });

  it('does not block a valid target for draft Page.status', async () => {
    const source = targetDataSource(); source.page = { ...page, status: 'draft' };
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(200);
  });

  it.each([
    ['cross-page', (source: FakeDataSource) => { source.revision = { ...source.revision!, pageId: 'other' }; }],
    ['cross-website', (source: FakeDataSource) => { source.revision = { ...source.revision!, websiteId: 'other' }; }],
    ['missing-revision', (source: FakeDataSource) => { source.revision = null; }],
    ['revision-schema', (source: FakeDataSource) => { source.revision = { ...source.revision!, schemaVersion: 2 }; }],
    ['document-schema', (source: FakeDataSource) => {
      source.revision = { ...source.revision!, document: { ...(source.revision!.document as object), schemaVersion: 2 } };
    }],
    ['malformed-document', (source: FakeDataSource) => { source.revision = { ...source.revision!, document: null }; }],
    ['bad-fingerprint', (source: FakeDataSource) => { source.revision = { ...source.revision!, documentFingerprint: 'bad' }; }]
  ])('fails closed for %s', async (_name, alter) => {
    const source = targetDataSource(); alter(source);
    const result = await handlePublicSiteRequest(request(), { dataSource: source });
    expect(result.status).toBe(503);
    expect(source.calls).not.toContain('legacy');
    expect(await result.text()).not.toContain('revision-1');
  });

  it('fails closed for a cross-scoped target', async () => {
    const source = targetDataSource(); source.target = { ...source.target!, pageId: 'other' };
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(503);
    expect(source.calls).not.toContain('legacy');
  });

  it('does not query publication history', async () => {
    const source = targetDataSource();
    await handlePublicSiteRequest(request(), { dataSource: source });
    expect(source.calls).toEqual(['website', 'route', 'page', 'settings', 'layout', 'target', 'revision']);
  });
});

describe('legacy fallback and sanitization', () => {
  it('uses legacy sections only with no target and published page', async () => {
    const source = new FakeDataSource();
    const body = await json(await handlePublicSiteRequest(request(), { dataSource: source }));
    expect((body.publication as Record<string, unknown>).source).toBe('legacy');
    expect(source.calls).toContain('legacy');
  });

  it('returns 404 for a draft legacy page', async () => {
    const source = new FakeDataSource(); source.page = { ...page, status: 'draft' };
    expect((await handlePublicSiteRequest(request(), { dataSource: source })).status).toBe(404);
    expect(source.calls).not.toContain('legacy');
  });

  it('orders legacy sections deterministically and stably', async () => {
    const body = await json(await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() }));
    expect((body.sections as Array<Record<string, unknown>>).map(section => section.id)).toEqual(['legacy-a', 'legacy-b']);
  });

  it('omits hidden legacy sections', async () => {
    const text = await (await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() })).text();
    expect(text).not.toContain('legacy-hidden');
    expect(text).not.toContain('hidden');
  });

  it('preserves visible custom types and nested content', async () => {
    const body = await json(await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() }));
    const custom = (body.sections as Array<Record<string, unknown>>).find(section => section.type === 'custom-widget');
    expect(custom?.content).toEqual({ nested: { keep: true } });
  });

  it('has no revision or target creation operation', () => {
    const source = new FakeDataSource() as unknown as Record<string, unknown>;
    expect('createRevision' in source).toBe(false);
    expect('createTarget' in source).toBe(false);
  });

  it('does not return website ownership or unrelated fields', async () => {
    const source = new FakeDataSource();
    source.website = { ...website, user_id: 'owner-private', random: 'omit' } as PublicWebsiteRecord;
    const text = await (await handlePublicSiteRequest(request(), { dataSource: source })).text();
    expect(text).not.toContain('owner-private');
    expect(text).not.toContain('random');
  });

  it('does not return page ownership', async () => {
    const source = new FakeDataSource(); source.page = { ...page, user_id: 'owner-private' } as PublicPageRecord;
    expect(await (await handlePublicSiteRequest(request(), { dataSource: source })).text()).not.toContain('owner-private');
  });

  it('does not return section ownership', async () => {
    const source = new FakeDataSource(); source.legacy = [{ ...legacySections[2], user_id: 'owner-private' } as PublicLegacySectionRecord];
    expect(await (await handlePublicSiteRequest(request(), { dataSource: source })).text()).not.toContain('owner-private');
  });

  it('does not return build briefs or private settings', async () => {
    const text = await (await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() })).text();
    expect(text).not.toContain('private');
    expect(text).not.toContain('build_brief');
  });

  it('allowlists layout fields', async () => {
    const text = await (await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() })).text();
    expect(text).not.toContain('private_admin_link');
    expect(text).not.toContain('secret');
  });

  it('omits hidden revision sections and audit identities', async () => {
    const source = targetDataSource();
    source.revision = { ...source.revision!, created_by: 'creator-private', published_by: 'publisher-private' } as PublicPublishedRevisionRecord;
    const text = await (await handlePublicSiteRequest(request(), { dataSource: source })).text();
    expect(text).not.toContain('revision-hidden');
    expect(text).not.toContain('creator-private');
    expect(text).not.toContain('publisher-private');
    expect(text).not.toContain('owner-private');
  });

  it('does not expose revision history', async () => {
    const body = await json(await handlePublicSiteRequest(request(), { dataSource: targetDataSource() }));
    expect(body).not.toHaveProperty('revisions');
    expect(body).not.toHaveProperty('history');
  });

  it('does not mutate source rows or documents', async () => {
    const source = targetDataSource();
    const before = structuredClone({
      website: source.website, page: source.page, settings: source.settings,
      layout: source.layout, target: source.target, revision: source.revision, legacy: source.legacy
    });
    await handlePublicSiteRequest(request(), { dataSource: source });
    expect({
      website: source.website, page: source.page, settings: source.settings,
      layout: source.layout, target: source.target, revision: source.revision, legacy: source.legacy
    }).toEqual(before);
  });
});

describe('caching, CORS, and failures', () => {
  it('includes public CORS and JSON security headers', async () => {
    const result = await handlePublicSiteRequest(request(), { dataSource: targetDataSource() });
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(result.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(result.headers.get('Content-Type')).toContain('application/json');
  });

  it('includes a quoted ETag for revisions', async () => {
    const etag = (await handlePublicSiteRequest(request(), { dataSource: targetDataSource() })).headers.get('ETag');
    expect(etag).toMatch(/^"ps-/);
  });

  it('returns 304 for a matching ETag', async () => {
    const source = targetDataSource();
    const first = await handlePublicSiteRequest(request(), { dataSource: source });
    const second = await handlePublicSiteRequest(request('/', { headers: { 'If-None-Match': first.headers.get('ETag')! } }), { dataSource: targetDataSource() });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('does not serialize the payload for a 304', async () => {
    const first = await handlePublicSiteRequest(request(), { dataSource: targetDataSource() });
    const serialize = vi.fn(JSON.stringify);
    const second = await handlePublicSiteRequest(
      request('/', { headers: { 'If-None-Match': first.headers.get('ETag')! } }),
      { dataSource: targetDataSource(), serializePayload: serialize }
    );
    expect(second.status).toBe(304);
    expect(serialize).not.toHaveBeenCalled();
  });

  it('produces deterministic legacy ETags', async () => {
    const first = await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() });
    const second = await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource() });
    expect(first.headers.get('ETag')).toBe(second.headers.get('ETag'));
  });

  it('changes ETag when visible payload changes', async () => {
    const source = targetDataSource();
    const first = await handlePublicSiteRequest(request(), { dataSource: source });
    const changed = builderDocument([
      { id: 'revision-visible', page_id: page.id, type: 'hero', order: 1, content: { title: 'Changed' }, styles: {} }
    ]);
    const secondSource = targetDataSource(); secondSource.revision = revisionFor(changed);
    const second = await handlePublicSiteRequest(request(), { dataSource: secondSource });
    expect(first.headers.get('ETag')).not.toBe(second.headers.get('ETag'));
  });

  it('does not change ETag for hidden-only content changes', async () => {
    const first = await handlePublicSiteRequest(request(), { dataSource: targetDataSource() });
    const changed = builderDocument([
      { id: 'revision-visible', page_id: page.id, type: 'hero', variant: 'standard', order: 1,
        content: { title: 'Published', custom: { keep: true } }, styles: { color: 'blue' } },
      { id: 'revision-hidden', page_id: page.id, type: 'offer', variant: 'banner', order: 2,
        content: { privateDraftCopy: 'different hidden content' }, styles: { visible: false } }
    ]);
    const source = targetDataSource(); source.revision = revisionFor(changed);
    const second = await handlePublicSiteRequest(request(), { dataSource: source });
    expect(first.headers.get('ETag')).toBe(second.headers.get('ETag'));
  });

  it.each([
    ['missing host', new Request('https://edge.example/?path=/'), 400],
    ['unknown site', request(), 404],
    ['missing configuration', request(), 503]
  ])('uses no-store for %s errors', async (name, req, status) => {
    const source = new FakeDataSource();
    if (name === 'unknown site') source.website = null;
    const result = await handlePublicSiteRequest(req, {
      dataSource: source,
      ...(name === 'missing configuration' ? { configurationAvailable: false } : {})
    });
    expect(result.status).toBe(status);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });

  it('maps missing server configuration to sanitized 503', async () => {
    const result = await handlePublicSiteRequest(request(), { dataSource: new FakeDataSource(), configurationAvailable: false });
    expect(result.status).toBe(503);
    expect(await result.text()).toContain('Public-site service is unavailable.');
  });

  it('maps data-source failures to sanitized 500', async () => {
    const source = new FakeDataSource(); source.failure = new PublicSiteDataSourceError('private-database-detail');
    const result = await handlePublicSiteRequest(request(), { dataSource: source });
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain('private-database-detail');
  });

  it('maps broken target to sanitized 503', async () => {
    const source = targetDataSource(); source.revision = null;
    const result = await handlePublicSiteRequest(request(), { dataSource: source });
    expect(result.status).toBe(503);
    expect(await result.text()).toBe(JSON.stringify({ error: 'This page is temporarily unavailable.' }));
  });

  it('logs only safe request metadata and an internal code', async () => {
    const events: PublicSiteLogEvent[] = [];
    const source = targetDataSource(); source.revision = null;
    await handlePublicSiteRequest(request(), {
      dataSource: source,
      requestIdFactory: () => 'request-1',
      logger: { info: event => events.push(event), error: event => events.push(event) }
    });
    const serialized = JSON.stringify(events);
    expect(serialized).toContain('request-1');
    expect(serialized).not.toContain('privateDraftCopy');
    expect(serialized).not.toContain('Published');
    expect(serialized).not.toContain('service-role');
  });

  it('exposes no write operation on the data-source contract implementation', () => {
    const names = Object.getOwnPropertyNames(FakeDataSource.prototype);
    expect(names.some(name => /^(create|insert|update|delete|upsert|write)/i.test(name))).toBe(false);
  });
});
