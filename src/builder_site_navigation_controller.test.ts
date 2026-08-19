import { describe, it, expect } from 'vitest';
import { BuilderSiteNavigationController } from './builder_site_navigation_controller';
import { MockBuilderSiteNavigationRepository } from './builder_site_navigation_repository';
import type { SiteNavigationItem } from './builder_site_navigation_domain';
import type { EffectiveRoute } from './builder_route_lifecycle';

describe('BuilderSiteNavigationController', () => {
  const routes: EffectiveRoute[] = [
    {
      id: 'r-home',
      website_id: 'site-1',
      funnel_id: 'fnl-home',
      path: '/',
      live_path: '/',
      draft_path: null,
      is_draft_override: false,
      is_new_draft: false,
      is_staged_delete: false
    },
    {
      id: 'r-serv',
      website_id: 'site-1',
      funnel_id: 'fnl-serv',
      path: '/services',
      live_path: '/services',
      draft_path: null,
      is_draft_override: false,
      is_new_draft: false,
      is_staged_delete: false
    }
  ];

  const context = {
    effectiveRoutes: routes,
    homepageFunnelId: 'fnl-home'
  };

  it('hydrates empty navigation state on initialization', async () => {
    const repo = new MockBuilderSiteNavigationRepository();
    const controller = new BuilderSiteNavigationController(repo);

    await controller.hydrate('site-1', context);
    const state = controller.getState();

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.websiteId).toBe('site-1');
      expect(state.items).toEqual([]);
      expect(state.isDraft).toBe(false);
      expect(state.baseRevision).toBe(0);
    }
  });

  it('stages draft items and updates resolved navigation state', async () => {
    const repo = new MockBuilderSiteNavigationRepository();
    repo.registerFunnel('fnl-home');
    repo.registerFunnel('fnl-serv');
    const controller = new BuilderSiteNavigationController(repo);

    await controller.hydrate('site-1', context);

    const itemsToStage: SiteNavigationItem[] = [
      { id: '1', label: 'Home', target_kind: 'internal', target_value: 'fnl-home', position: 0, visible: true, is_cta: false },
      { id: '2', label: 'Services', target_kind: 'internal', target_value: 'fnl-serv', position: 1, visible: true, is_cta: false },
      { id: '3', label: 'Call Us', target_kind: 'phone', target_value: '+15551234567', position: 2, visible: true, is_cta: true }
    ];

    const result = await controller.stageDraft(itemsToStage, context);
    expect(result.success).toBe(true);

    const state = controller.getState();
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.isDraft).toBe(true);
      expect(state.items.length).toBe(3);
      expect(state.items[0].resolved_href).toBe('/');
      expect(state.items[1].resolved_href).toBe('/services');
      expect(state.items[2].resolved_href).toBe('tel:+15551234567');
      expect(state.items[2].is_cta).toBe(true);
    }
  });

  it('handles draft revert cleanly back to live state', async () => {
    const repo = new MockBuilderSiteNavigationRepository();
    repo.registerFunnel('fnl-home');
    const liveItems: SiteNavigationItem[] = [
      { id: '1', label: 'Home', target_kind: 'internal', target_value: 'fnl-home', position: 0, visible: true, is_cta: false }
    ];
    repo.setLiveSnapshot('site-1', liveItems, 1);

    const controller = new BuilderSiteNavigationController(repo);
    await controller.hydrate('site-1', context);

    // Stage draft with extra item
    const draftItems: SiteNavigationItem[] = [
      { id: '1', label: 'Home', target_kind: 'internal', target_value: 'fnl-home', position: 0, visible: true, is_cta: false },
      { id: '2', label: 'Call Us', target_kind: 'phone', target_value: '+15551234567', position: 1, visible: true, is_cta: true }
    ];
    await controller.stageDraft(draftItems, context);

    expect((controller.getState() as any).isDraft).toBe(true);

    // Revert
    const revertRes = await controller.revertDraft(context);
    expect(revertRes.success).toBe(true);

    const finalState = controller.getState();
    expect(finalState.status).toBe('ready');
    if (finalState.status === 'ready') {
      expect(finalState.isDraft).toBe(false);
      expect(finalState.items.length).toBe(1);
      expect(finalState.items[0].label).toBe('Home');
    }
  });

  it('rejects stale draft write and reports conflict error', async () => {
    const repo = new MockBuilderSiteNavigationRepository();
    repo.registerFunnel('fnl-home');
    const liveItems: SiteNavigationItem[] = [
      { id: '1', label: 'Home', target_kind: 'internal', target_value: 'fnl-home', position: 0, visible: true, is_cta: false }
    ];
    repo.setLiveSnapshot('site-1', liveItems, 1);

    const controller = new BuilderSiteNavigationController(repo);
    await controller.hydrate('site-1', context);

    // Concurrently another session updates live to revision 2
    repo.setLiveSnapshot('site-1', liveItems, 2);

    const res = await controller.stageDraft(
      [{ id: '1', label: 'Home Edited', target_kind: 'internal', target_value: 'fnl-home', position: 0, visible: true, is_cta: false }],
      context
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('modified elsewhere');
  });

  it('discards out-of-order hydration responses across website switches', async () => {
    const repo = new MockBuilderSiteNavigationRepository();
    const controller = new BuilderSiteNavigationController(repo);

    let resolveSiteA: any;
    const pendingPromiseA = new Promise<any>(resolve => {
      resolveSiteA = resolve;
    });

    // Override getEffectiveNavigation to control timing
    repo.getEffectiveNavigation = async (siteId: string) => {
      if (siteId === 'site-A') {
        return pendingPromiseA;
      }
      return {
        success: true,
        data: {
          website_id: 'site-B',
          menu_scope: 'primary',
          items: [],
          raw_items: [],
          is_draft: false,
          base_revision: 1,
          live_revision: 1,
          updated_at: new Date().toISOString()
        }
      };
    };

    const pA = controller.hydrate('site-A', context);
    const pB = controller.hydrate('site-B', context);

    await pB;
    expect((controller.getState() as any).websiteId).toBe('site-B');

    // Late resolve of site A
    resolveSiteA({
      success: true,
      data: {
        website_id: 'site-A',
        menu_scope: 'primary',
        items: [],
        raw_items: [],
        is_draft: false,
        base_revision: 1,
        live_revision: 1,
        updated_at: new Date().toISOString()
      }
    });

    await pA;
    // Must remain site B
    expect((controller.getState() as any).websiteId).toBe('site-B');
  });
});
