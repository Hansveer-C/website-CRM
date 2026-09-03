import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PDF_MIME_TYPE, PDF_TEMPLATE_KEY, PDF_TEMPLATE_VERSION, renderIssuedInvoicePdf, sha256, type FrozenInvoiceDocumentSpec } from '../../src/documents/issued_invoice_pdf.js';

type Client = SupabaseClient & { auth: SupabaseClient['auth'] };
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
const tokenFrom = (request: Request) => /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')?.trim() ?? '')?.[1]?.trim() || null;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
function trustedSupabaseUrl(value: string): boolean { try { const url = new URL(value); return url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)); } catch { return false; } }
function client(url: string, key: string, token?: string): Client { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}) }); }

export function createInvoiceDocumentPdfHandler(env: Record<string, string | undefined> = process.env) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return json({ error: 'INVALID_INPUT' }, 400);
    const token = tokenFrom(request); if (!token) return json({ error: 'UNAUTHORIZED' }, 401);
    let body: { document_spec_id?: unknown }; try { body = await request.json(); } catch { return json({ error: 'INVALID_INPUT' }, 400); }
    if (!uuid(body.document_spec_id)) return json({ error: 'INVALID_INPUT' }, 400);
    const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || ''; const key = env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim() || ''; const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
    if (!trustedSupabaseUrl(url) || !key || !serviceKey) return json({ error: 'CONFIGURATION_ERROR' }, 503);
    try {
      const browserAuthority = client(url, key, token); const auth = await browserAuthority.auth.getUser(token); const userId = auth.data.user?.id; if (auth.error || !userId) return json({ error: 'UNAUTHORIZED' }, 401);
      const { data: specRow, error: specError } = await browserAuthority.from('invoice_document_specs').select('id,template_key,template_version,specification').eq('id', body.document_spec_id).maybeSingle();
      if (specError || !specRow || specRow.template_key !== PDF_TEMPLATE_KEY || specRow.template_version !== PDF_TEMPLATE_VERSION) return json({ error: 'NOT_FOUND' }, 404);
      const server = client(url, serviceKey); const { data: claim, error: claimError } = await server.rpc('claim_issued_invoice_pdf_artifact', { p_user_id: userId, p_document_spec_id: specRow.id });
      if (claimError || !claim) return json({ error: 'UPSTREAM_UNAVAILABLE' }, 503);
      if (claim.status === 'ready') return json({ artifact: claim, replayed: true }, 200);
      const pdf = await renderIssuedInvoicePdf(specRow.specification as FrozenInvoiceDocumentSpec); const hash = sha256(pdf); const path = String(claim.object_path);
      const verifyStored = async () => { const stored = await server.storage.from('commercial-documents').download(path); if (!stored.data) return false; return sha256(new Uint8Array(await stored.data.arrayBuffer())) === hash; };
      const existing = await server.storage.from('commercial-documents').download(path);
      if (existing.data) { if (sha256(new Uint8Array(await existing.data.arrayBuffer())) !== hash) return json({ error: 'ARTIFACT_INTEGRITY_CONFLICT' }, 409); }
      else {
        const upload = await server.storage.from('commercial-documents').upload(path, pdf, { contentType: PDF_MIME_TYPE, upsert: false });
        if (upload.error && !/exists|duplicate/i.test(upload.error.message)) return json({ error: 'UPLOAD_FAILED' }, 503);
        if (upload.error && !(await verifyStored())) return json({ error: 'ARTIFACT_INTEGRITY_CONFLICT' }, 409);
      }
      const { data: artifact, error: finalizeError } = await server.rpc('finalize_issued_invoice_pdf_artifact', { p_user_id: userId, p_document_spec_id: specRow.id, p_byte_size: pdf.byteLength, p_sha256: hash });
      if (finalizeError || !artifact) return json({ error: 'ARTIFACT_PENDING_RECOVERY' }, 503);
      return json({ artifact, replayed: false }, 201);
    } catch { return json({ error: 'RENDER_FAILED' }, 503); }
  };
}
