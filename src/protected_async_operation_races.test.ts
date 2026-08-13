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

type TenantResult = {
  id: string;
  userId: string;
  amount?: number;
  status?: string;
  date?: string;
};

function createMutationHarness() {
  const guard = new ProtectedAsyncOperationGuard();
  let currentUser = '';
  const shared = { contacts: [] as string[], opportunities: [] as string[], quotes: [] as TenantResult[], items: [] as string[] };
  const durable = new Map<string, TenantResult[]>();
  const toast = vi.fn();
  const navigate = vi.fn();
  const rehydrate = vi.fn();

  const switchUser = (userId: string) => {
    guard.invalidateRuntime();
    currentUser = userId;
    shared.contacts = [];
    shared.opportunities = [];
    shared.quotes = [];
    shared.items = [];
  };
  const logout = () => switchUser('');
  const mutate = async (kind: 'lead' | 'quote', userId: string, resultPromise: Promise<TenantResult>) => {
    const token = guard.begin(`${kind}:${crypto.randomUUID()}`, userId);
    const result = await resultPromise;
    durable.set(userId, [...(durable.get(userId) ?? []), result]);
    return guard.commitIfCurrent(token, currentUser, () => {
      if (kind === 'lead') {
        shared.contacts.push(result.id);
        shared.opportunities.push(`${result.id}-opportunity`);
      } else {
        shared.quotes.push(result);
        shared.items.push(`${result.id}-item`);
        shared.opportunities.push(`${result.id}-opportunity`);
      }
      toast(`${kind} saved`);
      navigate(kind === 'lead' ? 'contact-detail' : 'quotes');
      rehydrate();
    });
  };
  const hydrateDurable = (userId: string) => {
    shared.quotes = [...(durable.get(userId) ?? [])];
  };
  return { shared, durable, toast, navigate, rehydrate, switchUser, logout, mutate, hydrateDurable };
}

describe('protected durable CRM mutation races', () => {
  it('discards a delayed A lead after logout and B login while preserving the durable A result', async () => {
    const harness = createMutationHarness();
    const pending = deferred<TenantResult>();
    harness.switchUser('A');
    const stale = harness.mutate('lead', 'A', pending.promise);
    harness.logout();
    harness.switchUser('B');
    pending.resolve({ id: 'A-contact', userId: 'A' });
    await expect(stale).resolves.toBe(false);
    expect(harness.shared.contacts).toEqual([]);
    expect(harness.shared.opportunities).toEqual([]);
    expect(harness.toast).not.toHaveBeenCalled();
    expect(harness.navigate).not.toHaveBeenCalled();
    expect(harness.rehydrate).not.toHaveBeenCalled();
    expect(harness.durable.get('A')).toEqual([{ id: 'A-contact', userId: 'A' }]);
  });

  it('preserves normal same-user lead success and protects the B to A reverse race', async () => {
    const harness = createMutationHarness();
    harness.switchUser('A');
    await expect(harness.mutate('lead', 'A', Promise.resolve({ id: 'A-normal', userId: 'A' }))).resolves.toBe(true);
    const pendingB = deferred<TenantResult>();
    harness.switchUser('B');
    const staleB = harness.mutate('lead', 'B', pendingB.promise);
    harness.switchUser('A');
    pendingB.resolve({ id: 'B-contact', userId: 'B' });
    await expect(staleB).resolves.toBe(false);
    expect(harness.shared.contacts).not.toContain('B-contact');
  });

  it('discards all delayed A quote state and UI after B becomes current', async () => {
    const harness = createMutationHarness();
    const pending = deferred<TenantResult>();
    harness.switchUser('A');
    const stale = harness.mutate('quote', 'A', pending.promise);
    harness.switchUser('B');
    pending.resolve({ id: 'A-quote', userId: 'A', amount: 999, status: 'draft', date: '2026-08-13' });
    await expect(stale).resolves.toBe(false);
    expect(JSON.stringify(harness.shared)).not.toContain('A-quote');
    expect(JSON.stringify(harness.shared)).not.toContain('999');
    expect(harness.toast).not.toHaveBeenCalled();
    expect(harness.navigate).not.toHaveBeenCalled();
  });

  it('keeps same-user quote success and later rehydrates the durable quote for A', async () => {
    const harness = createMutationHarness();
    harness.switchUser('A');
    await expect(harness.mutate('quote', 'A', Promise.resolve({ id: 'A-quote', userId: 'A', amount: 25 }))).resolves.toBe(true);
    harness.switchUser('B');
    expect(harness.shared.quotes).toEqual([]);
    harness.switchUser('A');
    harness.hydrateDurable('A');
    expect(harness.shared.quotes.map(quote => quote.id)).toEqual(['A-quote']);
  });
});

