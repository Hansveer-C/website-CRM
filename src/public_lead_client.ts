import type {
  PublicLeadAcceptedResponse,
  PublicLeadSubmissionRequest
} from '../supabase/functions/_shared/public_lead_contract';

export type PublicLeadClientResult =
  | { state: 'accepted'; message: string; replayed: boolean }
  | { state: 'validation-failure'; message: string }
  | { state: 'unavailable'; message: string }
  | { state: 'rate-limited'; message: string; retryAfterSeconds?: number }
  | { state: 'conflict'; message: string }
  | { state: 'aborted'; message: string }
  | { state: 'malformed-response'; message: string };

export interface SubmitPublicLeadInput {
  endpoint: string;
  submission: PublicLeadSubmissionRequest;
  signal?: AbortSignal;
}

export type PublicLeadFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const GENERIC_FAILURE = 'We could not submit your request right now. Please try again.';

function endpoint(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
    ? value
    : fallback;
}

export async function submitPublicLead(
  fetcher: PublicLeadFetcher,
  input: SubmitPublicLeadInput
): Promise<PublicLeadClientResult> {
  const url = endpoint(input.endpoint);
  if (!url) return { state: 'unavailable', message: GENERIC_FAILURE };

  let result: Response;
  try {
    result = await fetcher(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(structuredClone(input.submission)),
      ...(input.signal ? { signal: input.signal } : {})
    });
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError'
      ? { state: 'aborted', message: GENERIC_FAILURE }
      : { state: 'unavailable', message: GENERIC_FAILURE };
  }

  const contentType = result.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return { state: 'malformed-response', message: GENERIC_FAILURE };
  }
  let body: Record<string, unknown> | null;
  try { body = record(await result.json()); } catch { body = null; }
  if (!body) return { state: 'malformed-response', message: GENERIC_FAILURE };

  if ((result.status === 200 || result.status === 201 || result.status === 202) && body.status === 'accepted') {
    const accepted = body as unknown as PublicLeadAcceptedResponse;
    return {
      state: 'accepted',
      message: safeMessage(accepted.message, 'Thanks! Your request has been received.'),
      replayed: accepted.replayed === true
    };
  }
  const message = safeMessage(body.message, GENERIC_FAILURE);
  if (result.status === 400 || result.status === 413 || result.status === 415) {
    return { state: 'validation-failure', message };
  }
  if (result.status === 409) return { state: 'conflict', message };
  if (result.status === 429) {
    const retry = Number(result.headers.get('retry-after'));
    return {
      state: 'rate-limited', message,
      ...(Number.isFinite(retry) && retry > 0 ? { retryAfterSeconds: Math.ceil(retry) } : {})
    };
  }
  if (result.status === 404 || result.status === 500 || result.status === 503) {
    return { state: 'unavailable', message: GENERIC_FAILURE };
  }
  return { state: 'malformed-response', message: GENERIC_FAILURE };
}
