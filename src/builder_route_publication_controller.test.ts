import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderRoutePublicationController } from './builder_route_publication_controller';
import { mockBuilderRouteDrafts, mockWebsiteRouteRedirects } from './builder_route_repository';
import { mockWebsites, mockWebsiteRoutes, mockFunnels, mockPages } from './db';

describe('BuilderRoutePublicationController', () => {
  const testUserId = 'usr-pub-ctrl-test';
  const testWebsiteId = 'ws-pub-ctrl-test';
  const testFunnel1 = 'fnl-pub-ctrl-1';
  const testFunnel2 = 'fnl-pub-ctrl-2';

  beforeEach(() => {
    mockBuilderRouteDrafts.length = 0;
    mockWebsiteRouteRedirects.length = 0;

    mockWebsites.length = 0;
    mockWebsites.push({
      id: testWebsiteId,
      user_id: testUserId,
      name: 'Test Site',
      domain: null,
      subdomain: 'test-site',
      homepage_funnel_id: testFunnel1,
      draft_homepage_funnel_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as any);

    mockFunnels.length = 0;
    mockFunnels.push(
      { id: testFunnel1, user_id: testUserId, name: 'Home Funnel' } as any,
      { id: testFunnel2, user_id: testUserId, name: 'Services Funnel' } as any
    );

    mockPages.length = 0;
    mockPages.push(
      { id: 'p1', user_id: testUserId, funnel_id: testFunnel1, name: 'Home', slug: 'home', status: 'published', step_order: 0 } as any,
      { id: 'p2', user_id: testUserId, funnel_id: testFunnel2, name: 'Services', slug: 'services', status: 'published', step_order: 0 } as any
    );

    mockWebsiteRoutes.length = 0;
    mockWebsiteRoutes.push(
      { id: 'r-root', website_id: testWebsiteId, path: '/', funnel_id: testFunnel1, created_at: new Date().toISOString() },
      { id: 'r-services', website_id: testWebsiteId, path: '/services', funnel_id: testFunnel2, created_at: new Date().toISOString() }
    );
  });

  it('starts in idle state', () => {
    const ctrl = new BuilderRoutePublicationController();
    expect(ctrl.getState()).toEqual({
      status: 'idle',
      publishedCount: 0,
      code: null,
      errorMessage: null,
      lastPublishedAt: null
    });
  });

  it('publishes staged route rename and creates 308 redirect', async () => {
    const ctrl = new BuilderRoutePublicationController();

    // Stage rename /services -> /pressure-washing
    mockBuilderRouteDrafts.push({
      id: 'd-rename',
      website_id: testWebsiteId,
      route_id: 'r-services',
      path: '/pressure-washing',
      funnel_id: testFunnel2,
      action: 'upsert',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const result = await ctrl.publish(testWebsiteId, { actingUserId: testUserId });

    expect(result.status).toBe('success');
    expect(result.publishedCount).toBe(1);
    expect(result.code).toBe('SUCCESS');

    // Live route updated
    const liveRoute = mockWebsiteRoutes.find(r => r.id === 'r-services');
    expect(liveRoute?.path).toBe('/pressure-washing');

    // Redirect created
    const redirect = mockWebsiteRouteRedirects.find(rd => rd.website_id === testWebsiteId && rd.from_path === '/services');
    expect(redirect?.to_path).toBe('/pressure-washing');

    // Drafts cleared
    expect(mockBuilderRouteDrafts.length).toBe(0);
  });

  it('handles publication conflict when draft count changes', async () => {
    const ctrl = new BuilderRoutePublicationController();

    mockBuilderRouteDrafts.push({
      id: 'd-1',
      website_id: testWebsiteId,
      route_id: null,
      path: '/about',
      funnel_id: testFunnel2,
      action: 'upsert',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const result = await ctrl.publish(testWebsiteId, {
      actingUserId: testUserId,
      expectedDraftCount: 2 // Stale count!
    });

    expect(result.status).toBe('conflict');
    expect(result.code).toBe('CONFLICT');
    expect(mockBuilderRouteDrafts.length).toBe(1); // Not cleared!
  });

  it('rejects unauthorized publication attempt', async () => {
    const ctrl = new BuilderRoutePublicationController();
    const result = await ctrl.publish(testWebsiteId, { actingUserId: '' });
    expect(result.status).toBe('error');
    expect(result.code).toBe('UNAUTHORIZED');
  });
});
