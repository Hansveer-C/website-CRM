import { describe, it, expect, beforeEach } from 'vitest';
import type { Page, Website } from './types';
import {
  mockWebsites,
  mockFunnels,
  mockPages,
  mockWebsiteRoutes
} from './db';
import {
  mockBuilderRouteDrafts,
  mockWebsiteRouteRedirects
} from './builder_route_repository';
import { BuilderPageRouteController } from './builder_page_route_controller';

describe('BuilderPageRouteController', () => {
  const userId = 'user-123';
  const websiteId = 'web-123';
  const funnelHome = 'fnl-home';
  const funnelServices = 'fnl-services';

  const website: Website = {
    id: websiteId,
    user_id: userId,
    name: 'Test Wash',
    subdomain: 'test-wash',
    homepage_funnel_id: funnelHome,
    created_at: new Date().toISOString()
  };

  const pageHome: Page = {
    id: 'p-home',
    user_id: userId,
    funnel_id: funnelHome,
    name: 'Home',
    slug: 'home',
    status: 'published',
    created_at: new Date().toISOString()
  };

  const pageServices: Page = {
    id: 'p-services',
    user_id: userId,
    funnel_id: funnelServices,
    name: 'Services',
    slug: 'services',
    status: 'published',
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    mockWebsites.length = 0;
    mockFunnels.length = 0;
    mockPages.length = 0;
    mockWebsiteRoutes.length = 0;
    mockBuilderRouteDrafts.length = 0;
    mockWebsiteRouteRedirects.length = 0;

    mockWebsites.push(website);
    mockFunnels.push(
      { id: funnelHome, user_id: userId, name: 'Home' },
      { id: funnelServices, user_id: userId, name: 'Services' }
    );
    mockPages.push(pageHome, pageServices);
    mockWebsiteRoutes.push(
      { id: 'r-root', website_id: websiteId, path: '/', funnel_id: funnelHome, created_at: new Date().toISOString() },
      { id: 'r-services', website_id: websiteId, path: '/services', funnel_id: funnelServices, created_at: new Date().toISOString() }
    );
  });

  it('hydrates effective routes and computes page route view models', async () => {
    const controller = new BuilderPageRouteController({ actingUserId: userId });
    await controller.hydrate(websiteId);

    const homeVM = controller.getPageRoute(pageHome, website, { isHomepage: true });
    expect(homeVM.isRoot).toBe(true);
    expect(homeVM.effectivePath).toBe('/');
    expect(homeVM.isEditable).toBe(false);

    const servicesVM = controller.getPageRoute(pageServices, website);
    expect(servicesVM.isRoot).toBe(false);
    expect(servicesVM.effectivePath).toBe('/services');
    expect(servicesVM.routeStatus).toBe('live');
  });

  it('stages draft rename through openEditor -> updateEditorInput -> saveEditorRoute', async () => {
    const controller = new BuilderPageRouteController({ actingUserId: userId });
    await controller.hydrate(websiteId);

    expect(controller.openEditor(pageServices, website)).toBe(true);
    controller.updateEditorInput('Pressure-Washing', website);
    expect(controller.getState().normalizedEditingPath).toBe('/pressure-washing');

    const saved = await controller.saveEditorRoute(pageServices, website);
    expect(saved).toBe(true);

    const servicesVM = controller.getPageRoute(pageServices, website);
    expect(servicesVM.routeStatus).toBe('draft-rename');
    expect(servicesVM.effectivePath).toBe('/pressure-washing');
    expect(servicesVM.currentLivePath).toBe('/services');
    expect(servicesVM.hasUnpublishedChanges).toBe(true);
    expect(controller.getPendingDraftCount()).toBe(1);
  });

  it('prevents opening editor for root homepage', async () => {
    const controller = new BuilderPageRouteController({ actingUserId: userId });
    await controller.hydrate(websiteId);

    expect(controller.openEditor(pageHome, website, true)).toBe(false);
    expect(controller.getState().isEditing).toBe(false);
  });

  it('reverts draft changes cleanly back to live state', async () => {
    const controller = new BuilderPageRouteController({ actingUserId: userId });
    await controller.hydrate(websiteId);

    controller.openEditor(pageServices, website);
    controller.updateEditorInput('Pressure-Washing', website);
    await controller.saveEditorRoute(pageServices, website);
    expect(controller.getPendingDraftCount()).toBe(1);

    const reverted = await controller.revertRoute(pageServices, website);
    expect(reverted).toBe(true);

    const servicesVM = controller.getPageRoute(pageServices, website);
    expect(servicesVM.routeStatus).toBe('live');
    expect(servicesVM.effectivePath).toBe('/services');
    expect(controller.getPendingDraftCount()).toBe(0);
  });

  it('stages route deletion and reflects draft-delete status', async () => {
    const controller = new BuilderPageRouteController({ actingUserId: userId });
    await controller.hydrate(websiteId);

    controller.promptDeleteRoute(pageServices.id);
    expect(controller.getState().isConfirmingDelete).toBe(true);

    const deleted = await controller.confirmDeleteRoute(pageServices, website);
    expect(deleted).toBe(true);

    const servicesVM = controller.getPageRoute(pageServices, website);
    expect(servicesVM.routeStatus).toBe('draft-delete');
    expect(servicesVM.statusLabel).toBe('URL removal pending');
    expect(controller.getPendingDraftCount()).toBe(1);
  });

  it('publishes pending route changes atomically and rehydrates', async () => {
    const controller = new BuilderPageRouteController({ actingUserId: userId });
    await controller.hydrate(websiteId);

    // Stage rename
    controller.openEditor(pageServices, website);
    controller.updateEditorInput('/pressure-washing', website);
    await controller.saveEditorRoute(pageServices, website);
    expect(controller.getPendingDraftCount()).toBe(1);

    // Open publish modal & publish
    controller.openPublishModal();
    expect(controller.getState().isConfirmingPublish).toBe(true);

    const published = await controller.publishPendingRoutes(websiteId);
    expect(published).toBe(true);
    expect(controller.getState().isConfirmingPublish).toBe(false);
    expect(controller.getPendingDraftCount()).toBe(0);

    const servicesVM = controller.getPageRoute(pageServices, website);
    expect(servicesVM.routeStatus).toBe('live');
    expect(servicesVM.effectivePath).toBe('/pressure-washing');
    expect(servicesVM.currentLivePath).toBe('/pressure-washing');
  });

  it('cancels stale hydration requests across website switches', async () => {
    const controller = new BuilderPageRouteController({ actingUserId: userId });

    const p1 = controller.hydrate('web-old');
    const p2 = controller.hydrate(websiteId);

    await Promise.all([p1, p2]);
    expect(controller.getState().websiteId).toBe(websiteId);
  });
});
