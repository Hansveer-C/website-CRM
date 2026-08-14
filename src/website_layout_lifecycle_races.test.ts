import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  ProtectedAsyncOperationGuard,
  SupersededOperationError,
  isSupersededOperationError
} from './website_dashboard_hydration_guard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(release => { resolve = release; });
  return { promise, resolve };
}

type LayoutResult = { status: 'loaded' | 'empty' | 'error'; marker?: string };

function createPreviewHarness() {
  const guard = new ProtectedAsyncOperationGuard();
  let currentUser = '';
  let screen = '';
  let layout = '';
  const renderSitePage = vi.fn((marker: string) => { screen = `preview:${marker}`; layout = marker; });
  const renderUnavailable = vi.fn(() => { screen = 'repository-unavailable'; });
  const switchUser = (userId: string, nextScreen: string) => {
    guard.invalidateRuntime();
    currentUser = userId;
    screen = nextScreen;
    layout = '';
  };
  const preview = async (userId: string, result: Promise<LayoutResult>) => {
    const navigation = guard.begin('application-navigation', userId);
    const core = guard.begin('website-dashboard-core', userId);
    try {
      const layoutState = await result;
      guard.requireCurrent(core, currentUser);
      if (layoutState.status === 'error') throw new Error('UNAVAILABLE');
      guard.requireCurrent(navigation, currentUser);
      renderSitePage(layoutState.status === 'loaded' ? layoutState.marker! : 'neutral-empty-layout');
    } catch (error) {
      if (isSupersededOperationError(error) || !guard.isCurrent(navigation, currentUser)) return;
      renderUnavailable();
    }
  };
  return { get screen() { return screen; }, get layout() { return layout; }, renderSitePage, renderUnavailable, switchUser, preview };
}

describe('authenticated Preview layout lifecycle', () => {
  it('renders loaded and intentionally empty layouts, including direct load and refresh', async () => {
    const harness = createPreviewHarness();
    harness.switchUser('A', 'dashboard');
    await harness.preview('A', Promise.resolve({ status: 'loaded', marker: 'A-layout' }));
    expect(harness.screen).toBe('preview:A-layout');
    await harness.preview('A', Promise.resolve({ status: 'empty' }));
    expect(harness.screen).toBe('preview:neutral-empty-layout');
    expect(harness.renderUnavailable).not.toHaveBeenCalled();
  });

  it('fails a current Preview when only layout hydration errors and never renders a false empty layout', async () => {
    const harness = createPreviewHarness();
    harness.switchUser('A', 'dashboard');
    await harness.preview('A', Promise.resolve({ status: 'error' }));
    expect(harness.screen).toBe('repository-unavailable');
    expect(harness.renderUnavailable).toHaveBeenCalledTimes(1);
    expect(harness.renderSitePage).not.toHaveBeenCalled();
    expect(harness.layout).toBe('');
  });

  it('silently discards a stale A layout error after B navigation', async () => {
    const harness = createPreviewHarness();
    const delayed = deferred<LayoutResult>();
    harness.switchUser('A', 'A-dashboard');
    const staleA = harness.preview('A', delayed.promise);
    harness.switchUser('B', 'B-dashboard');
    await harness.preview('B', Promise.resolve({ status: 'loaded', marker: 'B-layout' }));
    delayed.resolve({ status: 'error' });
    await staleA;
    expect(harness.screen).toBe('preview:B-layout');
    expect(harness.layout).toBe('B-layout');
    expect(harness.renderUnavailable).not.toHaveBeenCalled();
  });

  it('keeps login visible when stale A layout completion arrives after logout', async () => {
    const harness = createPreviewHarness();
    const delayed = deferred<LayoutResult>();
    harness.switchUser('A', 'A-dashboard');
    const staleA = harness.preview('A', delayed.promise);
    harness.switchUser('', 'login');
    delayed.resolve({ status: 'loaded', marker: 'A-layout' });
    await staleA;
    expect(harness.screen).toBe('login');
    expect(harness.renderSitePage).not.toHaveBeenCalled();
    expect(harness.renderUnavailable).not.toHaveBeenCalled();
  });
});

