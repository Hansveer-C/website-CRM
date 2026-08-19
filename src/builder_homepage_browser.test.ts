import { describe, expect, it, vi } from 'vitest';
import { handleBuilderSetHomepageBrowserPost } from './builder_homepage_browser';
import * as homepageRepo from './builder_homepage_repository';
import type { Website } from './types';

describe('handleBuilderSetHomepageBrowserPost', () => {
  const website: Website = {
    id: 'ws-1',
    user_id: 'user-1',
    name: 'My Site',
    domain: 'mysite.com',
    subdomain: 'mysite',
    homepage_funnel_id: 'fnl-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  it('ignores non-matching paths or methods', async () => {
    const resGet = await handleBuilderSetHomepageBrowserPost('/api/websites/homepage', { method: 'GET' });
    expect(resGet).toBeNull();

    const resOther = await handleBuilderSetHomepageBrowserPost('/api/websites/other', { method: 'POST' });
    expect(resOther).toBeNull();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await handleBuilderSetHomepageBrowserPost('/api/websites/homepage', {
      method: 'POST',
      body: JSON.stringify({ website_id: 'ws-1', funnel_id: 'fnl-2' })
    }, {
      getCurrentUser: () => ''
    });

    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
    const json = await res?.json();
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when payload is missing required fields', async () => {
    const res = await handleBuilderSetHomepageBrowserPost('/api/websites/homepage', {
      method: 'POST',
      body: JSON.stringify({ website_id: 'ws-1' })
    }, {
      getCurrentUser: () => 'user-1'
    });

    expect(res?.status).toBe(400);
    const json = await res?.json();
    expect(json.code).toBe('INVALID_INPUT');
  });

  it('returns 200 with updated website on success', async () => {
    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage').mockResolvedValueOnce({
      success: true,
      code: 'SUCCESS',
      data: { website: { ...website, homepage_funnel_id: 'fnl-2' } }
    });

    const res = await handleBuilderSetHomepageBrowserPost('/api/websites/homepage', {
      method: 'POST',
      body: JSON.stringify({ website_id: 'ws-1', funnel_id: 'fnl-2', expected_homepage_funnel_id: 'fnl-1' })
    }, {
      getCurrentUser: () => 'user-1'
    });

    expect(res?.status).toBe(200);
    const json = await res?.json();
    expect(json.success).toBe(true);
    expect(json.data.website.homepage_funnel_id).toBe('fnl-2');

    spy.mockRestore();
  });

  it('returns 409 on CONFLICT', async () => {
    const spy = vi.spyOn(homepageRepo, 'setBuilderHomepage').mockResolvedValueOnce({
      success: false,
      code: 'CONFLICT',
      error: 'The homepage changed elsewhere. Reload and try again.'
    });

    const res = await handleBuilderSetHomepageBrowserPost('/api/websites/homepage', {
      method: 'POST',
      body: JSON.stringify({ website_id: 'ws-1', funnel_id: 'fnl-2', expected_homepage_funnel_id: 'fnl-old' })
    }, {
      getCurrentUser: () => 'user-1'
    });

    expect(res?.status).toBe(409);
    const json = await res?.json();
    expect(json.code).toBe('CONFLICT');

    spy.mockRestore();
  });
});
