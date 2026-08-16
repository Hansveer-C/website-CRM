import { describe, expect, it, vi } from 'vitest';
import { createPageSectionRevisionClient, createPageSectionSaveClient } from './page_section_save_client';

const request = { generation: 2, expected_revision: 1, sections: [{ id: 'hero', page_id: 'page/one', type: 'hero', content: {}, order: 0, styles: {} }] };
const success = { success: true, data: { page_id: 'page/one', saved_count: 1, generation: 2, revision: 2, document_hash: 'hash', request_id: 'req' } };
const response = (body: unknown, type = 'application/json') => new Response(JSON.stringify(body), { headers: { 'Content-Type': type } });

describe('page section save client', () => {
  it('returns durable save data', async () => expect(createPageSectionSaveClient({ getAccessToken: async () => 'token', fetch: async () => response(success) })('page/one', request)).resolves.toEqual(success));
  it('sends bearer auth, typed body, and encoded page ID', async () => {
    const fetcher = vi.fn(async () => response(success));
    await createPageSectionSaveClient({ getAccessToken: async () => 'secret', fetch: fetcher })('page/one', request);
    expect(fetcher).toHaveBeenCalledWith('/api/page-sections?pageId=page%2Fone', expect.objectContaining({ method: 'PUT', headers: expect.objectContaining({ Authorization: 'Bearer secret' }), body: JSON.stringify(request) }));
  });
  it('fails before fetch when unauthenticated', async () => {
    const fetcher = vi.fn(); const result = await createPageSectionSaveClient({ getAccessToken: async () => null, fetch: fetcher })('page', request);
    expect(result).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('classifies network failure', async () => expect(createPageSectionSaveClient({ getAccessToken: async () => 'token', fetch: async () => { throw new Error('offline'); } })('page', request)).resolves.toMatchObject({ success: false, error: { code: 'NETWORK_FAILURE' } }));
  it('rejects SPA HTML', async () => expect(createPageSectionSaveClient({ getAccessToken: async () => 'token', fetch: async () => response('<html>', 'text/html') })('page', request)).resolves.toMatchObject({ success: false, error: { code: 'MALFORMED_RESPONSE' } }));
  it('rejects malformed JSON', async () => expect(createPageSectionSaveClient({ getAccessToken: async () => 'token', fetch: async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }) })('page', request)).resolves.toMatchObject({ success: false, error: { code: 'MALFORMED_RESPONSE' } }));
  it('rejects schema-invalid JSON', async () => expect(createPageSectionSaveClient({ getAccessToken: async () => 'token', fetch: async () => response({ success: true }) })('page', request)).resolves.toMatchObject({ success: false, error: { code: 'MALFORMED_RESPONSE' } }));
  it('preserves structured server failures', async () => {
    const failure = { success: false, error: { code: 'CONFLICT', message: 'Conflict', request_id: 'req', status: 409 } };
    await expect(createPageSectionSaveClient({ getAccessToken: async () => 'token', fetch: async () => response(failure) })('page', request)).resolves.toEqual(failure);
  });
  it('fetches the current revision before a fresh-session save', async () => {
    const fetcher = vi.fn(async () => response({ ...success, data: { ...success.data, generation: 0 } }));
    const result = await createPageSectionRevisionClient({ getAccessToken: async () => 'token', fetch: fetcher })('page/one');
    expect(fetcher).toHaveBeenCalledWith('/api/page-section-save-revision?pageId=page%2Fone', expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer token' } }));
    expect(result).toMatchObject({ success: true, data: { revision: 2 } });
  });
});
