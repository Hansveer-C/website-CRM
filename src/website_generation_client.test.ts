import { describe, expect, it, vi } from 'vitest';
import { WebsiteGenerationClient, WebsiteGenerationClientError, createWebsiteGenerationIdempotencyKey } from './website_generation_client';

const input = { business_name: 'Acme', phone_number: '(555) 123-4567', city: 'Austin', services: ['Wash'] };
const key = 'website-create:1234567890';
const successEnvelope = () => ({ success: true, data: {
  website: { id: 'w', user_id: 'u', name: 'Acme', domain: null, subdomain: 'acme-u', homepage_funnel_id: 'f', created_at: 'now', updated_at: 'now' },
  settings: { id: 's', user_id: 'u', website_id: 'w', business_name: 'Acme', phone: '5551234567', email: '', logo_url: '', primary_color: '#2563eb', auto_lead_sms_enabled: true, auto_lead_sms_template: '', missed_call_sms_enabled: true, missed_call_sms_template: '', created_at: 'now' },
  route: { id: 'r', website_id: 'w', path: '/', funnel_id: 'f', created_at: 'now' },
  funnel: { id: 'f', user_id: 'u', name: 'Home', status: 'draft', created_at: 'now', updated_at: 'now' },
  page: { id: 'p', user_id: 'u', name: 'Home', slug: 'home', status: 'draft', seo_title: 'Acme', seo_description: 'Acme', seo_keywords: ['Wash'], created_at: 'now', funnel_id: 'f' },
  sections: [{ id: 'section', page_id: 'p', type: 'hero', content: {}, order: 0, styles: {} }], created: true, idempotency_key: key
} });
const json = (body: unknown, status = 200, contentType = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
const client = (response: Response | Error, token: string | null = 'token') => new WebsiteGenerationClient({
  auth: { getAccessToken: vi.fn(async () => token) },
  fetch: vi.fn(async () => { if (response instanceof Error) throw response; return response; })
});

describe('WebsiteGenerationClient', () => {
  it('returns validated graph data', async () => expect(client(json(successEnvelope())).generate(input, key)).resolves.toMatchObject({ website: { id: 'w' } }));
  it('sends bearer auth and idempotency', async () => {
    const request = vi.fn(async () => json(successEnvelope()));
    await new WebsiteGenerationClient({ auth: { getAccessToken: async () => 'secret-token' }, fetch: request }).generate(input, key);
    expect(request).toHaveBeenCalledWith('/api/websites/generate', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer secret-token', 'Idempotency-Key': key }) }));
  });
  it('binds the native fetch receiver in production', async () => {
    const request = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(json(successEnvelope()));
    });
    vi.stubGlobal('fetch', request);
    try {
      const productionClient = new WebsiteGenerationClient({ auth: { getAccessToken: async () => 'token' } });
      await expect(productionClient.generate(input, key)).resolves.toMatchObject({ website: { id: 'w' } });
      expect(request).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('fails before fetch without auth', async () => expect(client(json(successEnvelope()), null).generate(input, key)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' }));
  it('classifies transport failures as retryable', async () => expect(client(new Error('offline')).generate(input, key)).rejects.toMatchObject({ code: 'TRANSPORT_ERROR', retryable: true }));
  it('rejects HTML responses', async () => expect(client(new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } })).generate(input, key)).rejects.toMatchObject({ code: 'UNEXPECTED_CONTENT_TYPE' }));
  it('rejects empty responses', async () => expect(client(new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } })).generate(input, key)).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' }));
  it('rejects malformed JSON', async () => expect(client(new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } })).generate(input, key)).rejects.toMatchObject({ code: 'MALFORMED_JSON' }));
  it('rejects schema-invalid JSON', async () => expect(client(json({ success: true })).generate(input, key)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' }));
  it('surfaces conflict messages', async () => expect(client(json({ success: false, error: { code: 'CONFLICT', message: 'Refresh.' } }, 409)).generate(input, key)).rejects.toMatchObject({ code: 'CONFLICT', status: 409, message: 'Refresh.' }));
  it('marks 503 responses retryable', async () => expect(client(json({ success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Retry.' } }, 503)).generate(input, key)).rejects.toMatchObject({ retryable: true }));
  it.each([
    [401, 'UNAUTHENTICATED'], [403, 'UNAUTHORIZED'], [422, 'VALIDATION_ERROR'], [429, 'RATE_LIMITED'], [500, 'SERVER_ERROR']
  ])('classifies HTTP %s', async (status, code) => {
    await expect(client(json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failure.' } }, status)).generate(input, key)).rejects.toMatchObject({ code });
  });
  it('aborts and classifies timeouts', async () => {
    const request = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const timed = new WebsiteGenerationClient({ auth: { getAccessToken: async () => 'token' }, fetch: request, timeoutMs: 5 });
    await expect(timed.generate(input, key)).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT', retryable: true });
    expect((request.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  });
  it('creates prefixed request keys', () => expect(createWebsiteGenerationIdempotencyKey(() => 'uuid')).toBe('website-create:uuid'));
  it('uses a dedicated error class', () => expect(new WebsiteGenerationClientError('SERVER_ERROR', 'x')).toBeInstanceOf(Error));
});
