import { describe, it, expect } from 'vitest';
import type { Page, Website } from './types';
import type { EffectiveRoute } from './builder_route_lifecycle';
import {
  createPageRouteViewModel,
  mapRouteErrorCodeToMessage,
  validatePageRouteInput
} from './builder_page_route_model';

describe('Builder Page Route View Model & Validation', () => {
  const website: Website = {
    id: 'web-1',
    user_id: 'user-1',
    name: 'Wash Site',
    subdomain: 'wash-site',
    homepage_funnel_id: 'fnl-home',
    created_at: new Date().toISOString()
  };

  const pageHome: Page = {
    id: 'p-home',
    user_id: 'user-1',
    funnel_id: 'fnl-home',
    name: 'Home',
    slug: 'home',
    status: 'published',
    created_at: new Date().toISOString()
  };

  const pageServices: Page = {
    id: 'p-services',
    user_id: 'user-1',
    funnel_id: 'fnl-services',
    name: 'Services',
    slug: 'services',
    status: 'published',
    created_at: new Date().toISOString()
  };

  it('correctly models root homepage (uneditable via generic route controls)', () => {
    const vm = createPageRouteViewModel({
      page: pageHome,
      website,
      effectiveRoutes: [],
      isHomepage: true,
      isLiveHomepage: true
    });

    expect(vm.isRoot).toBe(true);
    expect(vm.isEditable).toBe(false);
    expect(vm.effectivePath).toBe('/');
    expect(vm.routeStatus).toBe('live');
    expect(vm.statusLabel).toBe('Home (Live)');
  });

  it('correctly models unrouted page', () => {
    const vm = createPageRouteViewModel({
      page: pageServices,
      website,
      effectiveRoutes: []
    });

    expect(vm.isRoot).toBe(false);
    expect(vm.isEditable).toBe(true);
    expect(vm.routeStatus).toBe('unrouted');
    expect(vm.statusLabel).toBe('No public URL');
    expect(vm.hasUnpublishedChanges).toBe(false);
  });

  it('correctly models normal live route', () => {
    const effectiveRoutes: EffectiveRoute[] = [{
      id: 'r-1',
      website_id: 'web-1',
      path: '/services',
      funnel_id: 'fnl-services',
      live_path: '/services',
      draft_path: null,
      is_draft_override: false,
      is_staged_delete: false,
      is_new_draft: false
    }];

    const vm = createPageRouteViewModel({
      page: pageServices,
      website,
      effectiveRoutes
    });

    expect(vm.routeStatus).toBe('live');
    expect(vm.statusLabel).toBe('Live');
    expect(vm.currentLivePath).toBe('/services');
    expect(vm.effectivePath).toBe('/services');
    expect(vm.hasUnpublishedChanges).toBe(false);
  });

  it('correctly models draft rename with live path preserved', () => {
    const effectiveRoutes: EffectiveRoute[] = [{
      id: 'r-1',
      website_id: 'web-1',
      path: '/pressure-washing',
      funnel_id: 'fnl-services',
      live_path: '/services',
      draft_path: '/pressure-washing',
      is_draft_override: true,
      is_staged_delete: false,
      is_new_draft: false
    }];

    const vm = createPageRouteViewModel({
      page: pageServices,
      website,
      effectiveRoutes
    });

    expect(vm.routeStatus).toBe('draft-rename');
    expect(vm.statusLabel).toBe('Unpublished URL');
    expect(vm.currentLivePath).toBe('/services');
    expect(vm.effectivePath).toBe('/pressure-washing');
    expect(vm.hasUnpublishedChanges).toBe(true);
    expect(vm.previewPath).toBe('/pressure-washing');
  });

  it('correctly models draft-only create', () => {
    const effectiveRoutes: EffectiveRoute[] = [{
      id: 'd-1',
      website_id: 'web-1',
      path: '/pricing',
      funnel_id: 'fnl-services',
      live_path: null,
      draft_path: '/pricing',
      is_draft_override: false,
      is_staged_delete: false,
      is_new_draft: true
    }];

    const vm = createPageRouteViewModel({
      page: pageServices,
      website,
      effectiveRoutes
    });

    expect(vm.routeStatus).toBe('draft-create');
    expect(vm.statusLabel).toBe('Unpublished URL');
    expect(vm.currentLivePath).toBeNull();
    expect(vm.effectivePath).toBe('/pricing');
    expect(vm.hasUnpublishedChanges).toBe(true);
  });

  it('correctly models staged delete', () => {
    const effectiveRoutes: EffectiveRoute[] = [{
      id: 'r-1',
      website_id: 'web-1',
      path: '/services',
      funnel_id: 'fnl-services',
      live_path: '/services',
      draft_path: '/services',
      is_draft_override: false,
      is_staged_delete: true,
      is_new_draft: false
    }];

    const vm = createPageRouteViewModel({
      page: pageServices,
      website,
      effectiveRoutes
    });

    expect(vm.routeStatus).toBe('draft-delete');
    expect(vm.statusLabel).toBe('URL removal pending');
    expect(vm.hasUnpublishedChanges).toBe(true);
  });

  it('validates and normalizes input paths', () => {
    const res = validatePageRouteInput('Services/Pressure-Washing/');
    expect(res.valid).toBe(true);
    expect(res.normalizedPath).toBe('/services/pressure-washing');
  });

  it('rejects root route input with domain error message', () => {
    const res = validatePageRouteInput('/');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('homepage URL is managed by its root route');
  });

  it('rejects reserved paths with clear error message', () => {
    const res = validatePageRouteInput('/api');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('reserved by WashOps');
  });

  it('rejects collisions with existing effective paths', () => {
    const res = validatePageRouteInput('services', ['/services', '/about'], '/contact');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('That URL is already being used by another page.');
  });

  it('maps domain error codes to helpful messages', () => {
    expect(mapRouteErrorCodeToMessage('COLLISION')).toBe('That URL is already being used by another page.');
    expect(mapRouteErrorCodeToMessage('UNPUBLISHED_DESTINATION')).toBe('Publish this page before making its URL live.');
    expect(mapRouteErrorCodeToMessage('CONFLICT')).toContain('changed elsewhere');
  });
});