function createPreviewHarness() {
  const guard = new ProtectedAsyncOperationGuard();
  let currentUser = '';
  const state = { screen: '', sections: [] as string[], business: '', layout: '' };
  const switchUser = (userId: string, screen: string) => {
    guard.invalidateRuntime();
    currentUser = userId;
    state.screen = screen;
    state.sections = [];
    state.business = '';
    state.layout = '';
  };
  const preview = async (userId: string, pageId: string, wait: Promise<void>) => {
    const navigation = guard.begin('application-navigation', userId);
    await wait;
    if (!guard.commitIfCurrent(navigation, currentUser, () => {
      state.sections = [`${userId}:${pageId}:section`];
      state.business = `${userId}:business`;
      state.layout = `${userId}:layout`;
      state.screen = `${userId}:${pageId}:preview`;
    })) throw new SupersededOperationError();
  };
  return { state, switchUser, preview };
}

describe('authenticated Preview races', () => {
  it('keeps login visible and commits no A sections when logout wins', async () => {
    const harness = createPreviewHarness();
    const pending = deferred<void>();
    harness.switchUser('A', 'dashboard');
    const stale = harness.preview('A', 'page-a', pending.promise);
    harness.switchUser('', 'login');
    pending.resolve();
    await expect(stale).rejects.toBeInstanceOf(SupersededOperationError);
    expect(harness.state).toEqual({ screen: 'login', sections: [], business: '', layout: '' });
  });

  it('keeps B dashboard or B Preview visible when delayed A finishes last', async () => {
    const harness = createPreviewHarness();
    const pendingA = deferred<void>();
    harness.switchUser('A', 'dashboard');
    const staleA = harness.preview('A', 'page-a', pendingA.promise);
    harness.switchUser('B', 'B-dashboard');
    expect(harness.state.screen).toBe('B-dashboard');
    await harness.preview('B', 'page-b', Promise.resolve());
    pendingA.resolve();
    await expect(staleA).rejects.toBeInstanceOf(SupersededOperationError);
    expect(harness.state).toEqual({
      screen: 'B:page-b:preview',
      sections: ['B:page-b:section'],
      business: 'B:business',
      layout: 'B:layout'
    });
  });

  it('supports direct, refresh, same-user, and reverse-race Preview navigation', async () => {
    const harness = createPreviewHarness();
    harness.switchUser('B', 'dashboard');
    await harness.preview('B', 'direct', Promise.resolve());
    await harness.preview('B', 'refresh', Promise.resolve());
    const pendingB = deferred<void>();
    const staleB = harness.preview('B', 'old', pendingB.promise);
    harness.switchUser('A', 'A-dashboard');
    await harness.preview('A', 'current', Promise.resolve());
    pendingB.resolve();
    await expect(staleB).rejects.toBeInstanceOf(SupersededOperationError);
    expect(harness.state.screen).toBe('A:current:preview');
  });
});

describe('superseded dashboard navigation boundary', () => {
  it('does not render an error over a newer successful navigation', async () => {
    const guard = new ProtectedAsyncOperationGuard();
    let currentUser = 'A';
    let screen = '';
    const errorRender = vi.fn(() => { screen = 'repository-error'; });
    const navigate = async (name: string, wait: Promise<void>, fail = false) => {
      const navigation = guard.begin('application-navigation', currentUser);
      const hydration = guard.begin('website-dashboard-core', currentUser);
      try {
        await wait;
        if (fail) throw new Error('UNAVAILABLE');
        guard.requireCurrent(hydration, currentUser);
        guard.requireCurrent(navigation, currentUser);
        screen = name;
      } catch (error) {
        if (isSupersededOperationError(error) || !guard.isCurrent(navigation, currentUser)) return;
        errorRender();
      }
    };
    const delayed = deferred<void>();
    const old = navigate('A', delayed.promise);
    await navigate('B', Promise.resolve());
    delayed.resolve();
    await old;
    expect(screen).toBe('B');
    expect(errorRender).not.toHaveBeenCalled();
    await navigate('current failure', Promise.resolve(), true);
    expect(screen).toBe('repository-error');
    expect(errorRender).toHaveBeenCalledTimes(1);
  });

  it('makes rapid A to B to C and same-view refresh latest-wins', async () => {
    const guard = new ProtectedAsyncOperationGuard();
    const a = guard.begin('application-navigation', 'user');
    const b = guard.begin('application-navigation', 'user');
    const c = guard.begin('application-navigation', 'user');
    expect(guard.isCurrent(a, 'user')).toBe(false);
    expect(guard.isCurrent(b, 'user')).toBe(false);
    expect(guard.isCurrent(c, 'user')).toBe(true);
    const oldRefresh = guard.begin('website-dashboard-core', 'user');
    const newRefresh = guard.begin('website-dashboard-core', 'user');
    expect(guard.isCurrent(oldRefresh, 'user')).toBe(false);
    expect(guard.isCurrent(newRefresh, 'user')).toBe(true);
  });
});

