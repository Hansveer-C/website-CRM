import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  convertLegacyLayoutToCanonicalDraft,
  checkNavigationPublicationReadiness,
  computeNavigationPublishDiff,
  getNavigationScopeAuthority,
  BuilderNavigationUiManager,
  renderBuilderNavigationPanel,
  renderNavigationItemCard,
  renderNavigationItemModal,
  renderNavigationPublishModal,
  NavigationUiContext
} from './builder_site_navigation_ui';
import { BuilderSiteNavigationController } from './builder_site_navigation_controller';
import { BuilderSiteNavigationPublishController } from './builder_site_navigation_publish_controller';
import { MockBuilderSiteNavigationRepository } from './builder_site_navigation_repository';
import type { EffectiveRoute } from './builder_route_lifecycle';
import type { Funnel, Page, Website, WebsiteLayout } from './types';
import type { SiteNavigationItem } from './builder_site_navigation_domain';

describe('Builder Site Navigation UI & Domain Integration', () => {
  const sampleWebsite: Website = {
    id: 'ws-100',
    user_id: 'usr-1',
    name: 'WashOps Pro',
    homepage_funnel_id: 'fn-home',
    published_status: 'published',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const sampleFunnels: Funnel[] = [
    { id: 'fn-home', website_id: 'ws-100', user_id: 'usr-1', name: 'Home Page', created_at: '', updated_at: '' },
    { id: 'fn-services', website_id: 'ws-100', user_id: 'usr-1', name: 'Services', created_at: '', updated_at: '' },
    { id: 'fn-about', website_id: 'ws-100', user_id: 'usr-1', name: 'About Us', created_at: '', updated_at: '' },
    { id: 'fn-pricing', website_id: 'ws-100', user_id: 'usr-1', name: 'Pricing', created_at: '', updated_at: '' }
  ];

  const samplePages: Page[] = [
    { id: 'pg-home', funnel_id: 'fn-home', user_id: 'usr-1', name: 'Home Page', slug: 'home', step_order: 0, created_at: '', updated_at: '' },
    { id: 'pg-services', funnel_id: 'fn-services', user_id: 'usr-1', name: 'Services', slug: 'services', step_order: 1, created_at: '', updated_at: '' },
    { id: 'pg-about', funnel_id: 'fn-about', user_id: 'usr-1', name: 'About Us', slug: 'about-us', step_order: 2, created_at: '', updated_at: '' },
    { id: 'pg-pricing', funnel_id: 'fn-pricing', user_id: 'usr-1', name: 'Pricing', slug: 'pricing', step_order: 3, created_at: '', updated_at: '' }
  ];

  const sampleEffectiveRoutes: EffectiveRoute[] = [
    { funnel_id: 'fn-home', path: '/', is_live: true, is_new_draft: false, is_draft_override: false, is_staged_delete: false, live_path: '/' },
    { funnel_id: 'fn-services', path: '/services', is_live: true, is_new_draft: false, is_draft_override: false, is_staged_delete: false, live_path: '/services' },
    { funnel_id: 'fn-about', path: '/about-us', is_live: true, is_new_draft: false, is_draft_override: false, is_staged_delete: false, live_path: '/about-us' }
  ];

  const sampleLegacyLayout: WebsiteLayout = {
    id: 'ly-100',
    website_id: 'ws-100',
    header_config: {
      nav_items: [
        { label: 'Home', path: '/', visible: true },
        { label: 'Services', path: '/services', visible: true },
        { label: 'External Blog', path: 'https://blog.example.com', visible: true },
        { label: 'Call Us', path: 'tel:+15551234567', visible: true },
        { label: 'Email', path: 'mailto:info@washops.com', visible: false },
        { label: 'Mystery Page', path: '/unknown-link-target', visible: true }
      ],
      cta_text: 'Book Now',
      cta_link: 'https://booking.example.com'
    },
    footer_config: {
      links: [
        { label: 'Home', url: '/' },
        { label: 'Services', url: '/services' },
        { label: 'Terms', url: 'https://example.com/terms' }
      ]
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const sampleContext: NavigationUiContext = {
    website: sampleWebsite,
    pages: samplePages,
    funnels: sampleFunnels,
    effectiveRoutes: sampleEffectiveRoutes,
    layout: sampleLegacyLayout,
    actingUserId: 'usr-1'
  };

  describe('Legacy Layout Conversion', () => {
    it('converts primary legacy layout items and preserves positions and targets', () => {
      let idCounter = 1;
      const uuidFactory = () => `00000000-0000-4000-8000-00000000000${idCounter++}`;

      const result = convertLegacyLayoutToCanonicalDraft('primary', sampleLegacyLayout, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages
      }, uuidFactory);

      expect(result.items.length).toBe(7); // 6 nav items + 1 header CTA
      
      // Item 0: Home -> homepage
      expect(result.items[0].label).toBe('Home');
      expect(result.items[0].target_kind).toBe('homepage');
      expect(result.items[0].target_value).toBe('__homepage__');
      expect(result.items[0].position).toBe(0);
      expect(result.items[0].visible).toBe(true);
      expect(result.items[0].is_cta).toBe(false);

      // Item 1: Services -> internal
      expect(result.items[1].label).toBe('Services');
      expect(result.items[1].target_kind).toBe('internal');
      expect(result.items[1].target_value).toBe('fn-services');
      expect(result.items[1].position).toBe(1);

      // Item 2: External Blog -> external
      expect(result.items[2].label).toBe('External Blog');
      expect(result.items[2].target_kind).toBe('external');
      expect(result.items[2].target_value).toBe('https://blog.example.com/');
      expect(result.items[2].position).toBe(2);

      // Item 3: Call Us -> phone
      expect(result.items[3].label).toBe('Call Us');
      expect(result.items[3].target_kind).toBe('phone');
      expect(result.items[3].target_value).toBe('+15551234567');

      // Item 4: Email -> email (visible: false)
      expect(result.items[4].label).toBe('Email');
      expect(result.items[4].target_kind).toBe('email');
      expect(result.items[4].target_value).toBe('info@washops.com');
      expect(result.items[4].visible).toBe(false);

      // Item 5: Mystery Page -> flagged as needsAttention, retained
      expect(result.items[5].label).toBe('Mystery Page');
      expect(result.items[5].target_kind).toBe('external');
      expect(result.items[5].target_value).toBe('https://example.com/unknown-link-target');
      expect(result.hasAttentionItems).toBe(true);
      expect(result.attentionCount).toBe(1);

      // Item 6: Header CTA Book Now
      expect(result.convertedCtaItem).not.toBeNull();
      expect(result.convertedCtaItem?.label).toBe('Book Now');
      expect(result.convertedCtaItem?.is_cta).toBe(true);
      expect(result.convertedCtaItem?.target_kind).toBe('external');
      expect(result.convertedCtaItem?.target_value).toBe('https://booking.example.com/');
    });

    it('does not duplicate legacy CTA if already present in nav_items', () => {
      const layoutWithDuplicateCta: WebsiteLayout = {
        id: 'ly-2',
        website_id: 'ws-100',
        header_config: {
          nav_items: [
            { label: 'Book Now', path: 'https://booking.example.com', visible: true }
          ],
          cta_text: 'Book Now',
          cta_link: 'https://booking.example.com'
        },
        footer_config: {},
        created_at: '',
        updated_at: ''
      };

      const result = convertLegacyLayoutToCanonicalDraft('primary', layoutWithDuplicateCta, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages
      });

      expect(result.items.length).toBe(1);
      expect(result.convertedCtaItem).toBeNull();
    });

    it('converts footer legacy links with correct targets and is_cta: false', () => {
      const result = convertLegacyLayoutToCanonicalDraft('footer', sampleLegacyLayout, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages
      });

      expect(result.items.length).toBe(3);
      expect(result.items[0].target_kind).toBe('homepage');
      expect(result.items[1].target_kind).toBe('internal');
      expect(result.items[1].target_value).toBe('fn-services');
      expect(result.items[2].target_kind).toBe('external');
      expect(result.items.every(i => !i.is_cta)).toBe(true);
    });
  });

  describe('Publication Readiness Checks', () => {
    it('passes readiness check when all visible destinations are live and valid', () => {
      const items: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false },
        { id: '33333333-3333-4333-8333-333333333333', label: 'Blog', target_kind: 'external', target_value: 'https://example.com/blog', position: 2, visible: true, is_cta: false }
      ];

      const check = checkNavigationPublicationReadiness(items, { effectiveRoutes: sampleEffectiveRoutes });
      expect(check.ready).toBe(true);
      expect(check.blockingItems.length).toBe(0);
    });

    it('blocks publication when visible internal link points to draft-only route', () => {
      const routesWithDraft: EffectiveRoute[] = [
        ...sampleEffectiveRoutes,
        { funnel_id: 'fn-pricing', path: '/pricing', is_live: false, is_new_draft: true, is_draft_override: false, is_staged_delete: false }
      ];

      const items: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Pricing', target_kind: 'internal', target_value: 'fn-pricing', position: 0, visible: true, is_cta: false }
      ];

      const check = checkNavigationPublicationReadiness(items, { effectiveRoutes: routesWithDraft });
      expect(check.ready).toBe(false);
      expect(check.blockingReason).toBe('draft_route');
      expect(check.message).toContain('Publish this page URL before publishing navigation');
      expect(check.blockingItems.length).toBe(1);
    });

    it('does not block publication if draft-only route item is marked hidden (visible: false)', () => {
      const routesWithDraft: EffectiveRoute[] = [
        ...sampleEffectiveRoutes,
        { funnel_id: 'fn-pricing', path: '/pricing', is_live: false, is_new_draft: true, is_draft_override: false, is_staged_delete: false }
      ];

      const items: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Pricing', target_kind: 'internal', target_value: 'fn-pricing', position: 0, visible: false, is_cta: false }
      ];

      const check = checkNavigationPublicationReadiness(items, { effectiveRoutes: routesWithDraft });
      expect(check.ready).toBe(true);
    });

    it('blocks publication when destination route is scheduled for removal', () => {
      const routesWithDelete: EffectiveRoute[] = [
        ...sampleEffectiveRoutes,
        { funnel_id: 'fn-pricing', path: '/pricing', is_live: true, is_new_draft: false, is_draft_override: false, is_staged_delete: true }
      ];

      const items: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Pricing', target_kind: 'internal', target_value: 'fn-pricing', position: 0, visible: true, is_cta: false }
      ];

      const check = checkNavigationPublicationReadiness(items, { effectiveRoutes: routesWithDelete });
      expect(check.ready).toBe(false);
      expect(check.blockingReason).toBe('pending_deletion');
    });

    it('blocks publication if external URL is invalid or malformed', () => {
      const items: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Bad Link', target_kind: 'external', target_value: 'javascript:alert(1)', position: 0, visible: true, is_cta: false }
      ];

      const check = checkNavigationPublicationReadiness(items, { effectiveRoutes: sampleEffectiveRoutes });
      expect(check.ready).toBe(false);
      expect(check.blockingItems[0].reason).toContain('http');
    });
  });

  describe('Publish Diff Computation', () => {
    it('accurately identifies additions, removals, updates, and reorderings', () => {
      const liveItems: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false },
        { id: '33333333-3333-4333-8333-333333333333', label: 'Old Link', target_kind: 'external', target_value: 'https://example.com/old', position: 2, visible: true, is_cta: false }
      ];

      const draftItems: SiteNavigationItem[] = [
        { id: '22222222-2222-4222-8222-222222222222', label: 'Our Services', target_kind: 'internal', target_value: 'fn-services', position: 0, visible: true, is_cta: false },
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 1, visible: false, is_cta: false },
        { id: '44444444-4444-4444-8444-444444444444', label: 'Contact', target_kind: 'external', target_value: 'https://example.com/contact', position: 2, visible: true, is_cta: true }
      ];

      const diff = computeNavigationPublishDiff(liveItems, draftItems);
      expect(diff.totalCount).toBe(3);
      expect(diff.addedCount).toBe(1); // item-4
      expect(diff.removedCount).toBe(1); // item-3
      expect(diff.updatedCount).toBe(1); // item-2 label changed
      expect(diff.visibilityChangedCount).toBe(1); // item-1 hidden
      expect(diff.ctaChangedCount).toBe(0); // item-4 is counted as added, not existing cta changed
      expect(diff.isExplicitEmpty).toBe(false);
    });

    it('detects explicit empty publish summary', () => {
      const liveItems: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ];

      const diff = computeNavigationPublishDiff(liveItems, []);
      expect(diff.totalCount).toBe(0);
      expect(diff.isExplicitEmpty).toBe(true);
      expect(diff.removedCount).toBe(1);
    });
  });

  describe('BuilderNavigationUiManager', () => {
    let repo: MockBuilderSiteNavigationRepository;
    let controller: BuilderSiteNavigationController;
    let publishController: BuilderSiteNavigationPublishController;
    let manager: BuilderNavigationUiManager;

    beforeEach(async () => {
      repo = new MockBuilderSiteNavigationRepository();
      controller = new BuilderSiteNavigationController(repo);
      publishController = new BuilderSiteNavigationPublishController(repo);
      manager = new BuilderNavigationUiManager(controller, publishController);

      await controller.hydrate('ws-100', {
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      }, 'primary');
    });

    it('initializes with primary scope and manages scope switching', () => {
      expect(manager.getActiveScope()).toBe('primary');
      manager.setActiveScope('footer');
      expect(manager.getActiveScope()).toBe('footer');
    });

    it('opens add modal, validates input, and stages new navigation item', async () => {
      manager.openAddItemModal();
      const modal = manager.getItemModalState();
      expect(modal.isOpen).toBe(true);
      expect(modal.mode).toBe('add');

      // Test validation error on empty label
      manager.setItemModalField('label', '');
      const failSave = await manager.saveItemModal({
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(failSave).toBe(false);
      expect(manager.getItemModalState().errorMessage).toContain('cannot be empty');

      // Test valid submission
      manager.setItemModalField('label', 'Services');
      manager.setItemModalField('targetKind', 'internal');
      manager.setItemModalField('targetValue', 'fn-services');
      manager.setItemModalField('isCta', true);

      const successSave = await manager.saveItemModal({
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(successSave).toBe(true);
      expect(manager.getItemModalState().isOpen).toBe(false);

      const state = controller.getState();
      expect(state.status).toBe('ready');
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(true);
        expect(state.rawItems.length).toBe(1);
        expect(state.rawItems[0].label).toBe('Services');
        expect(state.rawItems[0].is_cta).toBe(true);
      }
    });

    it('opens edit modal and updates existing item', async () => {
      // Stage an item first
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Old Label', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      const state = controller.getState();
      if (state.status !== 'ready') throw new Error('Not ready');

      manager.openEditItemModal(state.rawItems[0]);
      expect(manager.getItemModalState().isOpen).toBe(true);
      expect(manager.getItemModalState().label).toBe('Old Label');

      manager.setItemModalField('label', 'New Home Label');
      const saved = await manager.saveItemModal({
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(saved).toBe(true);

      const updatedState = controller.getState();
      if (updatedState.status === 'ready') {
        expect(updatedState.rawItems[0].label).toBe('New Home Label');
        expect(updatedState.rawItems[0].id).toBe('11111111-1111-4111-8111-111111111111'); // Preserves UUID
      }
    });

    it('supports reordering items up and down', async () => {
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Item 1', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '22222222-2222-4222-8222-222222222222', label: 'Item 2', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      // Move it-2 up
      const moveRes = await manager.moveItem('22222222-2222-4222-8222-222222222222', 'up', {
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(moveRes).toBe(true);

      const state = controller.getState();
      if (state.status === 'ready') {
        expect(state.rawItems[0].id).toBe('22222222-2222-4222-8222-222222222222');
        expect(state.rawItems[0].position).toBe(0);
        expect(state.rawItems[1].id).toBe('11111111-1111-4111-8111-111111111111');
        expect(state.rawItems[1].position).toBe(1);
      }
    });

    it('toggles item visibility and removes item', async () => {
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Item 1', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      // Toggle visibility
      await manager.toggleItemVisibility('11111111-1111-4111-8111-111111111111', {
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      let state = controller.getState();
      if (state.status === 'ready') {
        expect(state.rawItems[0].visible).toBe(false);
      }

      // Remove item
      await manager.removeItem('11111111-1111-4111-8111-111111111111', {
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      state = controller.getState();
      if (state.status === 'ready') {
        expect(state.rawItems.length).toBe(0);
        expect(state.isDraft).toBe(true);
      }
    });

    it('adopts legacy layout into canonical draft', async () => {
      const adopted = await manager.adoptLegacy(sampleLegacyLayout, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages,
        homepageFunnelId: 'fn-home'
      });
      expect(adopted).toBe(true);

      const state = controller.getState();
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(true);
        expect(state.rawItems.length).toBe(7);
      }
    });

    it('manages publication modal and publishes draft successfully', async () => {
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      manager.openPublishModal();
      expect(manager.getPublishModalState().isOpen).toBe(true);

      const pubRes = await manager.confirmPublish({
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(pubRes).toBe(true);
      expect(manager.getPublishModalState().isOpen).toBe(false);

      const state = controller.getState();
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(false);
        expect(state.liveRevision).toBe(1);
      }
    });
  });

  describe('HTML Renderers & Visual States', () => {
    let repo: MockBuilderSiteNavigationRepository;
    let controller: BuilderSiteNavigationController;
    let publishController: BuilderSiteNavigationPublishController;
    let manager: BuilderNavigationUiManager;

    beforeEach(async () => {
      repo = new MockBuilderSiteNavigationRepository();
      controller = new BuilderSiteNavigationController(repo);
      publishController = new BuilderSiteNavigationPublishController(repo);
      manager = new BuilderNavigationUiManager(controller, publishController);
      await controller.hydrate('ws-100', {
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      }, 'primary');
    });

    it('renders legacy read-only view when authority is legacy', () => {
      const state = controller.getState();
      const html = renderBuilderNavigationPanel(state, manager, sampleContext);
      
      expect(html).toContain('Legacy navigation');
      expect(html).toContain('Convert to Editable Navigation');
      expect(html).toContain('pb-nav-item-legacy');
      expect(html).toContain('Read-only');
    });

    it('renders canonical draft list with action buttons', async () => {
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 0, visible: true, is_cta: true }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      const state = controller.getState();
      const html = renderBuilderNavigationPanel(state, manager, sampleContext);

      expect(html).toContain('Unpublished changes');
      expect(html).toContain('Draft in Progress');
      expect(html).toContain('+ Add Item');
      expect(html).toContain('Publish Primary');
      expect(html).toContain('Services');
      expect(html).toContain('CTA');
    });

    it('renders explicit empty menu state when 0 items configured', async () => {
      await controller.stageDraft([], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      const state = controller.getState();
      const html = renderBuilderNavigationPanel(state, manager, sampleContext);

      expect(html).toContain('Explicit Empty Menu');
      expect(html).toContain('0 links');
      expect(html).toContain('+ Add First Link');
    });

    it('renders item modal markup with accessible fields', () => {
      manager.openAddItemModal();
      const html = renderNavigationItemModal(manager.getItemModalState(), sampleContext);

      expect(html).toContain('role="dialog"');
      expect(html).toContain('Add Navigation Item');
      expect(html).toContain('id="nav-item-label-input"');
      expect(html).toContain('id="nav-item-kind-select"');
      expect(html).toContain('Show as CTA button');
      expect(html).toContain('Visible in menu');
    });

    it('renders publish confirmation modal markup with diff summary', async () => {
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      manager.openPublishModal();
      const html = renderNavigationPublishModal(manager.getPublishModalState());

      expect(html).toContain('Publish Primary Menu');
      expect(html).toContain('Summary of Changes');
      expect(html).toContain('total menu links');
      expect(html).toContain('Publish Primary Menu');
    });

    it('renders conflict banner with Reload Latest button when conflict error occurs', async () => {
      // Simulate conflict error in state
      (controller as any).state = {
        status: 'ready',
        websiteId: 'ws-100',
        menuScope: 'primary',
        items: [],
        rawItems: [],
        isDraft: true,
        baseRevision: 0,
        draftRevision: 1,
        liveRevision: 0,
        isSaving: false,
        errorMessage: 'The navigation draft was modified elsewhere. Reload and try again.'
      };

      const state = controller.getState();
      const html = renderBuilderNavigationPanel(state, manager, sampleContext);

      expect(html).toContain('Concurrency Conflict');
      expect(html).toContain('Reload Latest');
    });
  });

  describe('Edge Cases & Advanced Workflows', () => {
    let repo: MockBuilderSiteNavigationRepository;
    let controller: BuilderSiteNavigationController;
    let publishController: BuilderSiteNavigationPublishController;
    let manager: BuilderNavigationUiManager;

    beforeEach(async () => {
      repo = new MockBuilderSiteNavigationRepository();
      controller = new BuilderSiteNavigationController(repo);
      publishController = new BuilderSiteNavigationPublishController(repo);
      manager = new BuilderNavigationUiManager(controller, publishController);
      await controller.hydrate('ws-100', {
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      }, 'primary');
    });

    it('determines scope authority correctly across all lifecycle states', () => {
      // Uninitialized -> legacy
      expect(getNavigationScopeAuthority(null)).toBe('legacy');

      // Ready, liveRevision: 0, isDraft: false -> legacy
      expect(getNavigationScopeAuthority({
        status: 'ready',
        websiteId: 'ws-100',
        menuScope: 'primary',
        items: [],
        rawItems: [],
        isDraft: false,
        baseRevision: 0,
        draftRevision: 0,
        liveRevision: 0,
        isSaving: false,
        errorMessage: null
      })).toBe('legacy');

      // Ready, liveRevision: 0, isDraft: true -> draft
      expect(getNavigationScopeAuthority({
        status: 'ready',
        websiteId: 'ws-100',
        menuScope: 'primary',
        items: [],
        rawItems: [],
        isDraft: true,
        baseRevision: 0,
        draftRevision: 1,
        liveRevision: 0,
        isSaving: false,
        errorMessage: null
      })).toBe('draft');

      // Ready, liveRevision: 1, isDraft: false -> live
      expect(getNavigationScopeAuthority({
        status: 'ready',
        websiteId: 'ws-100',
        menuScope: 'primary',
        items: [],
        rawItems: [],
        isDraft: false,
        baseRevision: 1,
        draftRevision: 0,
        liveRevision: 1,
        isSaving: false,
        errorMessage: null
      })).toBe('live');

      // Ready, liveRevision: 1, isDraft: true -> draft
      expect(getNavigationScopeAuthority({
        status: 'ready',
        websiteId: 'ws-100',
        menuScope: 'primary',
        items: [],
        rawItems: [],
        isDraft: true,
        baseRevision: 1,
        draftRevision: 2,
        liveRevision: 1,
        isSaving: false,
        errorMessage: null
      })).toBe('draft');
    });

    it('rejects malformed external URLs with invalid hostnames or schemes', async () => {
      manager.openAddItemModal();
      manager.setItemModalField('label', 'Broken Link');
      manager.setItemModalField('targetKind', 'external');

      // Javascript URI
      manager.setItemModalField('targetValue', 'javascript:alert(1)');
      let saved = await manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });
      expect(saved).toBe(false);
      expect(manager.getItemModalState().errorMessage).toContain('http');

      // FTP scheme
      manager.setItemModalField('targetValue', 'ftp://files.example.com');
      saved = await manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });
      expect(saved).toBe(false);

      // Invalid characters in host
      manager.setItemModalField('targetValue', 'https://example..com');
      saved = await manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });
      expect(saved).toBe(false);
    });

    it('rejects invalid phone numbers and invalid email addresses', async () => {
      manager.openAddItemModal();
      manager.setItemModalField('label', 'Contact Phone');
      manager.setItemModalField('targetKind', 'phone');

      // Invalid phone
      manager.setItemModalField('targetValue', 'abc-def-ghij');
      let saved = await manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });
      expect(saved).toBe(false);
      expect(manager.getItemModalState().errorMessage).toContain('phone');

      // Invalid email
      manager.setItemModalField('targetKind', 'email');
      manager.setItemModalField('targetValue', 'not-an-email');
      saved = await manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });
      expect(saved).toBe(false);
      expect(manager.getItemModalState().errorMessage).toContain('email');
    });

    it('handles moving items at boundary indices without errors', async () => {
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Item 1', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '22222222-2222-4222-8222-222222222222', label: 'Item 2', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      // Move top item up -> false (no change)
      const topUp = await manager.moveItem('11111111-1111-4111-8111-111111111111', 'up', { effectiveRoutes: sampleEffectiveRoutes });
      expect(topUp).toBe(false);

      // Move bottom item down -> false (no change)
      const botDown = await manager.moveItem('22222222-2222-4222-8222-222222222222', 'down', { effectiveRoutes: sampleEffectiveRoutes });
      expect(botDown).toBe(false);
    });

    it('reverts draft back to live items baseline', async () => {
      // Set live snapshot with 1 item
      repo.setLiveSnapshot('ws-100', [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Live Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], 1, 'primary');

      await controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' }, 'primary');

      // Stage draft with 2 items
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Live Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '22222222-2222-4222-8222-222222222222', label: 'Draft Services', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      expect(controller.getState().isDraft).toBe(true);

      // Revert draft
      const revertRes = await controller.revertDraft({ effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });
      expect(revertRes.success).toBe(true);

      const state = controller.getState();
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(false);
        expect(state.rawItems.length).toBe(1);
        expect(state.rawItems[0].label).toBe('Live Home');
      }
    });

    it('handles explicit empty menu publication which suppresses legacy fallback', async () => {
      // Stage empty draft
      await controller.stageDraft([], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });
      expect(controller.getState().isDraft).toBe(true);

      // Publish empty menu
      const pubRes = await manager.confirmPublish({ effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });
      expect(pubRes).toBe(true);

      const state = controller.getState();
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(false);
        expect(state.liveRevision).toBe(1);
        expect(state.rawItems.length).toBe(0);
        // Authority is now 'live', NOT 'legacy'
        expect(getNavigationScopeAuthority(state)).toBe('live');
      }
    });
  });
});
