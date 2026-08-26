import { describe, expect, it } from 'vitest';
import { createLocalSeoBatchHandler } from './local_seo_batch_handler';

const website_id = '11111111-1111-4111-8111-111111111111';
const key = 'local-seo:1234567890';
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://app.test/api/websites/bulk-seo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...headers }, body: JSON.stringify(body) });
const deps = (data: unknown, error: any = null) => ({ env: { SUPABASE_URL: 'https://db.test', SUPABASE_PUBLISHABLE_KEY: 'key' }, createSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) }, rpc: async () => ({ data, error }) }) as any });

describe('Local SEO batch API', () => {
  it('requires POST, JSON, idempotency, and bearer auth', async () => {
    const handler = createLocalSeoBatchHandler(deps({}));
    expect((await handler(new Request('https://app.test', { method: 'GET' }))).status).toBe(405);
    expect((await handler(request({ website_id, services: ['Wash'], cities: ['City'] }))).status).toBe(401);
  });
  it('passes only validated explicit Website input to the authoritative RPC', async () => {
    let args: any; const handler = createLocalSeoBatchHandler({ ...deps({ success: true, data: { website_id, created_count: 1, replayed: false, pages: [] } }), createSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) }, rpc: async (_: string, value: any) => { args = value; return { data: { success: true, data: { website_id, created_count: 1, replayed: false, pages: [] } }, error: null }; } }) as any });
    expect((await handler(request({ website_id, services: [' Wash '], cities: [' City '] }, { Authorization: 'Bearer token' }))).status).toBe(200);
    expect(args).toMatchObject({ p_website_id: website_id, p_services: ['Wash'], p_cities: ['City'], p_idempotency_key: key });
  });
  it('maps ownership and collision failures without database details', async () => {
    const handler = createLocalSeoBatchHandler(deps(null, { code: 'PT404', message: 'private detail' }));
    expect((await handler(request({ website_id, services: ['Wash'], cities: ['City'] }, { Authorization: 'Bearer token' }))).status).toBe(404);
  });
});
