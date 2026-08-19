import { describe, expect, it } from 'vitest';
import type { Funnel, Page, Website, WebsiteRoute } from './types';
import { createWebsiteDashboardModel, getWebsiteScopedPages, resolveActiveWebsite, resolveDashboardCurrentPage, resolveWebsiteHomepage } from './website_dashboard_model';

const site = (id: string, owner = 'u1', home: string | null = 'f-home'): Website => ({ id, user_id: owner, name: `Site ${id}`, domain: 'example.com', subdomain: 'example', homepage_funnel_id: home, created_at: '', updated_at: '' });
const funnel = (id: string, owner = 'u1'): Funnel => ({ id, user_id: owner, name: id, status: 'draft', created_at: '', updated_at: '' });
const page = (id: string, funnelId = 'f-home', values: Partial<Page> = {}): Page => ({ id, user_id: 'u1', name: id, slug: id, status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: funnelId, ...values });
const route = (websiteId: string, funnelId: string, path = '/'): WebsiteRoute => ({ id: `${websiteId}-${path}`, website_id: websiteId, funnel_id: funnelId, path, created_at: '' });

describe('active website resolution', () => {
  it('resolves one owned website and never mutates inputs', () => {
    const websites = [site('one'), site('foreign', 'u2')];
    const snapshot = JSON.stringify(websites);
    expect(resolveActiveWebsite({ actingUserId: 'u1', websites })).toMatchObject({ status: 'resolved', website: { id: 'one' } });
    expect(JSON.stringify(websites)).toBe(snapshot);
  });

  it('fails closed for an explicit missing or foreign website', () => {
    expect(resolveActiveWebsite({ actingUserId: 'u1', websites: [site('foreign', 'u2')], explicitWebsiteId: 'foreign' }).status).toBe('unavailable');
    expect(resolveActiveWebsite({ actingUserId: 'u1', websites: [site('one')], explicitWebsiteId: 'missing' }).status).toBe('unavailable');
  });

  it('requires selection for multiple sites unless the prior selection remains owned', () => {
    expect(resolveActiveWebsite({ actingUserId: 'u1', websites: [site('one'), site('two')] }).status).toBe('selection-required');
    expect(resolveActiveWebsite({ actingUserId: 'u1', websites: [site('one'), site('two')], previousWebsiteId: 'two' })).toMatchObject({ status: 'resolved', website: { id: 'two' } });
    expect(resolveActiveWebsite({ actingUserId: 'u2', websites: [site('one'), site('two')] }).status).toBe('empty');
  });
});

describe('homepage and page scope', () => {
  it('returns structured relationship failures', () => {
    expect(resolveWebsiteHomepage({ actingUserId: 'u1', website: site('one', 'u1', null), routes: [], funnels: [], pages: [] }).status).toBe('missing-homepage-funnel');
    expect(resolveWebsiteHomepage({ actingUserId: 'u1', website: site('one'), routes: [], funnels: [], pages: [] }).status).toBe('missing-funnel');
    expect(resolveWebsiteHomepage({ actingUserId: 'u1', website: site('one'), routes: [], funnels: [funnel('f-home', 'u2')], pages: [] }).status).toBe('ownership-mismatch');
    expect(resolveWebsiteHomepage({ actingUserId: 'u1', website: site('one'), routes: [], funnels: [funnel('f-home')], pages: [] }).status).toBe('no-homepage-page');
  });

  it('prefers slug home, then name Home, then finite step order and stable ID', () => {
    const base = { actingUserId: 'u1', website: site('one'), routes: [route('one', 'f-home')], funnels: [funnel('f-home')] };
    expect(resolveWebsiteHomepage({ ...base, pages: [page('a', 'f-home', { name: 'Home' }), page('z', 'f-home', { slug: 'home' })] })).toMatchObject({ status: 'resolved', page: { id: 'z' } });
    expect(resolveWebsiteHomepage({ ...base, pages: [page('a', 'f-home', { name: 'Home' }), page('z')] })).toMatchObject({ status: 'resolved', page: { id: 'a' } });
    expect(resolveWebsiteHomepage({ ...base, pages: [page('z', 'f-home', { step_order: 2 }), page('b', 'f-home', { step_order: 1 }), page('a', 'f-home', { step_order: 1 })] })).toMatchObject({ status: 'resolved', page: { id: 'a' } });
  });

  it('resolves draft_homepage_funnel_id when present', () => {
    const websiteWithDraft: Website = {
      ...site('one', 'u1', 'f-home'),
      draft_homepage_funnel_id: 'f-services'
    };
    const res = resolveWebsiteHomepage({
      actingUserId: 'u1',
      website: websiteWithDraft,
      routes: [route('one', 'f-home', '/'), route('one', 'f-services', '/services')],
      funnels: [funnel('f-home'), funnel('f-services')],
      pages: [page('p-home', 'f-home'), page('p-service', 'f-services')]
    });
    expect(res).toMatchObject({
      status: 'resolved',
      funnel: { id: 'f-services' },
      page: { id: 'p-service' }
    });
  });

  it('scopes and deduplicates pages through owned website funnels only', () => {
    const pages = [page('home'), page('service', 'f-service'), page('other', 'f-other'), page('foreign', 'f-home', { user_id: 'u2' })];
    const scoped = getWebsiteScopedPages({ actingUserId: 'u1', website: site('one'), routes: [route('one', 'f-service'), route('other-site', 'f-other')], funnels: [funnel('f-home'), funnel('f-service'), funnel('f-other')], pages });
    expect(scoped.map(item => item.id)).toEqual(['home', 'service']);
  });

  it('uses only an explicit scoped current page and otherwise the homepage', () => {
    const home = page('home');
    const homepage = { status: 'resolved', page: home, funnel: funnel('f-home'), route: undefined } as const;
    expect(resolveDashboardCurrentPage({ actingUserId: 'u1', explicitPageId: 'missing', scopedPages: [home], homepage })).toBeNull();
    expect(resolveDashboardCurrentPage({ actingUserId: 'u1', scopedPages: [home], homepage })).toBe(home);
  });
});

describe('dashboard model', () => {
  it('keeps legacy and Builder publication states distinct and allowlists output', () => {
    const model = createWebsiteDashboardModel({ actingUserId: 'u1', website: site('one'), routes: [route('one', 'f-home')], funnels: [funnel('f-home')], pages: [page('home', 'f-home', { slug: 'home', status: 'published' })], summary: { publicationState: 'never-published', mediaAssetCount: 3 } });
    expect(model.homepage.legacyPageStatus).toBe('published');
    expect(model.homepage.publicationState).toBe('never-published');
    expect(model.actions.viewLive.enabled).toBe(false);
    expect(model.counts.mediaAssets).toBe(3);
    expect(JSON.stringify(model)).not.toContain('user_id');
  });

  it('creates a live URL only from a safe host and an authoritative publication state', () => {
    const common = { actingUserId: 'u1', website: site('one'), routes: [route('one', 'f-home')], funnels: [funnel('f-home')], pages: [page('home', 'f-home', { slug: 'home' })] };
    expect(createWebsiteDashboardModel({ ...common, summary: { publicationState: 'published' } }).publicUrl).toBe('https://example.com/');
    expect(createWebsiteDashboardModel({ ...common, website: { ...site('one'), domain: 'bad/path' }, summary: { publicationState: 'published' } }).publicUrl).toBeNull();
  });
});
