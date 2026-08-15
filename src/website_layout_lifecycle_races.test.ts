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
  let currentView = '';
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
    currentView = nextScreen;
    screen = nextScreen;
    layouts.splice(0);
  };
  const navigate = (view: string) => {
    const invocation = guard.beginUnbound('application-navigation');
    guard.bindCurrent(invocation, currentUser);
    currentView = view;
    screen = view;
  };
  const switchWebsite = (websiteId: string, nextScreen: string) => { activeWebsite = websiteId; navigate(nextScreen); };
  const save = async (userId: string, websiteId: string, result: Promise<SaveResult>) => {
    const navigation = guard.captureCurrent('application-navigation', userId);
    if (!navigation || currentView !== 'website-navigation') throw new Error('INVALID_TEST_SETUP');
    const operation = guard.begin(`website-layout-save:${websiteId}`, userId);
    try {
      const response = await result;
      if (!response.ok) throw new Error('UNAVAILABLE');
      durable.set(`${userId}:${websiteId}`, response.marker!);
      const committed = guard.commitIfCurrent(operation, currentUser, () => {
        if (activeWebsite !== websiteId) throw new SupersededOperationError();
        layouts.splice(0, layouts.length, response.marker!);
      });
      if (!committed) return;
      if (!guard.isCurrent(navigation, currentUser) || currentView !== 'website-navigation') return;
      successToast();
      renderNavigation(websiteId);
    } catch (error) {
      if (isSupersededOperationError(error)
        || !guard.isCurrent(operation, currentUser)
        || activeWebsite !== websiteId
        || !guard.isCurrent(navigation, currentUser)
        || currentView !== 'website-navigation') return;
      errorToast();
    }
  };
  const hydrate = (userId: string, websiteId: string) => {
    const saved = durable.get(`${userId}:${websiteId}`);
    layouts.splice(0, layouts.length, ...(saved ? [saved] : []));
  };
  return { layouts, durable, successToast, errorToast, renderNavigation, switchUser, switchWebsite, navigate, save, hydrate, get screen() { return screen; } };
}

describe('Website layout save protected continuation', () => {
  it('commits normal same-user saves and later hydrates their durable result', async () => {
    const harness = createSaveHarness();
    harness.switchUser('A', 'bootstrap', 'A-site');
    harness.navigate('website-navigation');
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
    logoutHarness.switchUser('A', 'bootstrap', 'A-site');
    logoutHarness.navigate('website-navigation');
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
    loginHarness.switchUser('A', 'bootstrap', 'A-site');
    loginHarness.navigate('website-navigation');
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
    harness.switchUser('B', 'bootstrap', 'B-site');
    harness.navigate('website-navigation');
    const staleB = harness.save('B', 'B-site', pendingB.promise);
    harness.switchUser('A', 'A-dashboard', 'A-site');
    pendingB.resolve({ ok: true, marker: 'B-layout' });
    await staleB;
    expect(harness.screen).toBe('A-dashboard');
    expect(harness.layouts).toEqual([]);

    harness.navigate('website-navigation');
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
    harness.switchUser('A', 'bootstrap', 'A-site');
    harness.navigate('website-navigation');
    await harness.save('A', 'A-site', Promise.resolve({ ok: false }));
    expect(harness.errorToast).toHaveBeenCalledTimes(1);
    const pending = deferred<SaveResult>();
    const stale = harness.save('A', 'A-site', pending.promise);
    harness.switchUser('B', 'B-dashboard', 'B-site');
    pending.resolve({ ok: false });
    await stale;
    expect(harness.errorToast).toHaveBeenCalledTimes(1);
  });

  it.each(['dashboard', 'clients'])('keeps %s visible while safely committing a completed layout save', async nextView => {
    const harness = createSaveHarness();
    const pending = deferred<SaveResult>();
    harness.switchUser('A', 'bootstrap', 'A-site');
    harness.navigate('website-navigation');
    const save = harness.save('A', 'A-site', pending.promise);
    harness.navigate(nextView);
    pending.resolve({ ok: true, marker: 'A-layout' });
    await save;
    expect(harness.screen).toBe(nextView);
    expect(harness.layouts).toEqual(['A-layout']);
    expect(harness.successToast).not.toHaveBeenCalled();
    expect(harness.renderNavigation).not.toHaveBeenCalled();
  });

  it('suppresses an abandoned save failure over a newer view', async () => {
    const harness = createSaveHarness();
    const pending = deferred<SaveResult>();
    harness.switchUser('A', 'bootstrap', 'A-site');
    harness.navigate('website-navigation');
    const save = harness.save('A', 'A-site', pending.promise);
    harness.navigate('clients');
    pending.resolve({ ok: false });
    await save;
    expect(harness.screen).toBe('clients');
    expect(harness.errorToast).not.toHaveBeenCalled();
  });

  it('does not revive an old save after navigating away and back to Navigation', async () => {
    const harness = createSaveHarness();
    const pending = deferred<SaveResult>();
    harness.switchUser('A', 'bootstrap', 'A-site');
    harness.navigate('website-navigation');
    const save = harness.save('A', 'A-site', pending.promise);
    harness.navigate('dashboard');
    harness.navigate('website-navigation');
    pending.resolve({ ok: true, marker: 'A-layout' });
    await save;
    expect(harness.screen).toBe('website-navigation');
    expect(harness.layouts).toEqual(['A-layout']);
    expect(harness.successToast).not.toHaveBeenCalled();
    expect(harness.renderNavigation).not.toHaveBeenCalled();
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
    expect(commit).not.toContain("showToast('Navigation updated successfully!', 'success')");
    expect(commit).not.toContain('renderWebsiteNavigation()');
    expect(commit).not.toContain('await ');
    expect(save).toContain("captureCurrent('application-navigation', userId)");
    expect(save).toContain("currentView !== 'website-navigation'");
    const production = save.slice(save.indexOf('const navigationOperation'));
    expect(production.indexOf("isCurrent(navigationOperation")).toBeLessThan(production.indexOf("showToast('Navigation updated successfully!', 'success')"));
    expect(save).toContain('isSupersededOperationError(error)');
  });
});
