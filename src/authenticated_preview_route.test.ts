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

  it('resolves draft_homepage_funnel_id override for root path while live route remains untouched', () => {
    const siteWithDraft: Website = {
      ...website('w1', 'u1', 'f1'),
      homepage_funnel_id: 'f1',
      draft_homepage_funnel_id: 'f2'
    };

    const res = resolveAuthenticatedPreview({
      actingUserId: 'u1',
      path: '/',
      explicitWebsiteId: 'w1',
      websites: [siteWithDraft],
      routes: [route('/', 'w1', 'f1'), route('/services', 'w1', 'f2')],
      funnels: [funnel('f1'), funnel('f2')],
      pages: [
        { ...page('p1', 'u1', 'f1'), name: 'Live Home Page' },
        { ...page('p2', 'u1', 'f2'), name: 'Draft Home Page' }
      ]
    });

    expect(res).toMatchObject({
      status: 'resolved',
      target: {
        website: { id: 'w1' },
        funnel: { id: 'f2' },
        page: { id: 'p2', name: 'Draft Home Page' },
        path: '/'
      }
    });
  });

  it('resolves draft renamed route while old live route returns not-found in preview', () => {
    const resNew = resolveAuthenticatedPreview({
      actingUserId: 'u1',
      path: '/pressure-washing',
      explicitWebsiteId: 'w1',
      websites: [website('w1', 'u1', 'f1')],
      routes: [route('/services', 'w1', 'f2')],
      funnels: [funnel('f1'), funnel('f2')],
      pages: [{ ...page('p2', 'u1', 'f2'), name: 'Services Page', slug: 'services' }],
      routeDrafts: [{
        id: 'd1',
        website_id: 'w1',
        route_id: 'w1:/services',
        path: '/pressure-washing',
        funnel_id: 'f2',
        action: 'upsert',
        created_at: '',
        updated_at: ''
      }]
    });

    expect(resNew).toMatchObject({
      status: 'resolved',
      target: {
        website: { id: 'w1' },
        funnel: { id: 'f2' },
        page: { id: 'p2' },
        path: '/pressure-washing'
      }
    });

    // Old live path is superseded in preview
    const resOld = resolveAuthenticatedPreview({
      actingUserId: 'u1',
      path: '/services',
      explicitWebsiteId: 'w1',
      websites: [website('w1', 'u1', 'f1')],
      routes: [route('/services', 'w1', 'f2')],
      funnels: [funnel('f1'), funnel('f2')],
      pages: [{ ...page('p2', 'u1', 'f2'), name: 'Services Page', slug: 'services' }],
      routeDrafts: [{
        id: 'd1',
        website_id: 'w1',
        route_id: 'w1:/services',
        path: '/pressure-washing',
        funnel_id: 'f2',
        action: 'upsert',
        created_at: '',
        updated_at: ''
      }]
    });

    expect(resOld.status).toBe('not-found');
  });

  it('resolves draft-only created route in preview', () => {
    const res = resolveAuthenticatedPreview({
      actingUserId: 'u1',
      path: '/pricing',
      explicitWebsiteId: 'w1',
      websites: [website('w1', 'u1', 'f1')],
      routes: [route('/', 'w1', 'f1')],
      funnels: [funnel('f1'), funnel('f3')],
      pages: [{ ...page('p3', 'u1', 'f3'), name: 'Pricing Page', slug: 'pricing' }],
      routeDrafts: [{
        id: 'd2',
        website_id: 'w1',
        route_id: null,
        path: '/pricing',
        funnel_id: 'f3',
        action: 'upsert',
        created_at: '',
        updated_at: ''
      }]
    });

    expect(res).toMatchObject({
      status: 'resolved',
      target: {
        website: { id: 'w1' },
        funnel: { id: 'f3' },
        page: { id: 'p3' },
        path: '/pricing'
      }
    });
  });

  it('returns not-found in preview for staged deleted route', () => {
    const res = resolveAuthenticatedPreview({
      actingUserId: 'u1',
      path: '/about',
      explicitWebsiteId: 'w1',
      websites: [website('w1', 'u1', 'f1')],
      routes: [route('/', 'w1', 'f1'), route('/about', 'w1', 'f2')],
      funnels: [funnel('f1'), funnel('f2')],
      pages: [{ ...page('p2', 'u1', 'f2'), name: 'About Page', slug: 'about' }],
      routeDrafts: [{
        id: 'd3',
        website_id: 'w1',
        route_id: 'w1:/about',
        path: '/about',
        funnel_id: 'f2',
        action: 'delete',
        created_at: '',
        updated_at: ''
      }]
    });

    expect(res.status).toBe('not-found');
  });

  it('rejects foreign user route drafts (tenant isolation)', () => {
    const res = resolveAuthenticatedPreview({
      actingUserId: 'u1',
      path: '/secret-draft',
      explicitWebsiteId: 'w1',
      websites: [website('w1', 'u1', 'f1')],
      routes: [route('/', 'w1', 'f1')],
      funnels: [funnel('f1'), funnel('f2', 'u2')], // foreign funnel
      pages: [page('p2', 'u2', 'f2')],
      routeDrafts: [{
        id: 'd-foreign',
        website_id: 'foreign-site',
        route_id: null,
        path: '/secret-draft',
        funnel_id: 'f2',
        action: 'upsert',
        created_at: '',
        updated_at: ''
      }]
    });

    expect(res.status).toBe('not-found');
  });

  describe('authenticated preview navigation authority', () => {
    it('prefers canonical draft navigation over live navigation and legacy layout', () => {
      const res = resolveAuthenticatedPreview({
        actingUserId: 'u1',
        path: '/',
        explicitWebsiteId: 'w1',
        websites: [website('w1', 'u1', 'f1')],
        routes: [route('/', 'w1', 'f1'), route('/services', 'w1', 'f2')],
        funnels: [funnel('f1'), funnel('f2'), funnel('f3')],
        pages: [page('p1', 'u1', 'f1')],
        canonicalNavLive: [{
          website_id: 'w1',
          menu_scope: 'primary',
          items: [
            { id: '11111111-1111-4111-8111-111111111111', label: 'Live Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
          ]
        }],
        canonicalNavDrafts: [{
          website_id: 'w1',
          menu_scope: 'primary',
          items: [
            { id: '11111111-1111-4111-8111-111111111111', label: 'Draft Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
            { id: '22222222-2222-4222-8222-222222222222', label: 'Draft Services', target_kind: 'internal', target_value: 'f2', position: 1, visible: true, is_cta: false },
            { id: '33333333-3333-4333-8333-333333333333', label: 'Get Quote', target_kind: 'external', target_value: 'https://quote.example.com', position: 2, visible: true, is_cta: true }
          ]
        }]
      });

      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.target.effectiveNavigation?.source).toBe('canonical-draft');
        expect(res.target.effectiveNavigation?.primary).toEqual([
          expect.objectContaining({ label: 'Draft Home', resolved_href: '/', resolution_status: 'resolved' }),
          expect.objectContaining({ label: 'Draft Services', resolved_href: '/services', resolution_status: 'resolved' }),
          expect.objectContaining({ label: 'Get Quote', resolved_href: 'https://quote.example.com', resolution_status: 'resolved', is_cta: true })
        ]);
      }
    });

    it('resolves draft route rename and draft route create in preview navigation', () => {
      const res = resolveAuthenticatedPreview({
        actingUserId: 'u1',
        path: '/',
        explicitWebsiteId: 'w1',
        websites: [website('w1', 'u1', 'f1')],
        routes: [route('/', 'w1', 'f1'), route('/old-services', 'w1', 'f2')],
        funnels: [funnel('f1'), funnel('f2'), funnel('f3')],
        pages: [page('p1', 'u1', 'f1')],
        routeDrafts: [
          // Draft rename: /old-services -> /pressure-washing (f2)
          { id: 'd1', website_id: 'w1', route_id: 'w1:/old-services', path: '/pressure-washing', funnel_id: 'f2', action: 'upsert', created_at: '', updated_at: '' },
          // Draft create: /about (f3)
          { id: 'd2', website_id: 'w1', route_id: null, path: '/about-us', funnel_id: 'f3', action: 'upsert', created_at: '', updated_at: '' }
        ],
        canonicalNavDrafts: [{
          website_id: 'w1',
          menu_scope: 'primary',
          items: [
            { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'f2', position: 0, visible: true, is_cta: false },
            { id: '33333333-3333-4333-8333-333333333333', label: 'About', target_kind: 'internal', target_value: 'f3', position: 1, visible: true, is_cta: false }
          ]
        }]
      });

      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.target.effectiveNavigation?.primary).toEqual([
          expect.objectContaining({ label: 'Services', resolved_href: '/pressure-washing', resolution_status: 'resolved' }),
          expect.objectContaining({ label: 'About', resolved_href: '/about-us', resolution_status: 'resolved' })
        ]);
      }
    });

    it('marks staged deleted route as pending_deletion with resolved_href = null', () => {
      const res = resolveAuthenticatedPreview({
        actingUserId: 'u1',
        path: '/',
        explicitWebsiteId: 'w1',
        websites: [website('w1', 'u1', 'f1')],
        routes: [route('/', 'w1', 'f1'), route('/services', 'w1', 'f2')],
        funnels: [funnel('f1'), funnel('f2')],
        pages: [page('p1', 'u1', 'f1')],
        routeDrafts: [
          { id: 'd1', website_id: 'w1', route_id: 'w1:/services', path: '/services', funnel_id: 'f2', action: 'delete', created_at: '', updated_at: '' }
        ],
        canonicalNavDrafts: [{
          website_id: 'w1',
          menu_scope: 'primary',
          items: [
            { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'f2', position: 0, visible: true, is_cta: false }
          ]
        }]
      });

      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.target.effectiveNavigation?.primary).toEqual([
          expect.objectContaining({ label: 'Services', resolved_href: null, resolution_status: 'pending_deletion' })
        ]);
      }
    });

    it('handles mixed-source Case A: primary legacy and footer canonical live', () => {
      const res = resolveAuthenticatedPreview({
        actingUserId: 'u1',
        path: '/',
        explicitWebsiteId: 'w1',
        websites: [website('w1', 'u1', 'f1')],
        routes: [route('/', 'w1', 'f1'), route('/terms', 'w1', 'f2')],
        funnels: [funnel('f1'), funnel('f2')],
        pages: [page('p1', 'u1', 'f1')],
        legacyLayout: {
          headerConfig: {
            nav_items: [{ label: 'Legacy Header Item', path: '/' }]
          }
        },
        canonicalNavLive: [{
          website_id: 'w1',
          menu_scope: 'footer',
          items: [
            { id: '44444444-4444-4444-8444-444444444444', label: 'Canonical Live Footer', target_kind: 'internal', target_value: 'f2', position: 0, visible: true, is_cta: false }
          ]
        }]
      });

      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.target.effectiveNavigation?.primarySource).toBe('legacy');
        expect(res.target.effectiveNavigation?.footerSource).toBe('canonical-live');
        expect(res.target.effectiveNavigation?.primary).toEqual([
          expect.objectContaining({ label: 'Legacy Header Item', resolved_href: '/' })
        ]);
        expect(res.target.effectiveNavigation?.footer).toEqual([
          expect.objectContaining({ label: 'Canonical Live Footer', resolved_href: '/terms' })
        ]);
      }
    });

    it('handles mixed-source Case B: primary canonical live and footer canonical draft', () => {
      const res = resolveAuthenticatedPreview({
        actingUserId: 'u1',
        path: '/',
        explicitWebsiteId: 'w1',
        websites: [website('w1', 'u1', 'f1')],
        routes: [route('/', 'w1', 'f1'), route('/contact', 'w1', 'f2')],
        funnels: [funnel('f1'), funnel('f2')],
        pages: [page('p1', 'u1', 'f1')],
        canonicalNavLive: [{
          website_id: 'w1',
          menu_scope: 'primary',
          items: [
            { id: '11111111-1111-4111-8111-111111111111', label: 'Live Primary Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
          ]
        }],
        canonicalNavDrafts: [{
          website_id: 'w1',
          menu_scope: 'footer',
          items: [
            { id: '55555555-5555-4555-8555-555555555555', label: 'Draft Footer Contact', target_kind: 'internal', target_value: 'f2', position: 0, visible: true, is_cta: false }
          ]
        }]
      });

      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.target.effectiveNavigation?.primarySource).toBe('canonical-live');
        expect(res.target.effectiveNavigation?.footerSource).toBe('canonical-draft');
        expect(res.target.effectiveNavigation?.primary).toEqual([
          expect.objectContaining({ label: 'Live Primary Home', resolved_href: '/' })
        ]);
        expect(res.target.effectiveNavigation?.footer).toEqual([
          expect.objectContaining({ label: 'Draft Footer Contact', resolved_href: '/contact' })
        ]);
      }
    });

    it('handles Case C: primary explicit empty canonical draft does not fall back to legacy header', () => {
      const res = resolveAuthenticatedPreview({
        actingUserId: 'u1',
        path: '/',
        explicitWebsiteId: 'w1',
        websites: [website('w1', 'u1', 'f1')],
        routes: [route('/', 'w1', 'f1')],
        funnels: [funnel('f1')],
        pages: [page('p1', 'u1', 'f1')],
        legacyLayout: {
          headerConfig: {
            nav_items: [{ label: 'Legacy Header Item', path: '/' }]
          },
          footerConfig: {
            links: [{ label: 'Legacy Footer Link', path: '/legacy' }]
          }
        },
        canonicalNavDrafts: [{
          website_id: 'w1',
          menu_scope: 'primary',
          items: []
        }]
      });

      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.target.effectiveNavigation?.primarySource).toBe('canonical-draft');
        expect(res.target.effectiveNavigation?.footerSource).toBe('legacy');
        expect(res.target.effectiveNavigation?.primary).toEqual([]);
        expect(res.target.effectiveNavigation?.footer).toEqual([
          expect.objectContaining({ label: 'Legacy Footer Link', resolved_href: '/legacy' })
        ]);
      }
    });
  });
});
