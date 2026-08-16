import { describe, expect, it, vi } from 'vitest';
import { createPageSectionSaveHandler } from './page_section_save_handler';

const endpoint = 'https://example.test/api/pages/page-1/sections';
const body = { generation: 3, expected_revision: 2, sections: [{ id: 'hero-1', page_id: 'page-1', type: 'hero', content: { heading: 'Edited' }, order: 0, styles: {} }] };
const durable = { page_id: 'page-1', saved_count: 1, generation: 3, revision: 3, document_hash: 'hash' };
const request = (options: { method?: string; token?: boolean; value?: unknown; raw?: string; contentType?: string; url?: string } = {}) => new Request(options.url ?? endpoint, {
  method: options.method ?? 'PUT',
  headers: { ...(options.token === false ? {} : { Authorization: 'Bearer token' }), 'Content-Type': options.contentType ?? 'application/json' },
  ...((options.method ?? 'PUT') === 'PUT' ? { body: options.raw ?? JSON.stringify(options.value ?? body) } : {})
});
const dependencies = (rpcResult: { data: unknown; error: null | { code?: string } } = { data: durable, error: null }, authenticated = true) => {
  const getUser = vi.fn(async () => ({ data: { user: authenticated ? { id: 'user-1' } : null }, error: authenticated ? null : { message: 'invalid' } }));
  const rpc = vi.fn(async () => rpcResult);
  return { getUser, rpc, options: { requestId: () => 'request-1', env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable' }, createSupabase: () => ({ auth: { getUser }, rpc } as never) } };
};

describe('page section save Vercel handler', () => {
  it('allows only PUT and GET and returns JSON', async () => { const response = await createPageSectionSaveHandler()(request({ method: 'POST' })); expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('PUT, GET'); expect(response.headers.get('content-type')).toContain('application/json'); });
  it('requires a route page ID', async () => expect((await createPageSectionSaveHandler()(request({ url: 'https://example.test/api/pages//sections' }))).status).toBe(404));
  it('accepts a page ID from a literal endpoint query', async () => { const dep = dependencies(); const response = await createPageSectionSaveHandler(dep.options)(request({ url: 'https://example.test/api/page-sections?pageId=page-1' })); expect(response.status).toBe(200); expect(dep.rpc).toHaveBeenCalledWith('save_page_sections_document', expect.objectContaining({ p_page_id: 'page-1' })); });
  it('requires JSON content', async () => expect((await createPageSectionSaveHandler()(request({ contentType: 'text/plain' }))).status).toBe(400));
  it('rejects malformed JSON', async () => expect((await createPageSectionSaveHandler()(request({ raw: '{' }))).status).toBe(400));
  it('rejects invalid documents before authentication or RPC', async () => expect((await createPageSectionSaveHandler()(request({ value: { ...body, sections: [{ ...body.sections[0], type: 'unknown' }] } }))).status).toBe(422));
  it('requires bearer authentication', async () => expect((await createPageSectionSaveHandler()(request({ token: false }))).status).toBe(401));
  it('rejects invalid sessions', async () => { const dep = dependencies(undefined, false); expect((await createPageSectionSaveHandler(dep.options)(request())).status).toBe(401); });
  it('shows missing server configuration', async () => expect((await createPageSectionSaveHandler({ env: {}, requestId: () => 'req' })(request())).status).toBe(503));
  it('verifies the bearer token server-side', async () => { const dep = dependencies(); await createPageSectionSaveHandler(dep.options)(request()); expect(dep.getUser).toHaveBeenCalledWith('token'); });
  it('passes the complete document and revision to one RPC', async () => { const dep = dependencies(); await createPageSectionSaveHandler(dep.options)(request()); expect(dep.rpc).toHaveBeenCalledOnce(); expect(dep.rpc).toHaveBeenCalledWith('save_page_sections_document', { p_page_id: 'page-1', p_sections: body.sections, p_generation: 3, p_expected_revision: 2 }); });
  it('fetches the authenticated server revision for a fresh session', async () => { const dep = dependencies({ data: { ...durable, generation: 0 }, error: null }); const response = await createPageSectionSaveHandler(dep.options)(request({ method: 'GET' })); expect(response.status).toBe(200); expect(dep.rpc).toHaveBeenCalledWith('get_page_sections_save_revision', { p_page_id: 'page-1' }); });
  it('returns server-confirmed durable metadata', async () => { const dep = dependencies(); const response = await createPageSectionSaveHandler(dep.options)(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, data: { ...durable, request_id: 'request-1' } }); });
  it.each([['PT403', 403, 'UNAUTHORIZED'], ['PT404', 404, 'PAGE_NOT_FOUND'], ['PT409', 409, 'CONFLICT'], ['PT422', 422, 'INVALID_INPUT'], ['57014', 503, 'SUPABASE_UNAVAILABLE'], ['XX000', 500, 'TRANSACTION_FAILED']] as const)('maps database %s safely', async (databaseCode, status, publicCode) => { const dep = dependencies({ data: null, error: { code: databaseCode } }); const response = await createPageSectionSaveHandler(dep.options)(request()); expect(response.status).toBe(status); const text = await response.text(); expect(text).toContain(publicCode); expect(text).not.toContain(databaseCode); });
  it('rejects malformed RPC results', async () => { const dep = dependencies({ data: { saved_count: 1 }, error: null }); expect((await createPageSectionSaveHandler(dep.options)(request())).status).toBe(502); });
  it('sanitizes thrown upstream failures', async () => { const dep = dependencies(); dep.rpc.mockRejectedValueOnce(new Error('secret database details')); const response = await createPageSectionSaveHandler(dep.options)(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret database details'); });
  it('sets no-store and nosniff', async () => { const dep = dependencies(); const response = await createPageSectionSaveHandler(dep.options)(request()); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-content-type-options')).toBe('nosniff'); });
});
