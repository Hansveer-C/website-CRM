import { describe, expect, it, vi } from 'vitest';
import { createBuilderDocumentFingerprint } from '../../../src/builder_publication';
import type { BuilderDocument } from '../../../src/builder_document';
import type { PublicLeadCreateInput, PublicLeadCreateResult } from './public_lead_contract';
import type { PublicLeadDataSource } from './public_lead_data_source';
import {
  createPublicLeadHmac,
  createPublicLeadRequestFingerprint,
  handlePublicLeadRequest,
  type PublicLeadLogEvent
} from './public_lead_handler';
import type {
  PublicLegacySectionRecord, PublicPageRecord, PublicPublicationTargetRecord,
  PublicPublishedRevisionRecord, PublicWebsiteLayoutRecord, PublicWebsiteRecord,
  PublicWebsiteRouteRecord, PublicWebsiteSettingsRecord
} from './public_site_data_source';

const SECRET = 'a-secure-test-only-hash-secret-that-is-long-enough';
const website: PublicWebsiteRecord = {
  id: '11111111-1111-4111-8111-111111111111', ownerId: 'owner-1', name: 'Clean Co',
  domain: 'clean.example.com', subdomain: 'clean', homepageFunnelId: 'funnel-1'
};
const route: PublicWebsiteRouteRecord = {
  id: 'route-1', websiteId: website.id, path: '/', funnelId: 'funnel-1'
};
const page: PublicPageRecord = {
  id: 'page-1', ownerId: 'owner-1', name: 'Home', slug: 'home', status: 'published',
  seoTitle: null, seoDescription: null, seoKeywords: null, funnelId: 'funnel-1', stepOrder: 1
};
const form: PublicLegacySectionRecord = {
  id: 'form-1', pageId: page.id, type: 'form', order: 1,
  content: { fields: ['name', 'phone'] }, styles: { visible: true }
};

class FakeSource implements PublicLeadDataSource {
  website: PublicWebsiteRecord | null = { ...website };
  route: PublicWebsiteRouteRecord | null = { ...route };
  page: PublicPageRecord | null = { ...page };
  target: PublicPublicationTargetRecord | null = null;
  revision: PublicPublishedRevisionRecord | null = null;
  legacy: readonly PublicLegacySectionRecord[] = [structuredClone(form)];
  createResult: PublicLeadCreateResult = { outcome: 'accepted', replayed: false };
  createCalls: PublicLeadCreateInput[] = [];
  calls: string[] = [];
  async findWebsiteByHost(): Promise<PublicWebsiteRecord | null> { this.calls.push('website'); return this.website; }
  async findRouteForWebsite(): Promise<PublicWebsiteRouteRecord | null> { this.calls.push('route'); return this.route; }
  async findPageForRoute(): Promise<PublicPageRecord | null> { this.calls.push('page'); return this.page; }
  async getPublicWebsiteSettings(): Promise<PublicWebsiteSettingsRecord | null> { return null; }
  async getPublicWebsiteLayout(): Promise<PublicWebsiteLayoutRecord | null> { return null; }
  async getPublicationTarget(): Promise<PublicPublicationTargetRecord | null> { this.calls.push('target'); return this.target; }
  async getRevisionById(): Promise<PublicPublishedRevisionRecord | null> { this.calls.push('revision'); return this.revision; }
  async getLegacySections(): Promise<readonly PublicLegacySectionRecord[]> { this.calls.push('legacy'); return this.legacy; }
  async createLead(input: PublicLeadCreateInput): Promise<PublicLeadCreateResult> {
    this.calls.push('create'); this.createCalls.push(structuredClone(input)); return this.createResult;
  }
}

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    host: ' CLEAN.EXAMPLE.COM:443 ', path: '//', formSectionId: 'form-1',
    idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    fields: { name: "O'Connor & Sons", phone: '+1 (604) 555-0100' }, honeypot: '',
    ...overrides
  };
}

function request(value: unknown = body(), init: RequestInit = {}): Request {
  return new Request('https://edge.test/functions/v1/public-lead', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.5', ...init.headers },
    body: typeof value === 'string' ? value : JSON.stringify(value), ...init
  });
}