describe('adjacent authenticated Builder persistence race', () => {
  it('keeps a durable save but discards stale Builder state and success UI after account reset', async () => {
    const guard = new ProtectedAsyncOperationGuard();
    let currentUser = 'A';
    let builderState = 'A-editing';
    let durable = false;
    const toast = vi.fn();
    const pending = deferred<void>();
    const token = guard.begin('builder-section-save:page-a:1', 'A');
    const save = (async () => {
      await pending.promise;
      durable = true;
      guard.commitIfCurrent(token, currentUser, () => {
        builderState = 'A-saved';
        toast('Saved');
      });
    })();
    guard.invalidateRuntime();
    currentUser = 'B';
    builderState = 'B-dashboard';
    pending.resolve();
    await save;
    expect(durable).toBe(true);
    expect(builderState).toBe('B-dashboard');
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('production stale-operation wiring', () => {
  const main = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');

  it('guards lead and quote shared writes plus tenant-derived UI before synchronous commit', () => {
    const lead = main.slice(main.indexOf("if (url === '/api/leads'"), main.indexOf("if (url === '/api/quotes'"));
    const quote = main.slice(main.indexOf('(window as any).saveQuote'), main.indexOf("const quoteId = 'q'"));
    expect(lead).toContain('protectedAsyncOperationGuard.requireCurrent(leadOperation, getActingUserId());');
    expect(lead.indexOf('requireCurrent(leadOperation')).toBeLessThan(lead.indexOf('mockContacts.findIndex'));
    const quoteCommit = quote.slice(quote.indexOf('const committed = protectedAsyncOperationGuard.commitIfCurrent'), quote.indexOf('if (!committed) return;'));
    expect(quoteCommit).toContain('mockQuotes.findIndex');
    expect(quoteCommit).toContain('mockQuoteItems.findIndex');
    expect(quoteCommit).toContain('mockOpportunities.findIndex');
    expect(quoteCommit).toContain("showToast('Quote created successfully.'");
    expect(quoteCommit).toContain("navigateTo('quotes')");
    expect(quoteCommit).not.toContain('await ');
  });

  it('guards Preview sections, settings-derived styling, final render, and stale error rendering', () => {
    const sections = main.slice(main.indexOf('async function hydrateAuthenticatedPreviewSections'), main.indexOf('async function initializeBuilderNavigation'));
    const previewStart = main.indexOf('if (isPreviewRoute && targetPath)');
    const preview = main.slice(previewStart, main.indexOf('const result = await resolveWebsiteRequest', previewStart));
    expect(sections.indexOf('requireCurrent(operation')).toBeLessThan(sections.indexOf('mockPageSections.push'));
    expect(preview).toContain('websiteId: target.website.id');
    expect(preview).toContain('pageId: target.page.id');
    expect(preview).toContain('requireCurrent(previewOperation.navigation');
    expect(preview).toContain('isSupersededOperationError(error)');
  });

  it('invalidates pending Builder settings/setup/section-save continuations on protected reset', () => {
    const clear = main.slice(main.indexOf('function clearProtectedRuntimeData'), main.indexOf('const CRM_DATA_VIEWS'));
    const setup = main.slice(main.indexOf('function createLiveBuilderSetupController'), main.indexOf('function builderSetupStepIssues'));
    const saveSections = main.slice(main.indexOf('(window as any).savePageSections'), main.indexOf('// Attach to window for global access/testing'));
    expect(clear).toContain('builderPageSettingsController?.cancelPending()');
    expect(setup).toContain('setupIsCurrent()');
    expect(setup).toContain('requireCurrent(setupOperation');
    expect(saveSections).toContain('isCurrent(saveOperation');
  });
});
