import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  isValidWebsiteGenerationIdempotencyKey,
  isWebsiteGenerationResponse,
  validateWebsiteGenerationInput,
  type WebsiteGenerationResponse
} from '../../src/website_generation_contract';

type AuthenticatedSupabase = SupabaseClient & {
  auth: SupabaseClient['auth'];
};

export interface WebsiteGenerationHandlerDependencies {
  env?: Record<string, string | undefined>;
  createSupabase?: (url: string, key: string, token: string) => AuthenticatedSupabase;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function json(body: WebsiteGenerationResponse, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

function failure(
  status: number,
  code: Extract<WebsiteGenerationResponse, { success: false }>['error']['code'],
  message: string,
  fields?: Record<string, string>,
  headers?: Record<string, string>
): Response {
  return json({ success: false, error: { code, message, ...(fields ? { fields } : {}) } }, status, headers);
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')?.trim() ?? '');
  return match?.[1]?.trim() || null;
}

function defaultCreateSupabase(url: string, key: string, token: string): AuthenticatedSupabase {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

function publicMessageForDatabaseCode(code?: string): { status: number; code: 'CONFLICT' | 'UPSTREAM_UNAVAILABLE'; message: string } {
  if (code === '23505' || code === 'P0002') {
    return { status: 409, code: 'CONFLICT', message: 'A website already exists for this account. Refresh to continue.' };
  }
  return { status: 503, code: 'UPSTREAM_UNAVAILABLE', message: 'Website creation is temporarily unavailable. Try again.' };
}

export function createWebsiteGenerationHandler(dependencies: WebsiteGenerationHandlerDependencies = {}) {
  return async function handleWebsiteGeneration(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return failure(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.', undefined, { Allow: 'POST' });
    }
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json')) return failure(400, 'INVALID_INPUT', 'Send an application/json request.');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
    if (!isValidWebsiteGenerationIdempotencyKey(idempotencyKey)) {
      return failure(400, 'INVALID_IDEMPOTENCY_KEY', 'Send a valid Idempotency-Key header.');
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, 'INVALID_INPUT', 'Send valid JSON.');
    }
    const validation = validateWebsiteGenerationInput(body);
    if (!validation.success) return failure(422, 'INVALID_INPUT', 'Check the highlighted fields.', validation.fields);
    const token = bearerToken(request);
    if (!token) return failure(401, 'UNAUTHORIZED', 'Sign in to create a website.');

    const env = dependencies.env ?? process.env;
    const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || '';
    const key = env.SUPABASE_PUBLISHABLE_KEY?.trim()
      || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
      || env.SUPABASE_ANON_KEY?.trim()
      || env.VITE_SUPABASE_ANON_KEY?.trim()
      || '';
    if (!/^https:\/\//i.test(url) || !key) {
      return failure(503, 'CONFIGURATION_ERROR', 'Website creation is not configured.');
    }
    try {
      const supabase = (dependencies.createSupabase ?? defaultCreateSupabase)(url, key, token);
      const auth = await supabase.auth.getUser(token);
      if (auth.error || !auth.data.user?.id) return failure(401, 'UNAUTHORIZED', 'Your session is invalid or expired.');
      const { data, error } = await supabase.rpc('create_initial_website_graph', {
        p_business_name: validation.data.business_name,
        p_phone_number: validation.data.phone_number,
        p_city: validation.data.city,
        p_services: validation.data.services,
        p_idempotency_key: idempotencyKey
      });
      if (error) {
        const safe = publicMessageForDatabaseCode(error.code);
        return failure(safe.status, safe.code, safe.message);
      }
      if (!isWebsiteGenerationResponse(data) || !data.success) {
        return failure(502, 'UPSTREAM_UNAVAILABLE', 'Website creation returned an invalid result. Try again.');
      }
      return json(data, data.data.created ? 201 : 200);
    } catch {
      return failure(503, 'UPSTREAM_UNAVAILABLE', 'Website creation is temporarily unavailable. Try again.');
    }
  };
}
