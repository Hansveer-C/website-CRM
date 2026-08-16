import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { WebsiteGenerationData } from './website_generation_contract';
import { WebsiteGenerationAuthority } from './website_generation_authority';
import { ProtectedAsyncOperationGuard } from './website_dashboard_hydration_guard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((release, fail) => { resolve = release; reject = fail; });
  return { promise, resolve, reject };
}

function graph(userId = 'A', key = 'website-create:1234567890'): WebsiteGenerationData {
  return {
    website: { id: 'w', user_id: userId, name: 'Acme', domain: null, subdomain: 'acme-a', homepage_funnel_id: 'f', created_at: 'now', updated_at: 'now' },
    settings: { id: 's', user_id: userId, website_id: 'w', business_name: 'Acme', phone: '5551234567', email: '', logo_url: '', primary_color: '#2563eb', auto_lead_sms_enabled: true, auto_lead_sms_template: '', missed_call_sms_enabled: true, missed_call_sms_template: '', created_at: 'now' },
    route: { id: 'r', website_id: 'w', path: '/', funnel_id: 'f', created_at: 'now' },
    funnel: { id: 'f', user_id: userId, name: 'Home', status: 'draft', created_at: 'now', updated_at: 'now' },
    page: { id: 'p', user_id: userId, name: 'Home', slug: 'home', status: 'draft', seo_title: 'Acme', seo_description: 'Acme', seo_keywords: ['Wash'], created_at: 'now', funnel_id: 'f' },
    sections: [{ id: 'section', page_id: 'p', type: 'hero', content: {}, order: 0, styles: {} }],
    created: true,
    idempotency_key: key
  };
}

function createHarness() {
  const guard = new ProtectedAsyncOperationGuard();
  const authority = new WebsiteGenerationAuthority(guard);
  let currentUser = '';
  let currentView = '';
  const shared = { websites: [] as string[], funnels: [] as string[], pages: [] as string[], routes: [] as string[], sections: [] as string[], settings: '' };
  const success = vi.fn();
  const failure = vi.fn();

  const navigate = (view: string) => {
    const invocation = guard.beginUnbound('application-navigation');
    guard.bindCurrent(invocation, currentUser);
    currentView = view;
  };
  const switchUser = (userId: string, view: string) => {
    guard.invalidateRuntime();
    currentUser = userId;
    Object.assign(shared, { websites: [], funnels: [], pages: [], routes: [], sections: [], settings: '' });
    navigate(view);
  };
  const generate = async (result: Promise<WebsiteGenerationData>, key = 'website-create:1234567890') => {
    const token = authority.begin(currentUser, key);
    if (!token) throw new Error('INVALID_TEST_SETUP');
    try {
      const data = await result;
      const committed = authority.commitGraph(token, currentUser, data, () => {
        shared.websites = [data.website.id];
        shared.funnels = [data.funnel.id];
        shared.pages = [data.page.id];
        shared.routes = [data.route.id];
        shared.sections = data.sections.map(section => section.id);
        shared.settings = data.settings.id;
      });
      if (committed !== 'committed') return committed;
      if (!authority.isViewCurrent(token, currentUser) || currentView !== 'website-dashboard') return 'abandoned';
      success();
      return 'success';
    } catch {
      if (authority.isViewCurrent(token, currentUser) && currentView === 'website-dashboard') failure();
      return 'failed';
    }
  };
  return { shared, success, failure, navigate, switchUser, generate, get view() { return currentView; } };
}

