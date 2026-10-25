import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvoiceDocumentPdfHandler } from './invoice_document_pdf_handler.js';

const createClient = vi.hoisted(() => vi.fn(() => { throw new Error('Unexpected backend access'); }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

describe('invoice PDF request validation', () => {
  const handler = createInvoiceDocumentPdfHandler({});
  const request = (body: string, overrides: RequestInit = {}) => new Request('http://localhost/api/invoices/documents/pdf', {
    method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body, ...overrides,
  });
  beforeEach(() => {
    createClient.mockClear();
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network access forbidden'); }));
  });
  afterEach(() => {
    expect(createClient).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it.each(['null', 'true', 'false', '0', '42', '"text"', '[]', '[{"document_spec_id":"11111111-1111-4111-8111-111111111111"}]', '{}', '{', '',
    '{"document_spec_id":null}', '{"document_spec_id":42}', '{"document_spec_id":""}', '{"document_spec_id":"invalid"}'])('rejects malformed body %s', async (body) => {
    const response = await handler(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_INPUT' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each([undefined, '', 'Basic token', 'Bearer '])('requires a bearer token (%s)', async (authorization) => {
    const response = await handler(request('null', { headers: { 'content-type': 'application/json', ...(authorization === undefined ? {} : { authorization }) } }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('rejects non-JSON content before parsing', async () => {
    const response = await handler(request('null', { headers: { authorization: 'Bearer test-token', 'content-type': 'text/plain' } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_INPUT' });
  });

  it.each(['GET', 'PUT', 'DELETE', 'OPTIONS'])('rejects method %s', async (method) => {
    const response = await handler(new Request('http://localhost/api/invoices/documents/pdf', { method }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(await response.text()).toBe('');
  });

  it('allows a valid ID through input validation', async () => {
    const response = await handler(request('{"document_spec_id":"11111111-1111-4111-8111-111111111111"}'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'CONFIGURATION_ERROR' });
  });
});
