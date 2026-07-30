import { describe, expect, it, vi } from 'vitest';
import { createWebsiteGenerationHandler } from './website_generation_handler';

const endpoint = 'https://example.test/api/websites/generate';
const body = { business_name: 'Acme', phone_number: '(555) 123-4567', city: 'Austin', services: ['Wash'] };
const success = { success: true, data: {
  website: { id: 'w', user_id: 'u', name: 'Acme', domain: null, subdomain: 'acme-u', homepage_funnel_id: 'f', created_at: 'now', updated_at: 'now' },
  settings: { id: 's', user_id: 'u', website_id: 'w', business_name: 'Acme', phone: '5551234567', email: '', logo_url: '', primary_color: '#2563eb', auto_lead_sms_enabled: true, auto_lead_sms_template: '', missed_call_sms_enabled: true, missed_call_sms_template: '', created_at: 'now' },
  route: { id: 'r', website_id: 'w', path: '/', funnel_id: 'f', created_at: 'now' },
  funnel: { id: 'f', user_id: 'u', name: 'Home', status: 'draft', created_at: 'now', updated_at: 'now' },
  page: { id: 'p', user_id: 'u', name: 'Home', slug: 'home', status: 'draft', seo_title: 'Acme', seo_description: 'Acme', seo_keywords: ['Wash'], created_at: 'now', funnel_id: 'f' },
  sections: [{ id: 'section', page_id: 'p', type: 'hero', content: {}, order: 0, styles: {} }], created: true, idempotency_key: 'website-create:1234567890'
} };
const request = (options: { method?: string; token?: boolean; key?: string; contentType?: string; raw?: string; value?: unknown } = {}) => new Request(endpoint, {
  method: options.method ?? 'POST',
  headers: {
    ...(options.token === false ? {} : { Authorization: 'Bearer token' }),
    'Content-Type': options.contentType ?? 'application/json',
    'Idempotency-Key': options.key ?? 'website-create:1234567890'
  },
  ...((options.method ?? 'POST') === 'POST' ? { body: options.raw ?? JSON.stringify(options.value ?? body) } : {})
});
const dependencies = (rpc: { data: unknown; error: null | { code?: string } } = { data: success, error: null }, authenticated = true) => {
  const getUser = vi.fn(async () => ({ data: { user: authenticated ? { id: 'u' } : null }, error: authenticated ? null : { message: 'bad' } }));
  const rpcCall = vi.fn(async () => rpc);
  return { getUser, rpcCall, options: { env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable' }, createSupabase: () => ({ auth: { getUser }, rpc: rpcCall } as never) } };
};

describe('website generation Vercel handler', () => {
  it('rejects non-POST methods with Allow', async () => {
    const response = await createWebsiteGenerationHandler()(request({ method: 'GET' }));
    expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('POST');
  });
  it('always returns JSON errors', async () => expect((await createWebsiteGenerationHandler()(request({ method: 'GET' }))).headers.get('content-type')).toContain('application/json'));
  it('requires application/json', async () => expect((await createWebsiteGenerationHandler()(request({ contentType: 'text/plain' }))).status).toBe(400));
  it('rejects malformed JSON', async () => expect((await createWebsiteGenerationHandler()(request({ raw: '{' }))).status).toBe(400));
  it('rejects missing idempotency', async () => expect((await createWebsiteGenerationHandler()(request({ key: '' }))).status).toBe(400));
  it('rejects unknown input fields', async () => expect((await createWebsiteGenerationHandler()(request({ value: { ...body, role: 'admin' } }))).status).toBe(422));
  it('requires bearer auth', async () => expect((await createWebsiteGenerationHandler()(request({ token: false }))).status).toBe(401));
  it('shows missing server configuration', async () => expect((await createWebsiteGenerationHandler({ env: {} })(request())).status).toBe(503));
  it('verifies the token server-side', async () => {
    const dep = dependencies(); await createWebsiteGenerationHandler(dep.options)(request()); expect(dep.getUser).toHaveBeenCalledWith('token');
  });
  it('rejects invalid sessions', async () => {
    const dep = dependencies(undefined, false); expect((await createWebsiteGenerationHandler(dep.options)(request())).status).toBe(401);
  });
  it('passes normalized data and the idempotency key to one RPC', async () => {
    const dep = dependencies(); await createWebsiteGenerationHandler(dep.options)(request({ value: { ...body, business_name: ' Acme  Wash ' } }));
    expect(dep.rpcCall).toHaveBeenCalledTimes(1);
    expect(dep.rpcCall).toHaveBeenCalledWith('create_initial_website_graph', expect.objectContaining({ p_business_name: 'Acme Wash', p_idempotency_key: 'website-create:1234567890' }));
  });
  it('returns 201 for a newly created graph', async () => {
    const dep = dependencies(); expect((await createWebsiteGenerationHandler(dep.options)(request())).status).toBe(201);
  });
  it('returns 200 for an idempotent existing graph', async () => {
    const dep = dependencies({ data: { ...success, data: { ...success.data, created: false } }, error: null });
    expect((await createWebsiteGenerationHandler(dep.options)(request())).status).toBe(200);
  });
  it('maps uniqueness to a sanitized conflict', async () => {
    const dep = dependencies({ data: null, error: { code: '23505' } }); const response = await createWebsiteGenerationHandler(dep.options)(request());
    expect(response.status).toBe(409); expect(await response.text()).not.toContain('23505');
  });
  it('sanitizes upstream database errors', async () => {
    const dep = dependencies({ data: null, error: { code: 'XX000' } }); const response = await createWebsiteGenerationHandler(dep.options)(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('XX000');
  });
  it('rejects invalid RPC response schemas', async () => {
    const dep = dependencies({ data: { success: true }, error: null }); expect((await createWebsiteGenerationHandler(dep.options)(request())).status).toBe(502);
  });
  it('sets no-store and nosniff headers', async () => {
    const dep = dependencies(); const response = await createWebsiteGenerationHandler(dep.options)(request());
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
