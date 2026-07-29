import { describe, expect, it } from 'vitest';
import { WebsiteDashboardController } from './website_dashboard_controller';
import type { Funnel, Page, Website, WebsiteRoute } from './types';

const website: Website = { id: 'w1', user_id: 'u1', name: 'Site', domain: 'example.com', subdomain: 'site', homepage_funnel_id: 'f1', created_at: '', updated_at: '' };
const funnel: Funnel = { id: 'f1', user_id: 'u1', name: 'Home', status: 'draft', created_at: '', updated_at: '' };
const page: Page = { id: 'p1', user_id: 'u1', name: 'Home', slug: 'home', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: 'f1' };
const route: WebsiteRoute = { id: 'r1', website_id: 'w1', path: '/', funnel_id: 'f1', created_at: '' };
const core = { websites: [website], routes: [route], funnels: [funnel], pages: [page] };

describe('WebsiteDashboardController', () => {
  it('loads core before optional summaries and coalesces duplicate requests', async () => {
    const order: string[] = [];
    const controller = new WebsiteDashboardController({
      loadCore: async () => { order.push('core'); return core; },
      loadSummary: async () => { order.push('summary'); return { publicationState: 'published' }; }
    });
    const first = controller.load({ actingUserId: 'u1' });
    const second = controller.load({ actingUserId: 'u1' });
    expect(first).toBe(second);
    expect((await first).status).toBe('ready');
    expect(order).toEqual(['core', 'summary']);
  });

  it('preserves core data when an optional summary fails', async () => {
    const controller = new WebsiteDashboardController({ loadCore: async () => core, loadSummary: async () => { throw new Error('private detail'); } });
    const state = await controller.load({ actingUserId: 'u1' });
    expect(state).toMatchObject({ status: 'partial', model: { website: { name: 'Site' }, homepage: { publicationState: 'unavailable' } } });
    expect(JSON.stringify(state)).not.toContain('private detail');
  });

  it('ignores stale responses after the acting user changes', async () => {
    let release!: () => void;
    const slow = new Promise<void>(resolve => { release = resolve; });
    const controller = new WebsiteDashboardController({ loadCore: async request => { if (request.actingUserId === 'u1') await slow; return core; } });
    const stale = controller.load({ actingUserId: 'u1' });
    const current = controller.load({ actingUserId: 'u2' });
    expect((await current).status).toBe('empty');
    release();
    await stale;
    expect(controller.state.status).toBe('empty');
  });

  it('fails closed when core loading fails', async () => {
    const controller = new WebsiteDashboardController({ loadCore: async () => { throw new Error('database detail'); } });
    const state = await controller.load({ actingUserId: 'u1' });
    expect(state).toEqual({ status: 'error', reason: 'repository-failure' });
    expect(JSON.stringify(state)).not.toContain('database detail');
  });
});
