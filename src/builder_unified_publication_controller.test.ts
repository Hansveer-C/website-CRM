import { describe, it, expect, vi } from 'vitest';
import { BuilderUnifiedPublicationController } from './builder_unified_publication_controller';
import type { BuilderUnifiedPublicationRepository } from './builder_unified_publication_repository';
import type { WebsitePublishPlan, WebsitePublishResult } from './builder_unified_publication';

describe('BuilderUnifiedPublicationController', () => {
  const createMockPlan = (overrides?: Partial<WebsitePublishPlan>): WebsitePublishPlan => ({
    website_id: 'web-1',
    publication_revision: 1,
    has_pending_changes: true,
    pending_domains: ['homepage', 'routes'],
    expected_state: {
      publication_revision: 1,
      homepage: { draft_funnel_id: 'fn-2', live_funnel_id: 'fn-1' },
      route_drafts: [{ id: 'rd-1', route_id: null, action: 'upsert', path: '/services', funnel_id: 'fn-3' }],
      primary_navigation: { is_draft: false, base_revision: 0, draft_revision: 0, live_revision: 1 },
      footer_navigation: { is_draft: false, base_revision: 0, draft_revision: 0, live_revision: 0 },
      pages: []
    },
    summary: {
      homepage: { changed: true, current_live: 'Old Home', next_live: 'New Home' },
      routes: {
        has_changes: true,
        creates: [{ id: 'rd-1', path: '/services', funnel_id: 'fn-3' }],
        updates: [],
        deletes: []
      },
      primary_navigation: { has_changes: false, item_count: 3, is_empty: false },
      footer_navigation: { has_changes: false, item_count: 0, is_empty: true },
      pages: { has_changes: false, count: 0, items: [] }
    },
    blockers: [],
    warnings: [],
    is_publishable: true,
    ...overrides
  });

  it('opens modal and loads plan', async () => {
    const mockPlan = createMockPlan();
    const mockRepo: BuilderUnifiedPublicationRepository = {
      getPublishPlan: vi.fn().mockResolvedValue({ success: true, data: mockPlan }),
      publishWebsite: vi.fn()
    };

    const controller = new BuilderUnifiedPublicationController(mockRepo);
    controller.openModal('web-1');

    expect(controller.getState().isOpen).toBe(true);
    expect(controller.getState().status).toBe('loading_plan');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(controller.getState().status).toBe('ready');
    expect(controller.getState().plan).toEqual(mockPlan);
  });

  it('handles no pending changes', async () => {
    const mockPlan = createMockPlan({ has_pending_changes: false, is_publishable: false });
    const mockRepo: BuilderUnifiedPublicationRepository = {
      getPublishPlan: vi.fn().mockResolvedValue({ success: true, data: mockPlan }),
      publishWebsite: vi.fn()
    };

    const controller = new BuilderUnifiedPublicationController(mockRepo);
    controller.openModal('web-1');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(controller.getState().status).toBe('no_changes');
  });

  it('handles blockers reported by server plan', async () => {
    const mockPlan = createMockPlan({
      blockers: [{ domain: 'routes', code: 'ROUTE_COLLISION', message: 'Path /services conflicts with another page' }],
      is_publishable: false
    });
    const mockRepo: BuilderUnifiedPublicationRepository = {
      getPublishPlan: vi.fn().mockResolvedValue({ success: true, data: mockPlan }),
      publishWebsite: vi.fn()
    };

    const controller = new BuilderUnifiedPublicationController(mockRepo);
    controller.openModal('web-1');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(controller.getState().status).toBe('blocked');
    expect(controller.getState().plan?.blockers.length).toBe(1);
  });

  it('publishes successfully with expected state', async () => {
    const mockPlan = createMockPlan();
    const mockPublishResult: WebsitePublishResult = {
      success: true,
      status: 'PUBLISHED',
      publication_revision: 2,
      published_at: new Date().toISOString()
    };

    const mockRepo: BuilderUnifiedPublicationRepository = {
      getPublishPlan: vi.fn().mockResolvedValue({ success: true, data: mockPlan }),
      publishWebsite: vi.fn().mockResolvedValue({ success: true, data: mockPublishResult })
    };

    const controller = new BuilderUnifiedPublicationController(mockRepo);
    controller.openModal('web-1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await controller.publish();

    expect(mockRepo.publishWebsite).toHaveBeenCalledWith('web-1', mockPlan.expected_state);
    expect(result).toEqual(mockPublishResult);
    expect(controller.getState().status).toBe('success');
  });

  it('handles conflict error on publish', async () => {
    const mockPlan = createMockPlan();
    const mockRepo: BuilderUnifiedPublicationRepository = {
      getPublishPlan: vi.fn().mockResolvedValue({ success: true, data: mockPlan }),
      publishWebsite: vi.fn().mockResolvedValue({
        success: false,
        error: 'Website changes were updated elsewhere.',
        code: 'CONFLICT'
      })
    };

    const controller = new BuilderUnifiedPublicationController(mockRepo);
    controller.openModal('web-1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await controller.publish();

    expect(result).toBeNull();
    expect(controller.getState().status).toBe('conflict');
    expect(controller.getState().errorCode).toBe('CONFLICT');
  });

  it('ignores responses if website was switched mid-flight', async () => {
    let resolveFirstPlan: (val: any) => void = () => {};
    const firstPlanPromise = new Promise((resolve) => {
      resolveFirstPlan = resolve;
    });

    const mockRepo: BuilderUnifiedPublicationRepository = {
      getPublishPlan: vi.fn().mockImplementation((id: string) => {
        if (id === 'web-1') {
          return firstPlanPromise;
        }
        return Promise.resolve({ success: true, data: createMockPlan({ website_id: 'web-2' }) });
      }),
      publishWebsite: vi.fn()
    };

    const controller = new BuilderUnifiedPublicationController(mockRepo);
    controller.openModal('web-1');

    // Switch to web-2 before web-1 returns
    controller.openModal('web-2');

    // Now resolve web-1
    resolveFirstPlan({ success: true, data: createMockPlan({ website_id: 'web-1' }) });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(controller.getState().websiteId).toBe('web-2');
    expect(controller.getState().plan?.website_id).toBe('web-2');
  });
});
