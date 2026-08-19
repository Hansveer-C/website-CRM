import { describe, it, expect, beforeEach } from 'vitest';
import type { Page, Website, Funnel, WebsiteRoute } from './types';
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
import {
  createPageRouteViewModel,
  validatePageRouteInput,
  mapRouteErrorCodeToMessage
} from './builder_page_route_model';

describe('Builder Route UI & Pages Integration (Phase 1B / Task 5C)', () => {
  const userId = 'user-test-5c';
  const websiteId = 'web-test-5c';
  const funnelHome = 'fnl-home-5c';
  const funnelServices = 'fnl-services-5c';
  const funnelAbout = 'fnl-about-5c';

  const website: Website = {
    id: websiteId,
    user_id: userId,
    name: 'Clean Wash Pro',
    subdomain: 'clean-wash',
    homepage_funnel_id: funnelHome,
    created_at: new Date().toISOString()
  };

  const pageHome: Page = {
    id: 'p-home-5c',
    user_id: userId,
    funnel_id: funnelHome,
    name: 'Home',
    slug: 'home',
    status: 'published',
    created_at: new Date().toISOString()
  };

  const pageServices: Page = {
    id: 'p-services-5c',
    user_id: userId,
    funnel_id: funnelServices,
    name: 'Services',
    slug: 'services',
    status: 'published',
    created_at: new Date().toISOString()
  };

  const pageAbout: Page = {
    id: 'p-about-5c',
    user_id: userId,
    funnel_id: funnelAbout,
    name: 'About Us',
    slug: 'about',
    status: 'draft',
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
      { id: funnelServices, user_id: userId, name: 'Services' },
      { id: funnelAbout, user_id: userId, name: 'About' }
    );
    mockPages.push(pageHome, pageServices, pageAbout);
    mockWebsiteRoutes.push(
      { id: 'r-root', website_id: websiteId, path: '/', funnel_id: funnelHome, created_at: new Date().toISOString() },
      { id: 'r-services', website_id: websiteId, path: '/services', funnel_id: funnelServices, created_at: new Date().toISOString() }
    );
  });

  describe('Route View Model Authority & Display Rules', () => {
    it('preserves root route immutability for homepage', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      const vm = controller.getPageRoute(pageHome, website, { isHomepage: true, isLiveHomepage: true });
      expect(vm.isRoot).toBe(true);
      expect(vm.isEditable).toBe(false);
      expect(vm.effectivePath).toBe('/');
      expect(vm.displayPath).toBe('/');
      expect(vm.statusLabel).toBe('Home (Live)');
      expect(vm.hasUnpublishedChanges).toBe(false);
    });

    it('identifies unrouted page and provides fallback slug path', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      const vm = controller.getPageRoute(pageAbout, website);
      expect(vm.isRoot).toBe(false);
      expect(vm.isEditable).toBe(true);
      expect(vm.routeStatus).toBe('unrouted');
      expect(vm.statusLabel).toBe('No public URL');
      expect(vm.currentLivePath).toBeNull();
      expect(vm.hasUnpublishedChanges).toBe(false);
      expect(vm.effectivePath).toBe('/about');
    });

    it('displays live published route with no pending changes', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      const vm = controller.getPageRoute(pageServices, website);
      expect(vm.routeStatus).toBe('live');
      expect(vm.statusLabel).toBe('Live');
      expect(vm.currentLivePath).toBe('/services');
      expect(vm.effectivePath).toBe('/services');
      expect(vm.hasUnpublishedChanges).toBe(false);
    });
  });

  describe('Route Editing Lifecycle (Stage, Validate, Revert, Publish)', () => {
    it('stages a draft rename and retains current live path', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      // Open editor
      expect(controller.openEditor(pageServices, website)).toBe(true);
      expect(controller.getState().isEditing).toBe(true);
      expect(controller.getState().editingPageId).toBe(pageServices.id);

      // Update input with normalization
      controller.updateEditorInput('Power-Washing-Services', website);
      expect(controller.getState().normalizedEditingPath).toBe('/power-washing-services');
      expect(controller.getState().editingValidationIssue).toBeNull();

      // Save draft
      const saved = await controller.saveEditorRoute(pageServices, website);
      expect(saved).toBe(true);
      expect(controller.getState().isEditing).toBe(false);

      // Verify route VM
      const vm = controller.getPageRoute(pageServices, website);
      expect(vm.routeStatus).toBe('draft-rename');
      expect(vm.statusLabel).toBe('Unpublished URL');
      expect(vm.currentLivePath).toBe('/services');
      expect(vm.effectivePath).toBe('/power-washing-services');
      expect(vm.hasUnpublishedChanges).toBe(true);
      expect(vm.previewPath).toBe('/power-washing-services');

      expect(controller.getPendingDraftCount()).toBe(1);
    });

    it('stages a draft creation for unrouted page', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      controller.openEditor(pageAbout, website);
      controller.updateEditorInput('/about-us', website);
      const saved = await controller.saveEditorRoute(pageAbout, website);
      expect(saved).toBe(true);

      const vm = controller.getPageRoute(pageAbout, website);
      expect(vm.routeStatus).toBe('draft-create');
      expect(vm.statusLabel).toBe('Unpublished URL');
      expect(vm.currentLivePath).toBeNull();
      expect(vm.effectivePath).toBe('/about-us');
      expect(vm.hasUnpublishedChanges).toBe(true);
    });

    it('rejects collisions against existing routes during input validation', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      controller.openEditor(pageAbout, website);
      controller.updateEditorInput('/services', website);
      expect(controller.getState().editingValidationIssue).toBe('That URL is already being used by another page.');

      const saved = await controller.saveEditorRoute(pageAbout, website);
      expect(saved).toBe(false);
      expect(controller.getPendingDraftCount()).toBe(0);
    });

    it('rejects reserved system routes during input validation', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      controller.openEditor(pageAbout, website);
      controller.updateEditorInput('/api/checkout', website);
      expect(controller.getState().editingValidationIssue).toContain('reserved by WashOps');

      const saved = await controller.saveEditorRoute(pageAbout, website);
      expect(saved).toBe(false);
    });

    it('reverts draft changes cleanly back to pristine live state', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      // Stage rename
      controller.openEditor(pageServices, website);
      controller.updateEditorInput('/commercial-washing', website);
      await controller.saveEditorRoute(pageServices, website);
      expect(controller.getPendingDraftCount()).toBe(1);

      // Revert
      const reverted = await controller.revertRoute(pageServices, website);
      expect(reverted).toBe(true);
      expect(controller.getPendingDraftCount()).toBe(0);

      const vm = controller.getPageRoute(pageServices, website);
      expect(vm.routeStatus).toBe('live');
      expect(vm.effectivePath).toBe('/services');
      expect(vm.hasUnpublishedChanges).toBe(false);
    });

    it('stages route deletion and removes during atomic publication', async () => {
      const controller = new BuilderPageRouteController({ actingUserId: userId });
      await controller.hydrate(websiteId);

      // Prompt delete
      controller.promptDeleteRoute(pageServices.id);
      expect(controller.getState().isConfirmingDelete).toBe(true);

      // Confirm delete
      const deleted = await controller.confirmDeleteRoute(pageServices, website);
      expect(deleted).toBe(true);

      const vm = controller.getPageRoute(pageServices, website);
      expect(vm.routeStatus).toBe('draft-delete');
      expect(vm.statusLabel).toBe('URL removal pending');
      expect(controller.getPendingDraftCount()).toBe(1);

      // Publish deletion
      controller.openPublishModal();
      const published = await controller.publishPendingRoutes(websiteId);
      expect(published).toBe(true);
      expect(controller.getPendingDraftCount()).toBe(0);

      // Live route should now be gone
      const postPublishVM = controller.getPageRoute(pageServices, website);
      expect(postPublishVM.routeStatus).toBe('unrouted');
      expect(postPublishVM.currentLivePath).toBeNull();
    });
  });
});
