import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { WebsiteDashboardHydrationGuard } from './website_dashboard_hydration_guard';

const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
};

type Snapshot = {
  websites: string[];
  funnels: string[];
  pages: Array<{ name: string; slug: string; seo: string }>;
  routes: string[];
  layouts: string[];
};

const emptySnapshot = (): Snapshot => ({ websites: [], funnels: [], pages: [], routes: [], layouts: [] });
const snapshot = (user: string): Snapshot => ({
  websites: [`${user}-website`],
  funnels: [`${user}-funnel`],
  pages: [{ name: `${user} page`, slug: `${user}-slug`, seo: `${user} SEO` }],
  routes: [`/${user}`],
  layouts: [`${user}-layout`]
});

function createHarness() {
  const guard = new WebsiteDashboardHydrationGuard();
  const shared = emptySnapshot();
  let currentUser = '';
  const replace = vi.fn((value: Snapshot) => {
    Object.assign(shared, structuredClone(value));
  });
  const hydrate = async (userId: string, wait: Promise<void>, value: Snapshot) => {
    const token = guard.begin(userId);
    await wait;
    if (!guard.commitIfCurrent(token, currentUser, () => replace(value))) throw new Error('UNAVAILABLE');
  };
  return {
    guard,
    shared,
    replace,
    setUser: (userId: string) => { currentUser = userId; },
    logout: () => { currentUser = ''; guard.invalidate(); },
    hydrate
  };
}

describe('WebsiteDashboardHydrationGuard', () => {
  it('keeps user B state intact when delayed user A results finish last', async () => {
    const harness = createHarness();
    const a = deferred();
    harness.setUser('user-a');
    const staleA = harness.hydrate('user-a', a.promise, snapshot('user-a'));
    harness.setUser('user-b');
    await harness.hydrate('user-b', Promise.resolve(), snapshot('user-b'));
    a.release();
    await expect(staleA).rejects.toThrow('UNAVAILABLE');
    expect(harness.shared).toEqual(snapshot('user-b'));
    expect(JSON.stringify(harness.shared)).not.toContain('user-a');
    expect(harness.replace).toHaveBeenCalledTimes(1);
  });

  it('never reaches the shared replacement callback for a stale generation', () => {
    const guard = new WebsiteDashboardHydrationGuard();
    const stale = guard.begin('user-a');
    guard.begin('user-b');
    const replaceOwnedDashboardRows = vi.fn();
    const pushRoutes = vi.fn();
    expect(guard.commitIfCurrent(stale, 'user-a', () => {
      replaceOwnedDashboardRows();
      pushRoutes();
    })).toBe(false);
    expect(replaceOwnedDashboardRows).not.toHaveBeenCalled();
    expect(pushRoutes).not.toHaveBeenCalled();
  });

  it('discards hydration completed after logout', async () => {
    const harness = createHarness();
    const pending = deferred();
    harness.setUser('user-a');
    const request = harness.hydrate('user-a', pending.promise, snapshot('user-a'));
    harness.logout();
    pending.release();
    await expect(request).rejects.toThrow('UNAVAILABLE');
    expect(harness.replace).not.toHaveBeenCalled();
  });

  it('discards A across an A to logout to B transition', async () => {
    const harness = createHarness();
    const pending = deferred();
    harness.setUser('user-a');
    const stale = harness.hydrate('user-a', pending.promise, snapshot('user-a'));
    harness.logout();
    harness.setUser('user-b');
    await harness.hydrate('user-b', Promise.resolve(), snapshot('user-b'));
    pending.release();
    await expect(stale).rejects.toThrow('UNAVAILABLE');
    expect(harness.shared).toEqual(snapshot('user-b'));
  });

  it('also protects the reverse B to A race', async () => {
    const harness = createHarness();
    const pending = deferred();
    harness.setUser('user-b');
    const stale = harness.hydrate('user-b', pending.promise, snapshot('user-b'));
    harness.setUser('user-a');
    await harness.hydrate('user-a', Promise.resolve(), snapshot('user-a'));
    pending.release();
    await expect(stale).rejects.toThrow('UNAVAILABLE');
    expect(harness.shared).toEqual(snapshot('user-a'));
  });

  it('allows same-user repeated and forced-refresh hydration while latest wins', async () => {
    const harness = createHarness();
    harness.setUser('user-a');
    await harness.hydrate('user-a', Promise.resolve(), snapshot('user-a'));
    const refreshed = snapshot('user-a');
    refreshed.pages[0].name = 'user-a refreshed page';
    await harness.hydrate('user-a', Promise.resolve(), refreshed);
    expect(harness.shared).toEqual(refreshed);
    expect(harness.replace).toHaveBeenCalledTimes(2);
  });

  it('rejects an identity mismatch even when its generation is otherwise current', () => {
    const guard = new WebsiteDashboardHydrationGuard();
    const token = guard.begin('user-a');
    const mutation = vi.fn();
    expect(guard.commitIfCurrent(token, 'user-b', mutation)).toBe(false);
    expect(mutation).not.toHaveBeenCalled();
  });
});

describe('Website dashboard hydration wiring', () => {
  const main = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');

  it('validates generation and current identity immediately around synchronous shared writes', () => {
    const start = main.indexOf('const committed = websiteDashboardHydrationGuard.commitIfCurrent');
    const end = main.indexOf("if (!committed) throw new Error('UNAVAILABLE');", start);
    const guardedWrites = main.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(guardedWrites).toContain('hydrationToken, getActingUserId(), () => {');
    expect(guardedWrites).toContain('replaceOwnedDashboardRows(mockWebsites');
    expect(guardedWrites).toContain('replaceOwnedDashboardRows(mockFunnels');
    expect(guardedWrites).toContain('replaceOwnedDashboardRows(mockPages');
    expect(guardedWrites).toContain('mockWebsiteRoutes.push');
    expect(guardedWrites).not.toContain('await ');
  });

  it('invalidates core hydration on protected resets and explicit local identity switches', () => {
    const clear = main.slice(main.indexOf('function clearProtectedRuntimeData'), main.indexOf('const CRM_DATA_VIEWS'));
    const switchUser = main.slice(main.indexOf('(window as any).switchUser'), main.indexOf('// QA Simulation State'));
    expect(clear).toContain('websiteDashboardHydrationGuard.invalidate()');
    expect(switchUser).toContain('websiteDashboardHydrationGuard.invalidate()');
  });

  it('leaves local fixture hydration ahead of the production generation guard', () => {
    const loadCore = main.slice(main.indexOf('async function loadWebsiteDashboardCore'), main.indexOf('async function countDashboardMediaAssets'));
    expect(loadCore.indexOf('if (!dashboardUsesSupabase())')).toBeLessThan(loadCore.indexOf('websiteDashboardHydrationGuard.begin(userId)'));
  });

  it.each([
    ['./crm_production_hydration.ts', 'generation !== this.generation'],
    ['./website_settings_hydration.ts', 'generation !== this.generation'],
    ['./website_layout_hydration.ts', 'generation !== this.generation']
  ])('confirms adjacent hydrator %s already guards stale writes', (path, guard) => {
    const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
    expect(source).toContain(guard);
    expect(source).toContain('this.generation += 1');
  });
});