type SaveResult = { ok: boolean; marker?: string };

function createSaveHarness() {
  const guard = new ProtectedAsyncOperationGuard();
  let currentUser = '';
  let activeWebsite = '';
  let screen = '';
  const layouts: string[] = [];
  const durable = new Map<string, string>();
  const successToast = vi.fn();
  const errorToast = vi.fn();
  const renderNavigation = vi.fn((websiteId: string) => { screen = `navigation:${websiteId}`; });
  const switchUser = (userId: string, nextScreen: string, websiteId = '') => {
    guard.invalidateRuntime();
    currentUser = userId;
    activeWebsite = websiteId;
    screen = nextScreen;
    layouts.splice(0);
  };
  const switchWebsite = (websiteId: string, nextScreen: string) => { activeWebsite = websiteId; screen = nextScreen; };
  const save = async (userId: string, websiteId: string, result: Promise<SaveResult>) => {
    const operation = guard.begin(`website-layout-save:${websiteId}`, userId);
    try {
      const response = await result;
      if (!response.ok) throw new Error('UNAVAILABLE');
      durable.set(`${userId}:${websiteId}`, response.marker!);
      const committed = guard.commitIfCurrent(operation, currentUser, () => {
        if (activeWebsite !== websiteId) throw new SupersededOperationError();
        layouts.splice(0, layouts.length, response.marker!);
        successToast();
        renderNavigation(websiteId);
      });
      if (!committed) return;
    } catch (error) {
      if (isSupersededOperationError(error)
        || !guard.isCurrent(operation, currentUser)
        || activeWebsite !== websiteId) return;
      errorToast();
    }
  };
  const hydrate = (userId: string, websiteId: string) => {
    const saved = durable.get(`${userId}:${websiteId}`);
    layouts.splice(0, layouts.length, ...(saved ? [saved] : []));
  };
  return { layouts, durable, successToast, errorToast, renderNavigation, switchUser, switchWebsite, save, hydrate, get screen() { return screen; } };
}

