import { describe, expect, it } from 'vitest';
import { GET as notFound } from './not-found';

describe('unknown API handler', () => {
  it('returns a JSON 404 instead of SPA HTML', async () => {
    const response = notFound();
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
  });
});
