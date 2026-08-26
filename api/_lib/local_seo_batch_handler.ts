import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isLocalSeoGenerationResponse, isValidLocalSeoIdempotencyKey, validateLocalSeoGenerationInput, type LocalSeoGenerationResponse } from '../../src/local_seo_generation_contract.js';

type Client = SupabaseClient & { auth: SupabaseClient['auth'] };
export interface LocalSeoBatchHandlerDependencies { env?: Record<string, string | undefined>; createSupabase?: (url: string, key: string, token: string) => Client; }
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (body: LocalSeoGenerationResponse, status: number, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
const fail = (status: number, code: Extract<LocalSeoGenerationResponse, { success: false }>['error']['code'], message: string, fields?: Record<string, string>, extra?: Record<string, string>) => reply({ success: false, error: { code, message, ...(fields ? { fields } : {}) } }, status, extra);
const tokenFrom = (request: Request) => /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')?.trim() ?? '')?.[1]?.trim() || null;
const defaultClient = (url: string, key: string, token: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

export function createLocalSeoBatchHandler(deps: LocalSeoBatchHandlerDependencies = {}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.', undefined, { Allow: 'POST' });
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return fail(400, 'INVALID_INPUT', 'Send an application/json request.');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() || '';
    if (!isValidLocalSeoIdempotencyKey(idempotencyKey)) return fail(400, 'INVALID_IDEMPOTENCY_KEY', 'Send a valid Idempotency-Key header.');
    let body: unknown; try { body = await request.json(); } catch { return fail(400, 'INVALID_INPUT', 'Send valid JSON.'); }
    const validated = validateLocalSeoGenerationInput(body);
    if (!validated.success) return fail(422, 'INVALID_INPUT', 'Check the highlighted fields.', validated.fields);
    const token = tokenFrom(request); if (!token) return fail(401, 'UNAUTHORIZED', 'Sign in to generate Local SEO drafts.');
    const env = deps.env ?? process.env;
    const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || '';
    const key = env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || '';
    if (!/^https:\/\//i.test(url) || !key) return fail(503, 'CONFIGURATION_ERROR', 'Local SEO generation is not configured.');
    try {
      const supabase = (deps.createSupabase ?? defaultClient)(url, key, token);
      const auth = await supabase.auth.getUser(token);
      if (auth.error || !auth.data.user?.id) return fail(401, 'UNAUTHORIZED', 'Your session is invalid or expired.');
      const { data, error } = await supabase.rpc('create_local_seo_draft_batch', { p_website_id: validated.data.website_id, p_services: validated.data.services, p_cities: validated.data.cities, p_idempotency_key: idempotencyKey });
      if (error) {
        if (error.code === 'PT404') return fail(404, 'NOT_FOUND', 'Website not found.');
        if (error.code === 'PT409' || error.code === '23505') return fail(409, 'CONFLICT', 'A conflicting Local SEO draft already exists.');
        if (error.code === 'PT422' || error.code === 'PT400') return fail(422, 'INVALID_INPUT', 'Local SEO draft input is invalid.');
        if (error.code === 'PT401') return fail(401, 'UNAUTHORIZED', 'Your session is invalid or expired.');
        return fail(503, 'UPSTREAM_UNAVAILABLE', 'Local SEO generation is temporarily unavailable.');
      }
      if (!isLocalSeoGenerationResponse(data)) return fail(503, 'UPSTREAM_UNAVAILABLE', 'Local SEO generation returned an invalid response.');
      return reply(data, 200);
    } catch { return fail(503, 'UPSTREAM_UNAVAILABLE', 'Local SEO generation is temporarily unavailable.'); }
  };
}