describe('Website generation protected continuation', () => {
  it('discards A success after logout without shared state or stale success UI', async () => {
    const harness = createHarness();
    const pending = deferred<WebsiteGenerationData>();
    harness.switchUser('A', 'website-dashboard');
    const request = harness.generate(pending.promise);
    harness.switchUser('', 'login');
    pending.resolve(graph('A'));
    await expect(request).resolves.toBe('stale');
    expect(harness.shared.websites).toEqual([]);
    expect(harness.view).toBe('login');
    expect(harness.success).not.toHaveBeenCalled();
  });

  it('preserves B state when delayed A succeeds', async () => {
    const harness = createHarness();
    const pending = deferred<WebsiteGenerationData>();
    harness.switchUser('A', 'website-dashboard');
    const request = harness.generate(pending.promise);
    harness.switchUser('B', 'dashboard');
    harness.shared.websites.push('B-website');
    pending.resolve(graph('A'));
    await request;
    expect(harness.shared.websites).toEqual(['B-website']);
    expect(JSON.stringify(harness.shared)).not.toContain('A');
  });

  it('does not revive A authority after A to B to A', async () => {
    const harness = createHarness();
    const pending = deferred<WebsiteGenerationData>();
    harness.switchUser('A', 'website-dashboard');
    const request = harness.generate(pending.promise);
    harness.switchUser('B', 'dashboard');
    harness.switchUser('A', 'website-dashboard');
    pending.resolve(graph('A'));
    await expect(request).resolves.toBe('stale');
    expect(harness.shared.websites).toEqual([]);
  });

  it.each([
    ['', 'login'],
    ['B', 'dashboard']
  ])('suppresses stale failure after switching to %s', async (userId, view) => {
    const harness = createHarness();
    const pending = deferred<WebsiteGenerationData>();
    harness.switchUser('A', 'website-dashboard');
    const request = harness.generate(pending.promise);
    harness.switchUser(userId, view);
    pending.reject(new Error('upstream failed'));
    await request;
    expect(harness.failure).not.toHaveBeenCalled();
    expect(harness.view).toBe(view);
  });

  it('keeps normal success and valid replay behavior', async () => {
    const harness = createHarness();
    harness.switchUser('A', 'website-dashboard');
    await expect(harness.generate(Promise.resolve(graph('A')))).resolves.toBe('success');
    expect(harness.shared).toEqual({ websites: ['w'], funnels: ['f'], pages: ['p'], routes: ['r'], sections: ['section'], settings: 's' });
    expect(harness.success).toHaveBeenCalledTimes(1);
  });

  it.each(['dashboard', 'clients'])('commits valid durable data but suppresses abandoned UI on %s', async nextView => {
    const harness = createHarness();
    const pending = deferred<WebsiteGenerationData>();
    harness.switchUser('A', 'website-dashboard');
    const request = harness.generate(pending.promise);
    harness.navigate(nextView);
    pending.resolve(graph('A'));
    await expect(request).resolves.toBe('abandoned');
    expect(harness.shared.websites).toEqual(['w']);
    expect(harness.view).toBe(nextView);
    expect(harness.success).not.toHaveBeenCalled();
  });

  it('does not revive old UI authority after navigating away and back', async () => {
    const harness = createHarness();
    const pending = deferred<WebsiteGenerationData>();
    harness.switchUser('A', 'website-dashboard');
    const request = harness.generate(pending.promise);
    harness.navigate('dashboard');
    harness.navigate('website-dashboard');
    pending.resolve(graph('A'));
    await expect(request).resolves.toBe('abandoned');
    expect(harness.success).not.toHaveBeenCalled();
  });
});

describe('Website generation graph authority', () => {
  it.each([
    ['website owner', (data: WebsiteGenerationData) => { data.website.user_id = 'B'; }],
    ['settings owner', (data: WebsiteGenerationData) => { data.settings.user_id = 'B'; }],
    ['funnel owner', (data: WebsiteGenerationData) => { data.funnel.user_id = 'B'; }],
    ['page owner', (data: WebsiteGenerationData) => { data.page.user_id = 'B'; }],
    ['settings Website', (data: WebsiteGenerationData) => { data.settings.website_id = 'other'; }],
    ['route Website', (data: WebsiteGenerationData) => { data.route.website_id = 'other'; }],
    ['route funnel', (data: WebsiteGenerationData) => { data.route.funnel_id = 'other'; }],
    ['page funnel', (data: WebsiteGenerationData) => { data.page.funnel_id = 'other'; }],
    ['homepage funnel', (data: WebsiteGenerationData) => { data.website.homepage_funnel_id = 'other'; }],
    ['section page', (data: WebsiteGenerationData) => { data.sections[0].page_id = 'other'; }],
    ['duplicate section ID', (data: WebsiteGenerationData) => { data.sections.push({ ...data.sections[0], order: 1 }); }],
    ['duplicate section order', (data: WebsiteGenerationData) => { data.sections.push({ ...data.sections[0], id: 'other' }); }],
    ['noncontiguous section order', (data: WebsiteGenerationData) => { data.sections[0].order = 3; }],
    ['idempotency key', (data: WebsiteGenerationData) => { data.idempotency_key = 'website-create:different'; }]
  ])('rejects an invalid %s before shared mutation', async (_name, mutate) => {
    const harness = createHarness();
    harness.switchUser('A', 'website-dashboard');
    const data = graph('A');
    mutate(data);
    await expect(harness.generate(Promise.resolve(data))).resolves.toBe('invalid');
    expect(harness.shared.websites).toEqual([]);
    expect(harness.success).not.toHaveBeenCalled();
  });
});

describe('production Website generation wiring', () => {
  const main = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');
  const submit = main.slice(
    main.indexOf('(window as any).submitWebsiteOnboarding = async'),
    main.indexOf('(window as any).closeOnboarding')
  );

  it('captures production authority before the request and keeps fixture reconciliation on the local branch', () => {
    expect(submit.indexOf('websiteGenerationAuthority.begin')).toBeLessThan(submit.indexOf('websiteGenerationClient().generate'));
    expect(submit).toContain('websiteGenerationAuthority.commitGraph');
    expect(submit).toContain('websiteGenerationAuthority.isViewCurrent');
    expect(submit).toContain('reconcileGeneratedWebsite(data, generationAuthority.userId)');
    expect(submit).toContain('reconcileGeneratedWebsite(data, getActingUserId())');
  });
});
