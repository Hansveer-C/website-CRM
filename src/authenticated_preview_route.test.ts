import { describe, expect, it } from 'vitest';
import type { Funnel, Page, Website, WebsiteRoute } from './types';
import { buildAuthenticatedPreviewUrl, resolveAuthenticatedPreview } from './authenticated_preview_route';

const website = (id = 'w1', user = 'u1', homepageFunnelId = 'f1'): Website => ({ id, user_id: user, name: id, domain: null, subdomain: id, homepage_funnel_id: homepageFunnelId, created_at: '', updated_at: '' });
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

  it.each([
    ['w1', 'p1', 'f1', 'WEBSITE_A_PAGE'],
    ['w2', 'p2', 'f2', 'WEBSITE_B_PAGE']
  ])('deterministically resolves the authoritative same-slug root Page for %s', (websiteId, pageId, funnelId, marker) => {
    const result = resolveAuthenticatedPreview({
      actingUserId: 'u1', path: '/home', explicitWebsiteId: websiteId, explicitPageId: pageId,
      websites: [website('w1', 'u1', 'f1'), website('w2', 'u1', 'f2')],
      routes: [route('/', 'w1', 'f1'), route('/', 'w2', 'f2')],
      funnels: [funnel('f1'), funnel('f2')],
      pages: [
        { ...page('p1', 'u1', 'f1'), name: 'WEBSITE_A_PAGE' },
        { ...page('p2', 'u1', 'f2'), name: 'WEBSITE_B_PAGE' }
      ]
    });
    expect(result).toMatchObject({
      status: 'resolved',
      target: {
        website: { id: websiteId }, route: { website_id: websiteId, funnel_id: funnelId },
        funnel: { id: funnelId }, page: { id: pageId, funnel_id: funnelId, name: marker }, path: '/'
      }
    });
    if (result.status === 'resolved') expect(result.target.page.name).not.toBe(websiteId === 'w1' ? 'WEBSITE_B_PAGE' : 'WEBSITE_A_PAGE');
  });

  it('rejects cross-Website routes, Pages from another Funnel, and Pages from another user', () => {
    const common = {
      actingUserId: 'u1', path: '/home', explicitWebsiteId: 'w2', explicitPageId: 'p2',
      websites: [website('w1', 'u1', 'f1'), website('w2', 'u1', 'f2')],
      funnels: [funnel('f1'), funnel('f2')]
    };
    expect(resolveAuthenticatedPreview({
      ...common, routes: [route('/', 'w1', 'f1')], pages: [page('p2', 'u1', 'f2')]
    }).status).toBe('not-found');
    expect(resolveAuthenticatedPreview({
      ...common, routes: [route('/', 'w2', 'f2')], pages: [page('p2', 'u1', 'f1')]
    }).status).toBe('not-found');
    expect(resolveAuthenticatedPreview({
      ...common, routes: [route('/', 'w2', 'f2')], pages: [page('p2', 'u2', 'f2')]
    }).status).toBe('not-found');
  });

  it('fails closed for a missing explicit Page and remains stable across repeat/direct resolution', () => {
    const input = {
      actingUserId: 'u1', path: '/home', explicitWebsiteId: 'w2', explicitPageId: 'missing',
      websites: [website('w2', 'u1', 'f2')], routes: [route('/', 'w2', 'f2')],
      funnels: [funnel('f2')], pages: [page('p2', 'u1', 'f2')]
    };
    expect(resolveAuthenticatedPreview(input).status).toBe('not-found');
    const exact = { ...input, explicitPageId: 'p2' };
    expect(resolveAuthenticatedPreview(exact)).toEqual(resolveAuthenticatedPreview(exact));
  });
});
