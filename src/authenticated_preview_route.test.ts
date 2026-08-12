import { describe, expect, it } from 'vitest';
import type { Funnel, Page, Website, WebsiteRoute } from './types';
import { buildAuthenticatedPreviewUrl, resolveAuthenticatedPreview } from './authenticated_preview_route';

const website = (id = 'w1', user = 'u1'): Website => ({ id, user_id: user, name: id, domain: null, subdomain: id, homepage_funnel_id: 'f1', created_at: '', updated_at: '' });
const route = (path = '/', site = 'w1', funnel = 'f1'): WebsiteRoute => ({ id: `${site}:${path}`, website_id: site, funnel_id: funnel, path, slug: path === '/' ? 'home' : path.slice(1), created_at: '' });
const funnel = (id = 'f1', user = 'u1'): Funnel => ({ id, user_id: user, name: id, status: 'draft', created_at: '', updated_at: '' });
const page = (id = 'p1', user = 'u1', funnelId = 'f1'): Page => ({ id, user_id: user, funnel_id: funnelId, name: 'Home', slug: 'home', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '' });

describe('authenticated preview routing', () => {
  it('builds an explicit protected preview URL for the homepage', () => {
    expect(buildAuthenticatedPreviewUrl({ websiteId: 'w1', pageId: 'p1', path: '/' }))
      .toBe('/preview/home?websiteId=w1&pageId=p1');
  });

  it('resolves /preview/home through owned hydrated website data instead of the CRM host', () => {
    expect(resolveAuthenticatedPreview({
      actingUserId: 'u1', path: '/home', explicitWebsiteId: 'w1', explicitPageId: 'p1',
      websites: [website(), website('foreign', 'u2')], routes: [route()], funnels: [funnel()], pages: [page()]
    })).toMatchObject({ status: 'resolved', target: { website: { id: 'w1' }, page: { id: 'p1' }, path: '/' } });
  });

  it('supports the legacy one-owned-website URL without query parameters', () => {
    expect(resolveAuthenticatedPreview({
      actingUserId: 'u1', path: '/home', websites: [website()], routes: [route()], funnels: [funnel()], pages: [page()]
    }).status).toBe('resolved');
  });

  it('fails closed for foreign website, page, funnel, or ambiguous website selection', () => {
    const common = { actingUserId: 'u1', path: '/home', routes: [route()], funnels: [funnel()], pages: [page()] };
    expect(resolveAuthenticatedPreview({ ...common, explicitWebsiteId: 'foreign', websites: [website(), website('foreign', 'u2')] }).status).toBe('not-found');
    expect(resolveAuthenticatedPreview({ ...common, explicitWebsiteId: 'w1', explicitPageId: 'foreign', websites: [website()] }).status).toBe('not-found');
    expect(resolveAuthenticatedPreview({ ...common, websites: [website(), website('w2')] }).status).toBe('selection-required');
    expect(resolveAuthenticatedPreview({ ...common, websites: [website()], funnels: [funnel('f1', 'u2')] }).status).toBe('not-found');
  });

  it('requires an exact owned WebsiteRoute and never falls back to home', () => {
    expect(resolveAuthenticatedPreview({
      actingUserId: 'u1', path: '/missing', explicitWebsiteId: 'w1', websites: [website()], routes: [route()], funnels: [funnel()], pages: [page()]
    }).status).toBe('not-found');
  });
});
