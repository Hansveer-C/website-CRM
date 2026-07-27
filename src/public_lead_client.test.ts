import { describe, expect, it, vi } from 'vitest';
import { submitPublicLead } from './public_lead_client';
import type { PublicLeadSubmissionRequest } from '../supabase/functions/_shared/public_lead_contract';

const submission: PublicLeadSubmissionRequest = {
  host: 'clean.example.com', path: '/', formSectionId: 'form-1',
  idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
  fields: { name: 'A Person', phone: '+1 604 555 0100' }
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...headers }
  });
}

describe('submitPublicLead', () => {
  it('posts JSON without credentials, auth, query PII, mutation, or retry', async () => {
    const before = structuredClone(submission);
    const fetcher = vi.fn(async () => json(201, { status: 'accepted', message: 'Received' }));
    const result = await submitPublicLead(fetcher, {
      endpoint: 'https://project.supabase.co/functions/v1/public-lead', submission
    });
    expect(result).toEqual({ state: 'accepted', message: 'Received', replayed: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(String(url)).toBe('https://project.supabase.co/functions/v1/public-lead');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init?.body)).idempotencyKey).toBe(submission.idempotencyKey);
    expect(submission).toEqual(before);
  });

  it('preserves AbortSignal and maps aborts', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException('stopped', 'AbortError');
    });
    expect((await submitPublicLead(fetcher, {
      endpoint: 'https://project.test/public-lead', submission, signal: controller.signal
    })).state).toBe('aborted');
  });

  it.each([
    [200, { status: 'accepted', message: 'ok', replayed: true }, 'accepted'],
    [400, { status: 'error', message: 'check' }, 'validation-failure'],
    [404, { status: 'error', message: 'missing' }, 'unavailable'],
    [409, { status: 'error', message: 'conflict' }, 'conflict'],
    [413, { status: 'error', message: 'large' }, 'validation-failure'],
    [415, { status: 'error', message: 'media' }, 'validation-failure'],
    [500, { status: 'error', message: 'database secret' }, 'unavailable'],
    [503, { status: 'error', message: 'configuration secret' }, 'unavailable']
  ])('maps status %s safely', async (status, body, state) => {
    const result = await submitPublicLead(async () => json(status as number, body), {
      endpoint: 'https://project.test/public-lead', submission
    });
    expect(result.state).toBe(state);
    if (status === 500 || status === 503) expect(result.message).not.toContain('secret');
  });

  it('maps rate limits and Retry-After', async () => {
    const result = await submitPublicLead(async () => json(429, {
      status: 'error', message: 'Too many requests.'
    }, { 'Retry-After': '600' }), { endpoint: 'https://project.test/public-lead', submission });
    expect(result).toMatchObject({ state: 'rate-limited', retryAfterSeconds: 600 });
  });

  it.each([
    new Response('not json', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    json(200, { status: 'wrong' })
  ])('rejects malformed responses', async response => {
    expect((await submitPublicLead(async () => response, {
      endpoint: 'https://project.test/public-lead', submission
    })).state).toBe('malformed-response');
  });
});
