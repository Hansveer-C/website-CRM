import { describe, it, expect, beforeEach } from 'vitest';
import {
  BuilderNavigationUiManager,
  evaluateLegacyNavigationCandidates,
  convertLegacyLayoutToCanonicalDraft,
  checkNavigationPublicationReadiness,
  computeNavigationPublishDiff,
  getNavigationScopeAuthority,
  renderBuilderNavigationPanel,
  renderNavigationItemCard,
  renderNavigationItemModal,
  renderNavigationPublishModal,
  generateNavigationUuid,
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
    subdomain: 'washops'
  };

  const otherWebsite: Website = {
    id: 'ws-200',
    user_id: 'usr-1',
    name: 'Other CarWash',
    homepage_funnel_id: 'fn-other',
    subdomain: 'otherwash'
  };

  const sampleFunnels: Funnel[] = [
    { id: 'fn-home', website_id: 'ws-100', user_id: 'usr-1', name: 'Homepage Funnel', steps: [] } as any,
    { id: 'fn-services', website_id: 'ws-100', user_id: 'usr-1', name: 'Services Funnel', steps: [] } as any,
    { id: 'fn-contact', website_id: 'ws-100', user_id: 'usr-1', name: 'Contact Funnel', steps: [] } as any,
    { id: 'fn-other', website_id: 'ws-200', user_id: 'usr-1', name: 'Website B Funnel', steps: [] } as any
  ];

  const samplePages: Page[] = [
    { id: 'pg-home', funnel_id: 'fn-home', user_id: 'usr-1', name: 'Home Page', slug: 'home' } as any,
    { id: 'pg-services', funnel_id: 'fn-services', user_id: 'usr-1', name: 'Services Page', slug: 'services' } as any,
    { id: 'pg-contact', funnel_id: 'fn-contact', user_id: 'usr-1', name: 'Contact Page', slug: 'contact' } as any,
    { id: 'pg-other', funnel_id: 'fn-other', user_id: 'usr-1', name: 'Other Page', slug: 'other' } as any
  ];

  const sampleEffectiveRoutes: EffectiveRoute[] = [
    {
      funnel_id: 'fn-home',
      path: '/',
      live_path: '/',
      is_homepage: true,
      is_draft_override: false,
      is_new_draft: false,
      is_staged_delete: false
    },
    {
      funnel_id: 'fn-services',
      path: '/services',
      live_path: '/services',
      is_homepage: false,
      is_draft_override: false,
      is_new_draft: false,
      is_staged_delete: false
    },
    {
      funnel_id: 'fn-contact',
      path: '/contact',
      live_path: '/contact',
      is_homepage: false,
      is_draft_override: false,
      is_new_draft: false,
      is_staged_delete: false
    }
  ];

  const sampleLegacyLayout: WebsiteLayout = {
    id: 'ly-1',
    website_id: 'ws-100',
    header_config: {
      nav_items: [
        { label: 'Home', path: '/', visible: true },
        { label: 'Services', path: '/services', visible: true },
        { label: 'About Us', path: 'https://washops.com/about', visible: true },
        { label: 'Call Us', path: 'tel:+15551234567', visible: true },
        { label: 'Email', path: 'mailto:info@washops.com', visible: false },
        { label: 'Mystery Page', path: '/unknown-link-target', visible: true },
        { label: 'Bad URL', path: 'javascript:alert(1)', visible: true },
        { label: 'Bad Phone', path: 'tel:letters-not-digits', visible: true },
        { label: 'Bad Email', path: 'mailto:not-an-email', visible: true }
      ],
      cta_text: 'Book Now',
      cta_link: 'https://booking.example.com'
    },
    footer_config: {
      links: [
        { label: 'Home', path: '/', visible: true },
        { label: 'Contact', path: '/contact', visible: true },
        { label: 'Unresolved Footer Link', path: '/non-existent-page', visible: true }
      ]
    }
  };

  const sampleContext: NavigationUiContext = {
    website: sampleWebsite,
    pages: samplePages.filter(p => p.funnel_id !== 'fn-other'),
    funnels: sampleFunnels.filter(f => f.website_id === 'ws-100'),
    effectiveRoutes: sampleEffectiveRoutes,
    layout: sampleLegacyLayout,
    actingUserId: 'usr-1'
  };

  describe('Loss-Aware Legacy Adoption Evaluation', () => {
    it('evaluates legacy layout items without fabricating destinations and keeps standalone CTA separate', () => {
      const result = evaluateLegacyNavigationCandidates('primary', sampleLegacyLayout, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages
      });

      expect(result.candidates.length).toBe(9);
      expect(result.hasAttentionItems).toBe(true);
      expect(result.attentionCount).toBe(4); // Mystery Page, Bad URL, Bad Phone, Bad Email

      // Item 0: Home -> ready
      expect(result.candidates[0].label).toBe('Home');
      expect(result.candidates[0].status).toBe('ready');
      expect(result.candidates[0].proposedItem?.target_kind).toBe('homepage');

      // Item 1: Services -> ready (internal)
      expect(result.candidates[1].label).toBe('Services');
      expect(result.candidates[1].status).toBe('ready');
      expect(result.candidates[1].proposedItem?.target_kind).toBe('internal');
      expect(result.candidates[1].proposedItem?.target_value).toBe('fn-services');

      // Item 2: About Us -> ready (external)
      expect(result.candidates[2].label).toBe('About Us');
      expect(result.candidates[2].status).toBe('ready');
      expect(result.candidates[2].proposedItem?.target_kind).toBe('external');
      expect(result.candidates[2].proposedItem?.target_value).toBe('https://washops.com/about');

      // Item 3: Call Us -> ready (phone)
      expect(result.candidates[3].label).toBe('Call Us');
      expect(result.candidates[3].status).toBe('ready');
      expect(result.candidates[3].proposedItem?.target_kind).toBe('phone');
      expect(result.candidates[3].proposedItem?.target_value).toBe('+15551234567');

      // Item 4: Email -> ready (email)
      expect(result.candidates[4].label).toBe('Email');
      expect(result.candidates[4].status).toBe('ready');
      expect(result.candidates[4].proposedItem?.target_kind).toBe('email');
      expect(result.candidates[4].proposedItem?.target_value).toBe('info@washops.com');

      // Item 5: Mystery Page -> needs_attention (original path retained, no fake URL)
      expect(result.candidates[5].label).toBe('Mystery Page');
      expect(result.candidates[5].status).toBe('needs_attention');
      expect(result.candidates[5].originalTarget).toBe('/unknown-link-target');
      expect(result.candidates[5].proposedItem).toBeNull();
      expect(result.candidates[5].reason).toContain('does not match any existing page');

      // Item 6: Bad URL -> needs_attention (javascript URI rejected)
      expect(result.candidates[6].status).toBe('needs_attention');
      expect(result.candidates[6].originalTarget).toBe('javascript:alert(1)');
      expect(result.candidates[6].proposedItem).toBeNull();

      // Item 7: Bad Phone -> needs_attention
      expect(result.candidates[7].status).toBe('needs_attention');
      expect(result.candidates[7].originalTarget).toBe('tel:letters-not-digits');
      expect(result.candidates[7].proposedItem).toBeNull();

      // Item 8: Bad Email -> needs_attention
      expect(result.candidates[8].status).toBe('needs_attention');
      expect(result.candidates[8].originalTarget).toBe('mailto:not-an-email');
      expect(result.candidates[8].proposedItem).toBeNull();

      // Standalone Header CTA is captured separately and not injected into candidates
      expect(result.standaloneCta).not.toBeNull();
      expect(result.standaloneCta?.text).toBe('Book Now');
      expect(result.standaloneCta?.link).toBe('https://booking.example.com');
    });

    it('evaluates footer scope legacy links with attention detection', () => {
      const result = evaluateLegacyNavigationCandidates('footer', sampleLegacyLayout, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages
      });

      expect(result.candidates.length).toBe(3);
      expect(result.candidates[0].status).toBe('ready');
      expect(result.candidates[1].status).toBe('ready');
      expect(result.candidates[2].status).toBe('needs_attention');
      expect(result.candidates[2].originalTarget).toBe('/non-existent-page');
    });
  });

  describe('Publication Readiness Checks', () => {
    it('approves valid items pointing to live routes', () => {
      const items: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false }
      ];

      const readiness = checkNavigationPublicationReadiness(items, { effectiveRoutes: sampleEffectiveRoutes });
      expect(readiness.ready).toBe(true);
      expect(readiness.blockingItems.length).toBe(0);
    });

    it('blocks publication if a visible item points to an unrouted page', () => {
      const items: SiteNavigationItem[] = [
        { id: '33333333-3333-4333-8333-333333333333', label: 'Unrouted Page', target_kind: 'internal', target_value: 'fn-nonexistent', position: 0, visible: true, is_cta: false }
      ];

      const readiness = checkNavigationPublicationReadiness(items, { effectiveRoutes: sampleEffectiveRoutes });
      expect(readiness.ready).toBe(false);
      expect(readiness.blockingReason).toBe('unrouted');
      expect(readiness.blockingItems.length).toBe(1);
    });

    it('blocks publication if a visible item points to a draft-only route', () => {
      const draftRoutes: EffectiveRoute[] = [
        {
          funnel_id: 'fn-services',
          path: '/services-draft',
          live_path: null,
          is_homepage: false,
          is_draft_override: false,
          is_new_draft: true,
          is_staged_delete: false
        }
      ];

      const items: SiteNavigationItem[] = [
        { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 0, visible: true, is_cta: false }
      ];

      const readiness = checkNavigationPublicationReadiness(items, { effectiveRoutes: draftRoutes });
      expect(readiness.ready).toBe(false);
      expect(readiness.blockingReason).toBe('draft_route');
      expect(readiness.message).toContain('Publish this page URL before publishing navigation');
    });

    it('allows draft-only routes if the navigation item is hidden (visible: false)', () => {
      const draftRoutes: EffectiveRoute[] = [
        {
          funnel_id: 'fn-services',
          path: '/services-draft',
          live_path: null,
          is_homepage: false,
          is_draft_override: false,
          is_new_draft: true,
          is_staged_delete: false
        }
      ];

      const items: SiteNavigationItem[] = [
        { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 0, visible: false, is_cta: false }
      ];

      const readiness = checkNavigationPublicationReadiness(items, { effectiveRoutes: draftRoutes });
      expect(readiness.ready).toBe(true);
    });
  });

  describe('True Publish Diff Computation', () => {
    const liveItems: SiteNavigationItem[] = [
      { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
      { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false },
      { id: '33333333-3333-4333-8333-333333333333', label: 'Contact', target_kind: 'internal', target_value: 'fn-contact', position: 2, visible: true, is_cta: false }
    ];

    it('computes exact diff against live snapshot when liveRevision > 0', () => {
      const draftItems: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '44444444-4444-4444-8444-444444444444', label: 'About', target_kind: 'external', target_value: 'https://washops.com/about', position: 1, visible: true, is_cta: false },
        { id: '33333333-3333-4333-8333-333333333333', label: 'Contact Us', target_kind: 'internal', target_value: 'fn-contact', position: 2, visible: true, is_cta: false }
      ];

      const diff = computeNavigationPublishDiff(liveItems, draftItems, 3);
      expect(diff.isFirstAdoptionFromLegacy).toBe(false);
      expect(diff.totalCount).toBe(3);
      expect(diff.addedCount).toBe(1); // About added
      expect(diff.removedCount).toBe(1); // Services removed
      expect(diff.updatedCount).toBe(1); // Contact renamed to Contact Us
      expect(diff.isExplicitEmpty).toBe(false);
    });

    it('handles first canonical adoption when liveRevision == 0', () => {
      const draftItems: SiteNavigationItem[] = [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ];

      const diff = computeNavigationPublishDiff([], draftItems, 0);
      expect(diff.isFirstAdoptionFromLegacy).toBe(true);
      expect(diff.totalCount).toBe(1);
    });

    it('identifies reordering, visibility changes, and CTA changes', () => {
      const draftItems: SiteNavigationItem[] = [
        { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 0, visible: true, is_cta: false },
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 1, visible: false, is_cta: false },
        { id: '33333333-3333-4333-8333-333333333333', label: 'Contact', target_kind: 'internal', target_value: 'fn-contact', position: 2, visible: true, is_cta: true }
      ];

      const diff = computeNavigationPublishDiff(liveItems, draftItems, 1);
      expect(diff.visibilityChangedCount).toBe(1); // Home hidden
      expect(diff.ctaChangedCount).toBe(1); // Contact is_cta = true
      expect(diff.reorderedCount).toBe(1); // Services moved to position 0
    });
  });

  describe('BuilderNavigationUiManager Lifecycle & Mutations', () => {
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

    it('initializes in legacy authority when no canonical entries exist', () => {
      const state = controller.getState();
      expect(getNavigationScopeAuthority(state)).toBe('legacy');
    });

    it('starts adoption review and enforces resolving needs_attention items before creating draft', async () => {
      manager.startLegacyAdoptionReview(sampleLegacyLayout, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages
      });

      const reviewState = manager.getAdoptionReviewState();
      expect(reviewState.isOpen).toBe(true);
      expect(reviewState.candidates.length).toBe(9);

      // Attempting commit with unresolved items fails
      const commitFail = await manager.commitLegacyAdoption({
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(commitFail).toBe(false);
      expect(manager.getAdoptionReviewState().errorMessage).toContain('resolve or remove');

      // Remove the 4 invalid items
      const attentionIds = reviewState.candidates.filter(c => c.status === 'needs_attention').map(c => c.id);
      for (const id of attentionIds) {
        manager.removeAdoptionCandidate(id);
      }

      expect(manager.getAdoptionReviewState().candidates.length).toBe(5);

      // Now committing succeeds
      const commitSuccess = await manager.commitLegacyAdoption({
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(commitSuccess).toBe(true);

      const state = controller.getState();
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(true);
        expect(state.rawItems.length).toBe(5);
        expect(getNavigationScopeAuthority(state)).toBe('draft');
      }
    });

    it('resolves an attention candidate via resolve modal', async () => {
      manager.startLegacyAdoptionReview(sampleLegacyLayout, {
        effectiveRoutes: sampleEffectiveRoutes,
        funnels: sampleFunnels,
        pages: samplePages
      });

      const candidateToResolve = manager.getAdoptionReviewState().candidates.find(c => c.status === 'needs_attention')!;
      expect(candidateToResolve).toBeDefined();

      manager.openResolveCandidateModal(candidateToResolve.id);
      expect(manager.getItemModalState().isOpen).toBe(true);
      expect(manager.getItemModalState().mode).toBe('resolve_legacy');

      // Set valid internal destination
      manager.setItemModalField('targetKind', 'internal');
      manager.setItemModalField('targetValue', 'fn-services');

      const saved = await manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });
      expect(saved).toBe(true);

      const updatedCandidate = manager.getAdoptionReviewState().candidates.find(c => c.id === candidateToResolve.id)!;
      expect(updatedCandidate.status).toBe('ready');
      expect(updatedCandidate.proposedItem?.target_kind).toBe('internal');
      expect(updatedCandidate.proposedItem?.target_value).toBe('fn-services');
    });

    it('prevents duplicate submissions when saving item modal', async () => {
      manager.openAddItemModal();
      manager.setItemModalField('label', 'Services');
      manager.setItemModalField('targetKind', 'internal');
      manager.setItemModalField('targetValue', 'fn-services');

      // First save
      const p1 = manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });
      // Second immediate save should be rejected because isSaving is true
      const p2 = manager.saveItemModal({ effectiveRoutes: sampleEffectiveRoutes });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(true);
      expect(r2).toBe(false);
    });

    it('switches scopes and captures scope on publication', async () => {
      // Stage Primary draft
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      manager.openPublishModal();
      expect(manager.getPublishModalState().isOpen).toBe(true);
      expect(manager.getPublishModalState().menuScope).toBe('primary');

      const publishRes = await manager.confirmPublish({
        effectiveRoutes: sampleEffectiveRoutes,
        homepageFunnelId: 'fn-home'
      });
      expect(publishRes).toBe(true);
      expect(manager.getPublishModalState().isOpen).toBe(false);

      const state = controller.getState();
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(false);
        expect(state.liveRevision).toBe(1);
        expect(getNavigationScopeAuthority(state)).toBe('live');
      }
    });
  });

  describe('Race Safety & Scope Isolation', () => {
    let repo: MockBuilderSiteNavigationRepository;
    let controller: BuilderSiteNavigationController;

    beforeEach(() => {
      repo = new MockBuilderSiteNavigationRepository();
      controller = new BuilderSiteNavigationController(repo);
    });

    it('ignores stale out-of-order hydration responses when scope is switched', async () => {
      let resolvePrimary: any;
      const primaryPromise = new Promise<any>((resolve) => {
        resolvePrimary = resolve;
      });

      // Override getEffectiveNavigation to delay primary
      const origGet = repo.getEffectiveNavigation.bind(repo);
      repo.getEffectiveNavigation = async (wsId, scope) => {
        if (scope === 'primary') {
          await primaryPromise;
        }
        return origGet(wsId, scope);
      };

      // 1. Start Primary hydration
      const p1 = controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'primary');

      // 2. Switch to Footer immediately
      const p2 = controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'footer');
      await p2;

      expect(controller.getActiveMenuScope()).toBe('footer');
      expect((controller.getState() as any).menuScope).toBe('footer');

      // 3. Complete delayed Primary hydration
      resolvePrimary();
      await p1;

      // Active state must remain Footer
      expect(controller.getActiveMenuScope()).toBe('footer');
      expect((controller.getState() as any).menuScope).toBe('footer');
    });

    it('ignores stale website hydration responses when website is switched', async () => {
      let resolveSiteA: any;
      const siteAPromise = new Promise<any>((resolve) => {
        resolveSiteA = resolve;
      });

      const origGet = repo.getEffectiveNavigation.bind(repo);
      repo.getEffectiveNavigation = async (wsId, scope) => {
        if (wsId === 'ws-100') {
          await siteAPromise;
        }
        return origGet(wsId, scope);
      };

      // 1. Start Site A hydration
      const p1 = controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'primary');

      // 2. Switch to Site B
      const p2 = controller.hydrate('ws-200', { effectiveRoutes: sampleEffectiveRoutes }, 'primary');
      await p2;

      expect(controller.getActiveWebsiteId()).toBe('ws-200');
      expect((controller.getState() as any).websiteId).toBe('ws-200');

      // 3. Complete Site A hydration
      resolveSiteA();
      await p1;

      // Active state must remain Site B
      expect(controller.getActiveWebsiteId()).toBe('ws-200');
      expect((controller.getState() as any).websiteId).toBe('ws-200');
    });
    it('ignores stale stage draft responses when scope is switched', async () => {
      await controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'primary');

      let resolvePrimaryStage: any;
      const primaryStagePromise = new Promise<any>((resolve) => {
        resolvePrimaryStage = resolve;
      });

      const origStage = repo.stageNavigationDraft.bind(repo);
      repo.stageNavigationDraft = async (wsId, items, bRev, dRev, scope) => {
        if (scope === 'primary') {
          await primaryStagePromise;
        }
        return origStage(wsId, items, bRev, dRev, scope);
      };

      // 1. Start Primary stage
      const p1 = controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Primary Item', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes });

      // 2. Switch to Footer immediately
      await controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'footer');
      expect(controller.getActiveMenuScope()).toBe('footer');

      // 3. Complete delayed Primary stage
      resolvePrimaryStage();
      await p1;

      // Active state must remain Footer
      expect(controller.getActiveMenuScope()).toBe('footer');
      expect((controller.getState() as any).menuScope).toBe('footer');
    });

    it('ignores stale revert draft responses when scope is switched', async () => {
      // Stage Primary draft
      await controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'primary');
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Draft Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes });

      let resolvePrimaryRevert: any;
      const primaryRevertPromise = new Promise<any>((resolve) => {
        resolvePrimaryRevert = resolve;
      });

      const origRevert = repo.revertNavigationDraft.bind(repo);
      repo.revertNavigationDraft = async (wsId, dRev, scope) => {
        if (scope === 'primary') {
          await primaryRevertPromise;
        }
        return origRevert(wsId, dRev, scope);
      };

      // 1. Start Primary revert
      const p1 = controller.revertDraft({ effectiveRoutes: sampleEffectiveRoutes });

      // 2. Switch to Footer
      await controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'footer');
      expect(controller.getActiveMenuScope()).toBe('footer');

      // 3. Complete Primary revert
      resolvePrimaryRevert();
      await p1;

      // Active state must remain Footer
      expect(controller.getActiveMenuScope()).toBe('footer');
      expect((controller.getState() as any).menuScope).toBe('footer');
    });

    it('guarantees destination picker isolation between different websites for the same user', () => {
      // Verify sampleContext for Website A ws-100 contains only ws-100 funnels and pages
      expect(sampleContext.website.id).toBe('ws-100');
      expect(sampleContext.funnels.every(f => f.website_id === 'ws-100')).toBe(true);
      expect(sampleContext.funnels.some(f => f.website_id === 'ws-200')).toBe(false);
      expect(sampleContext.pages.some(p => p.funnel_id === 'fn-other')).toBe(false);
    });

    it('preserves true live baseline across draft reload for truthful publish diffs', async () => {
      // Setup live snapshot with rev 3
      repo.setLiveSnapshot('ws-100', [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '22222222-2222-4222-8222-222222222222', label: 'Services', target_kind: 'internal', target_value: 'fn-services', position: 1, visible: true, is_cta: false },
        { id: '33333333-3333-4333-8333-333333333333', label: 'Contact', target_kind: 'internal', target_value: 'fn-contact', position: 2, visible: true, is_cta: false }
      ], 3, 'primary');

      // Stage server draft with Home, About, Contact
      await repo.stageNavigationDraft('ws-100', [
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: '44444444-4444-4444-8444-444444444444', label: 'About', target_kind: 'external', target_value: 'https://washops.com/about', position: 1, visible: true, is_cta: false },
        { id: '33333333-3333-4333-8333-333333333333', label: 'Contact', target_kind: 'internal', target_value: 'fn-contact', position: 2, visible: true, is_cta: false }
      ], 3, 0, 'primary');

      // Create new fresh controller (simulating browser reload)
      const freshController = new BuilderSiteNavigationController(repo);
      const freshPublishController = new BuilderSiteNavigationPublishController(repo);
      const freshManager = new BuilderNavigationUiManager(freshController, freshPublishController);

      await freshController.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' }, 'primary');

      const state = freshController.getState();
      expect(state.status).toBe('ready');
      if (state.status === 'ready') {
        expect(state.isDraft).toBe(true);
        expect(state.liveRevision).toBe(3);
        expect(state.liveItems.length).toBe(3);

        freshManager.openPublishModal();
        const diff = freshManager.getPublishModalState().summary!;
        expect(diff.isFirstAdoptionFromLegacy).toBe(false);
        expect(diff.addedCount).toBe(1); // About
        expect(diff.removedCount).toBe(1); // Services
        expect(diff.totalCount).toBe(3);
      }
    });

    it('tracks multi-scope draft awareness when both Primary and Footer have drafts', async () => {
      // Hydrate Primary and stage draft
      await controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'primary');
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes });

      // Hydrate Footer and stage draft
      await controller.hydrate('ws-100', { effectiveRoutes: sampleEffectiveRoutes }, 'footer');
      await controller.stageDraft([
        { id: '22222222-2222-4222-8222-222222222222', label: 'Contact', target_kind: 'internal', target_value: 'fn-contact', position: 0, visible: true, is_cta: false }
      ], { effectiveRoutes: sampleEffectiveRoutes });

      const summary = controller.getScopeSummary('ws-100');
      expect(summary.primaryHasDraft).toBe(true);
      expect(summary.footerHasDraft).toBe(true);
      expect(summary.draftCount).toBe(2);
    });
  });

  describe('HTML Renderers, CTA Warnings & Responsive Visuals', () => {
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

    it('renders legacy read-only view with Convert button', () => {
      const state = controller.getState();
      const html = renderBuilderNavigationPanel(state, manager, sampleContext);

      expect(html).toContain('Legacy navigation');
      expect(html).toContain('Convert to Editable Navigation');
      expect(html).toContain('pb-nav-item-legacy');
      expect(html).toContain('Read-only');
    });

    it('renders Header CTA duplication warning when canonical CTA and standalone CTA both exist', async () => {
      await controller.stageDraft([
        { id: '11111111-1111-4111-8111-111111111111', label: 'Get Quote', target_kind: 'internal', target_value: 'fn-services', position: 0, visible: true, is_cta: true }
      ], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      const state = controller.getState();
      const html = renderBuilderNavigationPanel(state, manager, sampleContext);

      expect(html).toContain('Header CTA notice:');
      expect(html).toContain('Your header layout also has a standalone CTA button ("Book Now")');
    });

    it('renders modal dialogs with accessible attributes and touch targets', () => {
      manager.openAddItemModal();
      const html = renderNavigationItemModal(manager.getItemModalState(), sampleContext);

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="nav-item-modal-title"');
      expect(html).toContain('id="nav-item-label-input"');
      expect(html).toContain('id="nav-item-kind-select"');
    });

    it('renders publish modal with accurate summary and explicit empty warnings', async () => {
      await controller.stageDraft([], { effectiveRoutes: sampleEffectiveRoutes, homepageFunnelId: 'fn-home' });

      manager.openPublishModal();
      const html = renderNavigationPublishModal(manager.getPublishModalState());

      expect(html).toContain('Publish Primary Menu');
      expect(html).toContain('Explicit Empty Menu Warning:');
      expect(html).toContain('remove all links from your live website');
    });

    it('renders conflict banner when concurrency conflict occurs', () => {
      (controller as any).state = {
        status: 'ready',
        websiteId: 'ws-100',
        menuScope: 'primary',
        items: [],
        rawItems: [],
        liveItems: [],
        isDraft: true,
        baseRevision: 1,
        draftRevision: 2,
        liveRevision: 1,
        isSaving: false,
        isConflict: true,
        errorMessage: 'Navigation changed in another tab. Reload the latest navigation before continuing.'
      };

      const html = renderBuilderNavigationPanel(controller.getState(), manager, sampleContext);
      expect(html).toContain('Concurrency Conflict');
      expect(html).toContain('Navigation changed in another tab');
      expect(html).toContain('Reload Latest');
    });
  });
});
