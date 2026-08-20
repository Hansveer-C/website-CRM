import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderSiteNavigationPublishController } from './builder_site_navigation_publish_controller';
import { MockBuilderSiteNavigationRepository } from './builder_site_navigation_repository';
import { SiteNavigationItem } from './builder_site_navigation_domain';

describe('BuilderSiteNavigationPublishController', () => {
  let repo: MockBuilderSiteNavigationRepository;
  let controller: BuilderSiteNavigationPublishController;

  const websiteId = 'ws-test-123';
  const uuid1 = '11111111-1111-4111-8111-111111111111';
  const uuid2 = '22222222-2222-4222-8222-222222222222';

  const initialItems: SiteNavigationItem[] = [
    { id: uuid1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
    { id: uuid2, label: 'Services', target_kind: 'internal', target_value: 'fnl-services', position: 1, visible: true, is_cta: false }
  ];

  beforeEach(() => {
    repo = new MockBuilderSiteNavigationRepository();
    repo.registerFunnel('fnl-services');
    controller = new BuilderSiteNavigationPublishController(repo);
  });

  it('initializes in idle state', () => {
    const state = controller.getState();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
    expect(state.conflictDetected).toBe(false);
    expect(state.lastPublishedRevision).toBeNull();
  });

  it('fails with error when publishing without a staged draft', async () => {
    const res = await controller.publish(websiteId, 0, 1);
    expect(res.success).toBe(false);
    expect(controller.getState().status).toBe('error');
    expect(controller.getState().error).toContain('No navigation draft found to publish');
  });

  it('successfully publishes staged draft, increments revision and clears draft', async () => {
    // Stage draft rev 1
    await repo.stageNavigationDraft(websiteId, initialItems);

    const res = await controller.publish(websiteId, 0, 1);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.live_revision).toBe(1);
    expect(res.data.items).toEqual(initialItems);

    const state = controller.getState();
    expect(state.status).toBe('published');
    expect(state.lastPublishedRevision).toBe(1);
    expect(state.conflictDetected).toBe(false);

    // Verify draft was cleared in repository
    const effective = await repo.getEffectiveNavigation(websiteId);
    expect(effective.success).toBe(true);
    if (effective.success) {
      expect(effective.data.is_draft).toBe(false);
      expect(effective.data.live_revision).toBe(1);
      expect(effective.data.raw_items).toEqual(initialItems);
    }
  });

  it('detects conflict and sets conflictDetected on stale base revision', async () => {
    // Stage live rev 1
    repo.setLiveSnapshot(websiteId, initialItems, 1);
    // Stage draft rev 1
    await repo.stageNavigationDraft(websiteId, [...initialItems, {
      id: '33333333-3333-4333-8333-333333333333',
      label: 'About',
      target_kind: 'internal',
      target_value: 'fnl-services',
      position: 2,
      visible: true,
      is_cta: false
    }], 1, 0);

    // Caller passes stale base revision 0
    const res = await controller.publish(websiteId, 0, 1);
    expect(res.success).toBe(false);
    expect(controller.getState().status).toBe('error');
    expect(controller.getState().conflictDetected).toBe(true);
  });

  it('detects conflict and sets conflictDetected on stale draft revision', async () => {
    // Stage draft rev 1
    await repo.stageNavigationDraft(websiteId, initialItems);
    // Stage draft rev 2
    await repo.stageNavigationDraft(websiteId, initialItems, 0, 1);

    // Caller attempts to publish using old draft rev 1
    const res = await controller.publish(websiteId, 0, 1);
    expect(res.success).toBe(false);
    expect(controller.getState().status).toBe('error');
    expect(controller.getState().conflictDetected).toBe(true);
  });

  it('prevents concurrent double publish', async () => {
    await repo.stageNavigationDraft(websiteId, initialItems);

    const p1 = controller.publish(websiteId, 0, 1);
    const p2 = controller.publish(websiteId, 0, 1);

    const [, res2] = await Promise.all([p1, p2]);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('already in progress');
  });
});
