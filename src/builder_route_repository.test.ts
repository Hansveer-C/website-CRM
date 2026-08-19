import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBuilderRouteDraft,
  deleteBuilderRouteDraft,
  revertBuilderRouteDraft,
  getBuilderEffectiveRoutes,
  publishBuilderRoutes,
  mockBuilderRouteDrafts,
  mockWebsiteRouteRedirects
} from './builder_route_repository';
import { mockWebsiteRoutes, mockWebsites, mockFunnels } from './db';

describe('builder_route_repository - In-Memory Draft Operations', () => {
  const userId = 'usr-route-test-1';
  const websiteId = 'ws-route-test-1';
  const funnel1 = 'fnl-services-1';
  const funnel2 = 'fnl-about-2';
  const funnel3 = 'fnl-pricing-3';

  beforeEach(() => {
    mockBuilderRouteDrafts.length = 0;
    mockWebsites.length = 0;
    mockFunnels.length = 0;
    mockWebsiteRoutes.length = 0;

    mockWebsites.push({
      id: websiteId,
      user_id: userId,
      name: 'Test Site',
      subdomain: 'test-site',
      homepage_funnel_id: 'fnl-home',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    mockFunnels.push(
      { id: 'fnl-home', user_id: userId, name: 'Home' },
      { id: funnel1, user_id: userId, name: 'Services' },
      { id: funnel2, user_id: userId, name: 'About' },
      { id: funnel3, user_id: userId, name: 'Pricing' }
    );

    mockWebsiteRoutes.push(
      { id: 'r-home', website_id: websiteId, path: '/', funnel_id: 'fnl-home', created_at: new Date().toISOString() },
      { id: 'r-1', website_id: websiteId, path: '/services', funnel_id: funnel1, created_at: new Date().toISOString() },
      { id: 'r-2', website_id: websiteId, path: '/about', funnel_id: funnel2, created_at: new Date().toISOString() }
    );
  });

  it('rejects unauthenticated caller', async () => {
    const res = await setBuilderRouteDraft({
      websiteId,
      funnelId: funnel1,
      path: '/new-services'
    });
    expect(res.success).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED');
  });

  it('stages draft rename without mutating live routes', async () => {
    const res = await setBuilderRouteDraft(
      {
        websiteId,
        funnelId: funnel1,
        path: 'pressure-washing',
        routeId: 'r-1'
      },
      userId
    );

    expect(res.success).toBe(true);
    expect(res.code).toBe('SUCCESS');
    expect(res.data?.draft?.path).toBe('/pressure-washing');
    expect(res.data?.draft?.action).toBe('upsert');

    // Live route remains 100% UNTOUCHED
    const live = mockWebsiteRoutes.find(r => r.id === 'r-1');
    expect(live?.path).toBe('/services');
  });

  it('reverts draft to live if draft path equals live path', async () => {
    // Stage rename
    await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/new-services', routeId: 'r-1' }, userId);
    expect(mockBuilderRouteDrafts).toHaveLength(1);

    // Set back to live path '/services'
    const revertRes = await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/services', routeId: 'r-1' }, userId);
    expect(revertRes.success).toBe(true);
    expect(revertRes.data?.draft).toBeNull();
    expect(mockBuilderRouteDrafts).toHaveLength(0);
  });

  it('rejects collision with another live path', async () => {
    // Attempt to rename funnel1 ('/services') to '/about' (which is already live for funnel2)
    const res = await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/about', routeId: 'r-1' }, userId);
    expect(res.success).toBe(false);
    expect(res.code).toBe('COLLISION');
  });

  it('rejects root route "/" modification', async () => {
    const res = await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/', routeId: 'r-1' }, userId);
    expect(res.success).toBe(false);
    expect(res.code).toBe('ROOT_ROUTE_RESERVED');
  });

  it('rejects reserved system route modification', async () => {
    const res = await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/api/test', routeId: 'r-1' }, userId);
    expect(res.success).toBe(false);
    expect(res.code).toBe('RESERVED_PATH');
  });

  it('stages deletion of an existing live route', async () => {
    const res = await deleteBuilderRouteDraft({ websiteId, routeId: 'r-2' }, userId);
    expect(res.success).toBe(true);
    expect(res.data?.draft?.action).toBe('delete');

    // Live route remains intact
    const live = mockWebsiteRoutes.find(r => r.id === 'r-2');
    expect(live?.path).toBe('/about');
  });

  it('rejects deletion of root homepage route', async () => {
    const res = await deleteBuilderRouteDraft({ websiteId, routeId: 'r-home' }, userId);
    expect(res.success).toBe(false);
    expect(res.code).toBe('ROOT_ROUTE_RESERVED');
  });

  it('returns effective routes merged across live and draft states', async () => {
    // Stage rename for r-1 to '/pressure-washing'
    await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/pressure-washing', routeId: 'r-1' }, userId);
    // Stage delete for r-2
    await deleteBuilderRouteDraft({ websiteId, routeId: 'r-2' }, userId);
    // Stage new draft route for funnel3
    await setBuilderRouteDraft({ websiteId, funnelId: funnel3, path: '/pricing' }, userId);

    const effective = await getBuilderEffectiveRoutes(websiteId, userId);
    expect(effective.success).toBe(true);
    const routes = effective.data?.routes || [];

    const home = routes.find(r => r.funnel_id === 'fnl-home');
    expect(home?.path).toBe('/');
    expect(home?.is_draft_override).toBe(false);

    const services = routes.find(r => r.funnel_id === funnel1);
    expect(services?.path).toBe('/pressure-washing');
    expect(services?.live_path).toBe('/services');
    expect(services?.is_draft_override).toBe(true);
    expect(services?.is_staged_delete).toBe(false);

    const about = routes.find(r => r.funnel_id === funnel2);
    expect(about?.path).toBe('/about');
    expect(about?.is_staged_delete).toBe(true);

    const pricing = routes.find(r => r.funnel_id === funnel3);
    expect(pricing?.path).toBe('/pricing');
    expect(pricing?.is_new_draft).toBe(true);
    expect(pricing?.live_path).toBeNull();
  });

  it('atomically publishes route drafts and creates redirects', async () => {
    // Stage rename: /services -> /pressure-washing
    await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/pressure-washing', routeId: 'r-1' }, userId);
    // Stage delete: /about
    await deleteBuilderRouteDraft({ websiteId, routeId: 'r-2' }, userId);
    // Stage create: /pricing
    await setBuilderRouteDraft({ websiteId, funnelId: funnel3, path: '/pricing' }, userId);

    expect(mockBuilderRouteDrafts).toHaveLength(3);

    const pubRes = await publishBuilderRoutes({ websiteId }, userId);
    expect(pubRes.success).toBe(true);
    expect(pubRes.data?.published_count).toBe(3);

    // Drafts cleared
    expect(mockBuilderRouteDrafts).toHaveLength(0);

    // Live routes updated
    const servicesRoute = mockWebsiteRoutes.find(r => r.id === 'r-1');
    expect(servicesRoute?.path).toBe('/pressure-washing');

    const aboutRoute = mockWebsiteRoutes.find(r => r.id === 'r-2');
    expect(aboutRoute).toBeUndefined(); // Deleted

    const pricingRoute = mockWebsiteRoutes.find(r => r.funnel_id === funnel3);
    expect(pricingRoute?.path).toBe('/pricing');

    // Redirect created for rename
    const redirect = mockWebsiteRouteRedirects.find(rd => rd.website_id === websiteId && rd.from_path === '/services');
    expect(redirect?.to_path).toBe('/pressure-washing');
  });

  it('collapses sequential rename redirect chains during publication', async () => {
    // Initial rename: /services -> /pressure-washing
    await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/pressure-washing', routeId: 'r-1' }, userId);
    await publishBuilderRoutes({ websiteId }, userId);

    expect(mockWebsiteRouteRedirects).toContainEqual(expect.objectContaining({
      from_path: '/services',
      to_path: '/pressure-washing'
    }));

    // Second rename: /pressure-washing -> /exterior-cleaning
    await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/exterior-cleaning', routeId: 'r-1' }, userId);
    await publishBuilderRoutes({ websiteId }, userId);

    // Both old paths now point directly to the latest path
    const servicesRedirect = mockWebsiteRouteRedirects.find(rd => rd.from_path === '/services');
    const pressureRedirect = mockWebsiteRouteRedirects.find(rd => rd.from_path === '/pressure-washing');

    expect(servicesRedirect?.to_path).toBe('/exterior-cleaning');
    expect(pressureRedirect?.to_path).toBe('/exterior-cleaning');
  });

  it('rejects publication when optimistic draft count is stale', async () => {
    await setBuilderRouteDraft({ websiteId, funnelId: funnel1, path: '/pressure-washing', routeId: 'r-1' }, userId);

    const pubRes = await publishBuilderRoutes({ websiteId, expectedDraftCount: 5 }, userId);
    expect(pubRes.success).toBe(false);
    expect(pubRes.code).toBe('CONFLICT');
    expect(mockBuilderRouteDrafts).toHaveLength(1); // Not deleted
  });
});
