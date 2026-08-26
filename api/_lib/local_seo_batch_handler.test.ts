import { describe, expect, it } from 'vitest';
import { createLocalSeoBatchHandler, createLocalSeoInventoryHandler } from './local_seo_batch_handler';

const website_id = '11111111-1111-4111-8111-111111111111';
const key = 'local-seo:1234567890';
const response = { success: true as const, data: { website_id, created_count: 1, replayed: false, pages: [{ service: 'Wash', city: 'City', path: '/wash-city', funnel_id: 'fnl-1', page_id: 'pg-1' }] } };
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://app.test/api/websites/bulk-seo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...headers }, body: JSON.stringify(body) });
const deps = (data: unknown, error: any = null) => ({ env: { SUPABASE_URL: 'https://db.test', SUPABASE_PUBLISHABLE_KEY: 'key' }, createSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) }, rpc: async () => ({ data, error }) }) as any });

describe('Local SEO batch API', () => {
  it('requires POST, JSON, idempotency, and bearer auth', async () => {
    const handler = createLocalSeoBatchHandler(deps({}));
    expect((await handler(new Request('https://app.test', { method: 'GET' }))).status).toBe(405);
    expect((await handler(request({ website_id, services: ['Wash'], cities: ['City'] }))).status).toBe(401);
  });
  it('passes only validated explicit Website input to the authoritative RPC', async () => {
    let args: any; const handler = createLocalSeoBatchHandler({ ...deps(response), createSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) }, rpc: async (_: string, value: any) => { args = value; return { data: response, error: null }; } }) as any });
    expect((await handler(request({ website_id, services: [' Wash '], cities: [' City '] }, { Authorization: 'Bearer token' }))).status).toBe(200);
    expect(args).toMatchObject({ p_website_id: website_id, p_services: ['Wash'], p_cities: ['City'], p_idempotency_key: key });
  });
  it('maps ownership and collision failures without database details', async () => {
    const handler = createLocalSeoBatchHandler(deps(null, { code: 'PT404', message: 'private detail' }));
    expect((await handler(request({ website_id, services: ['Wash'], cities: ['City'] }, { Authorization: 'Bearer token' }))).status).toBe(404);
  });
  it('rejects malformed or wrong-Website RPC success responses', async () => {
    const malformed = await createLocalSeoBatchHandler(deps({ success: true, data: { website_id, created_count: 1, replayed: false, pages: [null] } }))(request({ website_id, services: ['Wash'], cities: ['City'] }, { Authorization: 'Bearer token' }));
    expect(malformed.status).toBe(503);
    const wrong = await createLocalSeoBatchHandler(deps({ ...response, data: { ...response.data, website_id: '22222222-2222-4222-8222-222222222222' } }))(request({ website_id, services: ['Wash'], cities: ['City'] }, { Authorization: 'Bearer token' }));
    expect(wrong.status).toBe(503);
  });
});

describe('Local SEO inventory API', () => {
  const inventory = { success: true as const, data: { website_id, pages: [{ website_id, funnel_id: 'fnl-1', page_id: 'pg-1', service: 'Wash', city: 'City', path: '/wash-city', publication_state: 'draft' as const }] } };
  const request = (id = website_id, token = true) => new Request(`https://app.test/api/websites/local-seo?website_id=${id}`, { headers: token ? { Authorization: 'Bearer token' } : {} });
  it('requires GET, valid Website selection, and authentication', async () => {
    const handler = createLocalSeoInventoryHandler(deps(inventory));
    expect((await handler(new Request('https://app.test/api/websites/local-seo', { method: 'POST' }))).status).toBe(405);
    expect((await handler(request('bad'))).status).toBe(400); expect((await handler(request(website_id, false))).status).toBe(401);
  });
  it('uses the authenticated inventory RPC and rejects foreign/malformed results', async () => {
    let args: any; const handler = createLocalSeoInventoryHandler({ ...deps(inventory), createSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) }, rpc: async (_: string, value: any) => { args = value; return { data: inventory, error: null }; } }) as any });
    expect((await handler(request())).status).toBe(200); expect(args).toEqual({ p_website_id: website_id });
    expect((await createLocalSeoInventoryHandler(deps({ ...inventory, data: { ...inventory.data, website_id: '22222222-2222-4222-8222-222222222222' } }))(request())).status).toBe(503);
    expect((await createLocalSeoInventoryHandler(deps(null, { code: 'PT404' }))(request())).status).toBe(404);
  });
});