describe('Website layout save protected continuation', () => {
  it('commits normal same-user saves and later hydrates their durable result', async () => {
    const harness = createSaveHarness();
    harness.switchUser('A', 'navigation:A-site', 'A-site');
    await harness.save('A', 'A-site', Promise.resolve({ ok: true, marker: 'A-layout' }));
    expect(harness.layouts).toEqual(['A-layout']);
    expect(harness.successToast).toHaveBeenCalledTimes(1);
    harness.switchUser('B', 'B-dashboard', 'B-site');
    harness.switchUser('A', 'A-dashboard', 'A-site');
    harness.hydrate('A', 'A-site');
    expect(harness.layouts).toEqual(['A-layout']);
  });

  it('discards delayed A success after logout or B login while preserving the durable save', async () => {
    const logoutHarness = createSaveHarness();
    const logoutPending = deferred<SaveResult>();
    logoutHarness.switchUser('A', 'A-navigation', 'A-site');
    const afterLogout = logoutHarness.save('A', 'A-site', logoutPending.promise);
    logoutHarness.switchUser('', 'login');
    logoutPending.resolve({ ok: true, marker: 'A-layout' });
    await afterLogout;
    expect(logoutHarness.screen).toBe('login');
    expect(logoutHarness.layouts).toEqual([]);
    expect(logoutHarness.successToast).not.toHaveBeenCalled();
    expect(logoutHarness.renderNavigation).not.toHaveBeenCalled();
    expect(logoutHarness.durable.get('A:A-site')).toBe('A-layout');

    const loginHarness = createSaveHarness();
    const loginPending = deferred<SaveResult>();
    loginHarness.switchUser('A', 'A-navigation', 'A-site');
    const afterLogin = loginHarness.save('A', 'A-site', loginPending.promise);
    loginHarness.switchUser('B', 'B-dashboard', 'B-site');
    loginPending.resolve({ ok: true, marker: 'A-layout' });
    await afterLogin;
    expect(loginHarness.screen).toBe('B-dashboard');
    expect(loginHarness.layouts).toEqual([]);
    expect(loginHarness.successToast).not.toHaveBeenCalled();
  });

  it('protects the B to A reverse race and a same-user Website switch', async () => {
    const harness = createSaveHarness();
    const pendingB = deferred<SaveResult>();
    harness.switchUser('B', 'B-navigation', 'B-site');
    const staleB = harness.save('B', 'B-site', pendingB.promise);
    harness.switchUser('A', 'A-dashboard', 'A-site');
    pendingB.resolve({ ok: true, marker: 'B-layout' });
    await staleB;
    expect(harness.screen).toBe('A-dashboard');
    expect(harness.layouts).toEqual([]);

    const pendingA = deferred<SaveResult>();
    const staleWebsite = harness.save('A', 'A-site', pendingA.promise);
    harness.switchWebsite('A-site-2', 'navigation:A-site-2');
    pendingA.resolve({ ok: true, marker: 'A-site-layout' });
    await staleWebsite;
    expect(harness.screen).toBe('navigation:A-site-2');
    expect(harness.layouts).toEqual([]);
    expect(harness.successToast).not.toHaveBeenCalled();
    expect(harness.renderNavigation).not.toHaveBeenCalled();
  });

  it('shows only current save failures and suppresses stale failure toasts', async () => {
    const harness = createSaveHarness();
    harness.switchUser('A', 'A-navigation', 'A-site');
    await harness.save('A', 'A-site', Promise.resolve({ ok: false }));
    expect(harness.errorToast).toHaveBeenCalledTimes(1);
    const pending = deferred<SaveResult>();
    const stale = harness.save('A', 'A-site', pending.promise);
    harness.switchUser('B', 'B-dashboard', 'B-site');
    pending.resolve({ ok: false });
    await stale;
    expect(harness.errorToast).toHaveBeenCalledTimes(1);
  });
});

describe('production Website layout lifecycle wiring', () => {
  const main = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');

  it('distinguishes a valid empty layout from a current layout query error', () => {
    const core = main.slice(main.indexOf('async function loadWebsiteDashboardCore'), main.indexOf('async function countDashboardMediaAssets'));
    expect(core).toContain('const layoutState = await layoutHydration;');
    expect(core.indexOf('requireCurrent(hydrationToken')).toBeLessThan(core.indexOf("layoutState.status === 'error'"));
    expect(core).toContain("if (layoutState.status === 'error') throw new Error('UNAVAILABLE');");
    expect(core).not.toContain("layoutState.status === 'empty'");
  });

  it('guards every production save completion and keeps local fixture behavior outside the guard', () => {
    const save = main.slice(main.indexOf('(window as any).saveWebsiteLayout'), main.indexOf('function renderWebsiteStructure'));
    expect(save.indexOf('if (!editorUsesSupabase())')).toBeLessThan(save.indexOf('protectedAsyncOperationGuard.begin'));
    const commit = save.slice(save.indexOf('commitIfCurrent(saveOperation'), save.indexOf('if (!committed) return;'));
    expect(commit).toContain('activeDashboardWebsiteId !== website.id');
    expect(commit).toContain('mockWebsiteLayouts.findIndex');
    expect(commit).toContain('websiteLayoutHydrator.state');
    expect(commit).toContain("showToast('Navigation updated successfully!', 'success')");
    expect(commit).toContain('renderWebsiteNavigation()');
    expect(commit).not.toContain('await ');
    expect(save).toContain('isSupersededOperationError(error)');
  });
});