async function run(source = new FakeSource(), req = request(), extra: Record<string, unknown> = {}): Promise<Response> {
  return handlePublicLeadRequest(req, {
    dataSource: source, hashSecret: SECRET, requestIdFactory: () => 'request-1', ...extra
  });
}

function revisionDocument(section = form): BuilderDocument {
  return {
    schemaVersion: 1,
    page: {
      id: page.id, user_id: page.ownerId, name: page.name, slug: page.slug, status: 'published',
      seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-01', funnel_id: 'funnel-1'
    },
    sections: [{
      id: section.id, page_id: section.pageId, type: section.type, order: section.order,
      content: structuredClone(section.content), styles: structuredClone(section.styles)
    }]
  };
}

function targetSource(section = form): FakeSource {
  const source = new FakeSource();
  const document = revisionDocument(section);
  source.target = { websiteId: website.id, pageId: page.id, publishedRevisionId: '22222222-2222-4222-8222-222222222222', publishedAt: null };
  source.revision = {
    id: source.target.publishedRevisionId, websiteId: website.id, pageId: page.id,
    schemaVersion: 1, document, documentFingerprint: createBuilderDocumentFingerprint(document)
  };
  return source;
}

describe('public lead request boundary', () => {
  it('handles OPTIONS without data access and rejects other methods', async () => {
    const source = new FakeSource();
    const options = await run(source, new Request('https://edge.test', { method: 'OPTIONS' }));
    expect(options.status).toBe(204);
    expect(source.calls).toEqual([]);
    const get = await run(source, new Request('https://edge.test', { method: 'GET' }));
    expect(get.status).toBe(405);
    expect(get.headers.get('Allow')).toBe('POST, OPTIONS');
  });

  it.each([
    [request(body(), { headers: { 'Content-Type': 'text/plain' } }), 415],
    [request('{'), 400],
    [request(body({ host: '' })), 400],
    [request(body({ host: 'https://evil.test' })), 400],
    [request(body({ formSectionId: '' })), 400],
    [request(body({ idempotencyKey: 'bad' })), 400],
    [request(body({ userId: 'attacker' })), 400],
    [request(body({ fields: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`f${i}`, 'x'])) })), 400]
  ])('rejects malformed request %#', async (req, status) => expect((await run(new FakeSource(), req as Request)).status).toBe(status));

  it('rejects an oversized body', async () => {
    expect((await run(new FakeSource(), request('x'.repeat(33 * 1024)))).status).toBe(413);
  });

  it('normalizes host/path, preserves punctuation, hashes IP, and does not mutate input', async () => {
    const source = new FakeSource();
    const input = body();
    const before = structuredClone(input);
    const result = await run(source, request(input));
    expect(result.status).toBe(201);
    expect(input).toEqual(before);
    expect(source.createCalls[0].fields.name).toBe("O'Connor & Sons");
    expect(source.createCalls[0].ipHash).toMatch(/^hmac-sha256:/);
    expect(source.createCalls[0]).toMatchObject({ ownerId: 'owner-1', routeFunnelId: 'funnel-1' });
  });

  it.each(['website', 'route', 'page'])('returns 404 for unresolved %s', async missing => {
    const source = new FakeSource();
    (source as unknown as Record<string, unknown>)[missing] = null;
    expect((await run(source)).status).toBe(404);
  });

  it('rejects cross-owner page scope', async () => {
    const source = new FakeSource();
    source.page = { ...page, ownerId: 'owner-2' };
    expect((await run(source)).status).toBe(404);
  });

  it.each([
    [{ ...form, id: 'other' }, 404],
    [{ ...form, type: 'hero' }, 404],
    [{ ...form, styles: { visible: false } }, 404]
  ])('rejects missing, non-form, and hidden legacy sections', async (section, status) => {
    const source = new FakeSource(); source.legacy = [section as PublicLegacySectionRecord];
    expect((await run(source)).status).toBe(status);
  });

  it('requires published legacy pages', async () => {
    const source = new FakeSource(); source.page = { ...page, status: 'draft' };
    expect((await run(source)).status).toBe(404);
  });

  it('uses the selected revision and never mutable legacy sections', async () => {
    const source = targetSource();
    source.legacy = [{ ...form, type: 'hero' }];
    expect((await run(source)).status).toBe(201);
    expect(source.calls).not.toContain('legacy');
  });

  it('fails closed for a broken target', async () => {
    const source = targetSource();
    if (source.revision) source.revision = { ...source.revision, documentFingerprint: 'changed' };
    expect((await run(source)).status).toBe(503);
    expect(source.calls).not.toContain('legacy');
  });

  it.each([
    [{ name: '', phone: '+1 604 555 0100' }, 400],
    [{ name: 'Person', phone: '123' }, 400],
    [{ name: 'Person', phone: '+1 604 555 0100', extra: 'protected' }, 400],
    [{ name: { nested: true }, phone: '+1 604 555 0100' }, 400],
    [{ name: 'x'.repeat(151), phone: '+1 604 555 0100' }, 400]
  ])('enforces trusted field schema %#', async (fields, status) => {
    expect((await run(new FakeSource(), request(body({ fields })))).status).toBe(status);
  });

  it('validates select options, email, consent, and ordinary HTML as inert text', async () => {
    const source = new FakeSource();
    source.legacy = [{ ...form, content: { fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'service_type', type: 'select', required: true, options: ['House Washing'] },
      { name: 'consent', type: 'boolean', required: true },
      { name: 'message', type: 'textarea' }
    ] } }];
    expect((await run(source, request(body({ fields: {
      name: '<b>Anne</b>', email: 'Anne@Example.COM', service_type: 'House Washing', consent: true, message: 'Use <script> as plain text'
    } })))).status).toBe(201);
    expect(source.createCalls[0].fields.email).toBe('Anne@example.com');
    expect(source.createCalls[0].fields.message).toContain('<script>');
    expect((await run(source, request(body({ idempotencyKey: '650e8400-e29b-41d4-a716-446655440000', fields: {
      name: 'Anne', email: 'bad', service_type: 'Other', consent: false
    } })))).status).toBe(400);
  });

  it('discards honeypot submissions without creating a lead', async () => {
    const source = new FakeSource();
    expect((await run(source, request(body({ honeypot: 'filled' })))).status).toBe(202);
    expect(source.createCalls).toHaveLength(0);
  });

  it.each([
    [{ outcome: 'accepted', replayed: true }, 200],
    [{ outcome: 'conflict' }, 409],
    [{ outcome: 'rate_limited', retryAfterSeconds: 321 }, 429],
    [{ outcome: 'routing_unavailable' }, 503]
  ] satisfies Array<[PublicLeadCreateResult, number]>)('maps database outcome %#', async (createResult, status) => {
    const source = new FakeSource(); source.createResult = createResult;
    const result = await run(source);
    expect(result.status).toBe(status);
    if (status === 429) expect(result.headers.get('Retry-After')).toBe('321');
    expect(JSON.stringify(await result.json())).not.toMatch(/contactId|opportunityId|owner-1|fingerprint|hmac/i);
  });

  it('sanitizes errors and logs no PII or secrets', async () => {
    const source = new FakeSource();
    source.createLead = async () => { throw new Error('database phone +1 604 555 0100'); };
    const events: PublicLeadLogEvent[] = [];
    const result = await run(source, request(), { logger: { info: vi.fn(), error: (event: PublicLeadLogEvent) => events.push(event) } });
    expect(result.status).toBe(500);
    const serialized = JSON.stringify([await result.json(), events]);
    expect(serialized).not.toContain('604');
    expect(serialized).not.toContain(SECRET);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });

  it('fails sanitized when server configuration is missing', async () => {
    expect((await handlePublicLeadRequest(request(), {
      dataSource: new FakeSource(), hashSecret: '', configurationAvailable: false
    })).status).toBe(503);
  });

  it('produces deterministic fingerprints and keyed hashes', async () => {
    expect(await createPublicLeadRequestFingerprint({ b: 2, a: 1 }))
      .toBe(await createPublicLeadRequestFingerprint({ a: 1, b: 2 }));
    expect(await createPublicLeadHmac(SECRET, '203.0.113.5'))
      .toBe(await createPublicLeadHmac(SECRET, '203.0.113.5'));
    expect(await createPublicLeadHmac(SECRET, '203.0.113.5')).not.toContain('203.0.113.5');
  });
});
