import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleBuilderReorderPagesBrowserPost } from './builder_reorder_browser';
import { PagesRepo } from './pages_repo_supabase';

describe('handleBuilderReorderPagesBrowserPost', () => {
  beforeEach(() => {
    (globalThis as any).currentUser = 'user-1';
  });

  it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
    (globalThis as any).currentUser = '';
    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: JSON.stringify({ funnel_id: 'f1', ordered_page_ids: ['p1'], expected_page_ids: ['p1'] })
    });

    expect(res?.status).toBe(401);
    const body = await res?.json();
    expect(body).toEqual({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Unauthorized'
    });
  });

  it('rejects invalid JSON body with 400 INVALID_INPUT', async () => {
    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: 'invalid-json'
    });

    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body).toEqual({
      success: false,
      code: 'INVALID_INPUT',
      error: 'Invalid page order payload'
    });
  });

  it('rejects missing or non-array page IDs with 400 INVALID_INPUT', async () => {
    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: JSON.stringify({ funnel_id: 'f1', ordered_page_ids: 'not-array', expected_page_ids: ['p1'] })
    });

    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body).toEqual({
      success: false,
      code: 'INVALID_INPUT',
      error: 'Invalid page order payload'
    });
  });

  it('maps PagesRepo CONFLICT result to 409 CONFLICT', async () => {
    vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValueOnce({
      success: false,
      code: 'CONFLICT',
      error: 'The page order changed elsewhere. Reload and try again.'
    });

    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: JSON.stringify({ funnel_id: 'f1', ordered_page_ids: ['p2', 'p1'], expected_page_ids: ['p1', 'p2'] })
    });

    expect(res?.status).toBe(409);
    const body = await res?.json();
    expect(body).toEqual({
      success: false,
      code: 'CONFLICT',
      error: 'The page order changed elsewhere. Reload and try again.'
    });
  });

  it('maps PagesRepo NOT_FOUND result to 404 NOT_FOUND', async () => {
    vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValueOnce({
      success: false,
      code: 'NOT_FOUND',
      error: 'NOT_FOUND'
    });

    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: JSON.stringify({ funnel_id: 'f-missing', ordered_page_ids: ['p1'], expected_page_ids: ['p1'] })
    });

    expect(res?.status).toBe(404);
    const body = await res?.json();
    expect(body).toEqual({
      success: false,
      code: 'NOT_FOUND',
      error: 'Funnel not found'
    });
  });

  it('maps PagesRepo FORBIDDEN result to 403 FORBIDDEN', async () => {
    vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValueOnce({
      success: false,
      code: 'FORBIDDEN',
      error: 'FORBIDDEN'
    });

    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: JSON.stringify({ funnel_id: 'f-foreign', ordered_page_ids: ['p1'], expected_page_ids: ['p1'] })
    });

    expect(res?.status).toBe(403);
    const body = await res?.json();
    expect(body).toEqual({
      success: false,
      code: 'FORBIDDEN',
      error: 'Forbidden'
    });
  });

  it('maps PagesRepo AMBIGUOUS result to 409 AMBIGUOUS with uncertain-result user message', async () => {
    vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValueOnce({
      success: false,
      code: 'AMBIGUOUS',
      error: 'The reorder result is uncertain. Please reload to check.'
    });

    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: JSON.stringify({ funnel_id: 'f1', ordered_page_ids: ['p2', 'p1'], expected_page_ids: ['p1', 'p2'] })
    });

    expect(res?.status).toBe(409);
    const body = await res?.json();
    expect(body).toEqual({
      success: false,
      code: 'AMBIGUOUS',
      error: 'The reorder result is uncertain. Please reload to check.'
    });
  });

  it('returns 200 on successful reordering', async () => {
    vi.spyOn(PagesRepo, 'reorderPages').mockResolvedValueOnce({
      success: true,
      data: {
        funnel_id: 'f1',
        pages: []
      }
    });

    const res = await handleBuilderReorderPagesBrowserPost('http://localhost/api/pages/reorder', {
      method: 'POST',
      body: JSON.stringify({ funnel_id: 'f1', ordered_page_ids: ['p2', 'p1'], expected_page_ids: ['p1', 'p2'] })
    });

    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body).toEqual({
      success: true,
      data: {
        funnel_id: 'f1',
        pages: []
      }
    });
  });
});
