import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  isPageSectionSaveResponse,
  validatePageSectionSaveRequest,
  type PageSectionSaveErrorCode,
  type PageSectionSaveResponse
} from '../../src/page_section_save_contract.js';

type AuthenticatedSupabase = SupabaseClient & { auth: SupabaseClient['auth'] };

export interface PageSectionSaveHandlerDependencies {
  env?: Record<string, string | undefined>;
  createSupabase?: (url: string, key: string, token: string) => AuthenticatedSupabase;
  requestId?: () => string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function json(body: PageSectionSaveResponse, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function failure(status: number, code: PageSectionSaveErrorCode, message: string, requestId: string, fields?: Record<string, string>, headers?: Record<string, string>): Response {
  return json({ success: false, error: { code, message, request_id: requestId, status, ...(fields ? { fields } : {}) } }, status, headers);
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')?.trim() ?? '');
  return match?.[1]?.trim() || null;
}

function pageIdFromRequest(request: Request): string {
  const match = /\/api\/pages\/([^/]+)\/(?:sections|section-save-revision)\/?$/.exec(new URL(request.url).pathname);
  try { return match?.[1] ? decodeURIComponent(match[1]) : ''; } catch { return ''; }
}

function defaultCreateSupabase(url: string, key: string, token: string): AuthenticatedSupabase {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

function databaseFailure(code: string | undefined): { status: number; code: PageSectionSaveErrorCode; message: string } {
  if (code === 'PT401') return { status: 401, code: 'UNAUTHENTICATED', message: 'Your session is invalid or expired.' };
  if (code === 'PT403') return { status: 403, code: 'UNAUTHORIZED', message: 'You cannot save this page.' };
  if (code === 'PT404') return { status: 404, code: 'PAGE_NOT_FOUND', message: 'The page was not found.' };
  if (code === 'PT409' || code === '23505') return { status: 409, code: 'CONFLICT', message: 'This page changed elsewhere. Reload before saving again.' };
  if (code === 'PT422' || code === '22023' || code === '23514') return { status: 422, code: 'INVALID_INPUT', message: 'The page document is invalid.' };
  if (code === '57014' || code === '53300') return { status: 503, code: 'SUPABASE_UNAVAILABLE', message: 'The save service is temporarily unavailable.' };
  return { status: 500, code: 'TRANSACTION_FAILED', message: 'The page could not be saved. Your edits are still in this browser.' };
}

export function createPageSectionSaveHandler(dependencies: PageSectionSaveHandlerDependencies = {}) {
  return async function handlePageSectionSave(request: Request): Promise<Response> {
    const requestId = dependencies.requestId?.() ?? crypto.randomUUID();
    if (request.method !== 'PUT' && request.method !== 'GET') return failure(405, 'METHOD_NOT_ALLOWED', 'Use PUT or GET for this endpoint.', requestId, undefined, { Allow: 'PUT, GET' });
    const pageId = pageIdFromRequest(request);
    if (!pageId || pageId.length > 128) return failure(404, 'PAGE_NOT_FOUND', 'The page was not found.', requestId);
    let validation: ReturnType<typeof validatePageSectionSaveRequest> | null = null;
    if (request.method === 'PUT') {
      if (!(request.headers.get('content-type')?.toLowerCase() ?? '').includes('application/json')) return failure(400, 'INVALID_INPUT', 'Send an application/json request.', requestId);
      let body: unknown;
      try { body = await request.json(); } catch { return failure(400, 'INVALID_INPUT', 'Send valid JSON.', requestId); }
      validation = validatePageSectionSaveRequest(body, pageId);
      if (!validation.success) return failure(422, 'INVALID_INPUT', 'The page document is invalid.', requestId, validation.fields);
    }
    const token = bearerToken(request);
    if (!token) return failure(401, 'UNAUTHENTICATED', 'Sign in to save this page.', requestId);

    const env = dependencies.env ?? process.env;
    const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || '';
    const key = env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || '';
    if (!/^https:\/\//i.test(url) || !key) return failure(503, 'CONFIGURATION_ERROR', 'Page saving is not configured.', requestId);
    try {
      const supabase = (dependencies.createSupabase ?? defaultCreateSupabase)(url, key, token);
      const auth = await supabase.auth.getUser(token);
      if (auth.error || !auth.data.user?.id) return failure(401, 'UNAUTHENTICATED', 'Your session is invalid or expired.', requestId);
      const rpcResult = request.method === 'GET'
        ? await supabase.rpc('get_page_sections_save_revision', { p_page_id: pageId })
        : await supabase.rpc('save_page_sections_document', {
            p_page_id: pageId,
            p_sections: validation && validation.success ? validation.data.sections : [],
            p_generation: validation && validation.success ? validation.data.generation : 0,
            p_expected_revision: validation && validation.success ? validation.data.expected_revision : null
          });
      const { data, error } = rpcResult;
      if (error) {
        const safe = databaseFailure(error.code);
        return failure(safe.status, safe.code, safe.message, requestId);
      }
      const response: unknown = { success: true, data: { ...(data as Record<string, unknown>), request_id: requestId } };
      if (!isPageSectionSaveResponse(response) || !response.success) return failure(502, 'MALFORMED_RESPONSE', 'The save service returned an invalid result.', requestId);
      return json(response, 200);
    } catch {
      return failure(503, 'SUPABASE_UNAVAILABLE', 'The save service is temporarily unavailable.', requestId);
    }
  };
}
