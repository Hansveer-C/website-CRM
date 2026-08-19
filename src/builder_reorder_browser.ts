import type { SupabaseClient } from '@supabase/supabase-js';
import { PagesRepo } from './pages_repo_supabase';

export interface BuilderReorderBrowserPostContext {
  getCurrentUser?: () => string;
  editorUsesSupabase?: () => boolean;
  editorUsesLocalData?: () => boolean;
  getSupabaseClient?: () => Promise<SupabaseClient | undefined>;
}

function getInputUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (typeof init?.method === 'string') return init.method;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method;
  return 'GET';
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleBuilderReorderPagesBrowserPost(
  input: RequestInfo | URL,
  init?: RequestInit,
  context?: BuilderReorderBrowserPostContext
): Promise<Response | null> {
  const requestUrl = getInputUrl(input);
  if (!requestUrl) return null;

  let pathname = '';
  try {
    pathname = new URL(requestUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').pathname;
  } catch {
    return null;
  }

  if (pathname !== '/api/pages/reorder' || getMethod(input, init).toUpperCase() !== 'POST') {
    return null;
  }

  const userId = context?.getCurrentUser
    ? context.getCurrentUser().trim()
    : (typeof (globalThis as any).currentUser === 'string'
      ? (globalThis as any).currentUser.trim()
      : (typeof window !== 'undefined' && typeof (window as any).currentUser === 'string'
        ? (window as any).currentUser.trim()
        : ''));

  if (!userId) {
    return jsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);
  }

  let payload: { funnel_id?: string; ordered_page_ids?: string[]; expected_page_ids?: string[] } | undefined;
  try {
    payload = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
  } catch {
    return jsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page order payload' }, 400);
  }

  if (!payload?.funnel_id || !Array.isArray(payload.ordered_page_ids) || !Array.isArray(payload.expected_page_ids)) {
    return jsonResponse({ success: false, code: 'INVALID_INPUT', error: 'Invalid page order payload' }, 400);
  }

  let client: SupabaseClient | undefined;
  const usesSupabase = context?.editorUsesSupabase ? context.editorUsesSupabase() : false;
  const usesLocal = context?.editorUsesLocalData ? context.editorUsesLocalData() : true;

  if (usesSupabase) {
    client = context?.getSupabaseClient ? await context.getSupabaseClient() : undefined;
    if (!client) return jsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page reordering is unavailable' }, 503);
    const authResult = await client.auth.getUser();
    if (authResult.error || authResult.data.user?.id !== userId) {
      return jsonResponse({ success: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }, 401);
    }
  } else if (!usesLocal) {
    return jsonResponse({ success: false, code: 'UNAVAILABLE', error: 'Page reordering is unavailable' }, 503);
  }

  const result = await PagesRepo.reorderPages(payload.funnel_id, payload.ordered_page_ids, payload.expected_page_ids, userId, client);

  if (!result.success || !result.data) {
    const unauthorized = result.code === 'UNAUTHORIZED';
    const forbidden = result.code === 'FORBIDDEN';
    const notFound = result.code === 'NOT_FOUND';
    const invalidInput = result.code === 'INVALID_INPUT';
    const conflict = result.code === 'CONFLICT';
    const ambiguous = result.code === 'AMBIGUOUS';

    const code = unauthorized ? 'UNAUTHORIZED'
      : forbidden ? 'FORBIDDEN'
      : notFound ? 'NOT_FOUND'
      : invalidInput ? 'INVALID_INPUT'
      : conflict ? 'CONFLICT'
      : ambiguous ? 'AMBIGUOUS'
      : 'UNAVAILABLE';

    const status = unauthorized ? 401
      : forbidden ? 403
      : notFound ? 404
      : invalidInput ? 400
      : conflict ? 409
      : ambiguous ? 409
      : 503;

    const error = unauthorized
      ? 'Unauthorized'
      : forbidden
        ? 'Forbidden'
        : notFound
          ? 'Funnel not found'
          : invalidInput
            ? 'Invalid page order payload'
            : conflict
              ? 'The page order changed elsewhere. Reload and try again.'
              : ambiguous
                ? 'The reorder result is uncertain. Please reload to check.'
                : 'The page order could not be updated. Please try again.';

    return jsonResponse({ success: false, code, error }, status);
  }

  return jsonResponse({ success: true, data: result.data }, 200);
}
