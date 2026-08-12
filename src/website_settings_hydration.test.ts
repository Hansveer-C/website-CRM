import { describe, expect, it, vi } from 'vitest';
import type { Website, WebsiteSettings } from './types';
import {
  createNeutralWebsiteSettings,
  WebsiteSettingsHydrator,
  type WebsiteSettingsHydrationClient
} from './website_settings_hydration';

const website = (id: string, userId: string): Website => ({ id, user_id: userId } as Website);
const settings = (id: string, websiteId: string, userId: string, businessName: string): WebsiteSettings => ({
  ...createNeutralWebsiteSettings(), id, website_id: websiteId, user_id: userId, business_name: businessName
});

function client(rows: Map<string, unknown>, failures = new Set<string>()): WebsiteSettingsHydrationClient & { from: ReturnType<typeof vi.fn> } {
  const from = vi.fn(() => ({ select: () => ({ eq: (_userColumn: 'user_id', userId: string) => ({
    eq: (_websiteColumn: 'website_id', websiteId: string) => ({ limit: () => ({ maybeSingle: async () => failures.has(websiteId)
      ? { data: null, error: { code: 'PGRST_ERROR' } }
      : { data: rows.get(`${userId}:${websiteId}`) ?? null, error: null } }) })
  }) }) }));
  return { from } as never;
}

describe('WebsiteSettingsHydrator', () => {
  it('does not mutate local fixture state merely by being constructed', () => {
    const target = settings('fixture', 'fixture-site', 'system', 'Local Fixture Business');
    new WebsiteSettingsHydrator(async () => client(new Map()), target);
    expect(target.business_name).toBe('Local Fixture Business');
    expect(target.website_id).toBe('fixture-site');
  });

  it('loads settings for each owned user and never exposes Tenant A to Tenant B', async () => {
    const target = createNeutralWebsiteSettings();
    const source = client(new Map([
      ['user-a:site-a', settings('sa', 'site-a', 'user-a', 'Tenant A Business')],
      ['user-b:site-b', settings('sb', 'site-b', 'user-b', 'Tenant B Business')]
    ]));
    const hydrator = new WebsiteSettingsHydrator(async () => source, target);
    expect((await hydrator.hydrate('user-a', website('site-a', 'user-a'))).status).toBe('ready');
    expect(target.business_name).toBe('Tenant A Business');
    hydrator.clear();
    expect(target.business_name).toBe('Your Business');
    expect((await hydrator.hydrate('user-b', website('site-b', 'user-b'))).status).toBe('ready');
    expect(target.business_name).toBe('Tenant B Business');
    expect(JSON.stringify(target)).not.toContain('Tenant A Business');
  });

  it('rejects foreign and missing Websites before querying settings', async () => {
    const target = settings('stale', 'site-a', 'user-a', 'Tenant A Business');
    const source = client(new Map());
    const hydrator = new WebsiteSettingsHydrator(async () => source, target);
    expect((await hydrator.hydrate('user-b', website('site-a', 'user-a'))).status).toBe('error');
    expect((await hydrator.hydrate('user-b', undefined)).status).toBe('error');
    expect(source.from).not.toHaveBeenCalled();
    expect(target).toEqual(createNeutralWebsiteSettings());
  });

  it('uses a neutral non-persisted fallback for a missing settings row', async () => {
    const target = settings('stale', 'old', 'user-a', 'Tenant A Business');
    const hydrator = new WebsiteSettingsHydrator(async () => client(new Map()), target);
    expect((await hydrator.hydrate('user-b', website('site-b', 'user-b'))).status).toBe('empty');
    expect(target).toEqual(createNeutralWebsiteSettings());
  });

  it('clears stale settings on query failure', async () => {
    const target = settings('stale', 'site-a', 'user-a', 'Tenant A Business');
    const hydrator = new WebsiteSettingsHydrator(async () => client(new Map(), new Set(['site-b'])), target);
    expect((await hydrator.hydrate('user-b', website('site-b', 'user-b'))).status).toBe('error');
    expect(target).toEqual(createNeutralWebsiteSettings());
  });

  it('ignores a delayed User A response after User B begins loading', async () => {
    const target = createNeutralWebsiteSettings();
    let releaseA!: (value: { data: unknown; error: null }) => void;
    const delayedA = new Promise<{ data: unknown; error: null }>(resolve => { releaseA = resolve; });
    const firstClient: WebsiteSettingsHydrationClient = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => delayedA }) }) }) }) }) };
    const secondClient = client(new Map([['user-b:site-b', settings('sb', 'site-b', 'user-b', 'Tenant B Business')]]));
    let activeClient: WebsiteSettingsHydrationClient = firstClient;
    const hydrator = new WebsiteSettingsHydrator(async () => activeClient, target);
    const first = hydrator.hydrate('user-a', website('site-a', 'user-a'));
    activeClient = secondClient;
    await hydrator.hydrate('user-b', website('site-b', 'user-b'));
    releaseA({ data: settings('sa', 'site-a', 'user-a', 'Tenant A Business'), error: null });
    await first;
    expect(target.business_name).toBe('Tenant B Business');
  });

  it('replaces settings when the same user switches Websites without duplication', async () => {
    const target = createNeutralWebsiteSettings();
    const source = client(new Map([
      ['user-a:site-a', settings('sa', 'site-a', 'user-a', 'Website A Business')],
      ['user-a:site-b', settings('sb', 'site-b', 'user-a', 'Website B Business')]
    ]));
    const hydrator = new WebsiteSettingsHydrator(async () => source, target);
    await hydrator.hydrate('user-a', website('site-a', 'user-a'));
    await hydrator.hydrate('user-a', website('site-b', 'user-a'));
    await hydrator.hydrate('user-a', website('site-b', 'user-a'));
    expect(target.business_name).toBe('Website B Business');
    expect(target.website_id).toBe('site-b');
    expect(Object.keys(target).filter(key => key === 'business_name')).toHaveLength(1);
  });

  it('force reload restores the current Website from its durable row', async () => {
    const target = createNeutralWebsiteSettings();
    const rows = new Map<string, unknown>([
      ['user-a:site-a', settings('sa', 'site-a', 'user-a', 'Original Business')]
    ]);
    const source = client(rows);
    const hydrator = new WebsiteSettingsHydrator(async () => source, target);
    await hydrator.hydrate('user-a', website('site-a', 'user-a'));
    target.business_name = 'Unconfirmed Browser Edit';
    await hydrator.hydrate('user-a', website('site-a', 'user-a'), true);
    expect(target.business_name).toBe('Original Business');
    expect(source.from).toHaveBeenCalledTimes(2);
  });

  it('normalizes nullable optional database fields without inheriting stale branding', async () => {
    const target = settings('old', 'old-site', 'user-a', 'Tenant A Business');
    target.phone = '555-tenant-a';
    const row = {
      id: 'sb', user_id: 'user-b', website_id: 'site-b', business_name: 'Tenant B Business',
      phone: null, email: null, logo_url: null, primary_color: null
    };
    const hydrator = new WebsiteSettingsHydrator(
      async () => client(new Map([['user-b:site-b', row]])),
      target
    );
    expect((await hydrator.hydrate('user-b', website('site-b', 'user-b'))).status).toBe('ready');
    expect(target).toMatchObject({
      business_name: 'Tenant B Business', phone: '', email: '', logo_url: '', primary_color: '#2563eb'
    });
    expect(JSON.stringify(target)).not.toContain('Tenant A');
    expect(JSON.stringify(target)).not.toContain('555-tenant-a');
  });

  it('accepts confirmed saves only for the currently active user and Website', async () => {
    const target = createNeutralWebsiteSettings();
    const hydrator = new WebsiteSettingsHydrator(async () => client(new Map()), target);
    await hydrator.hydrate('user-b', website('site-b', 'user-b'));
    expect(hydrator.acceptConfirmed('user-a', 'site-a', settings('sa', 'site-a', 'user-a', 'Tenant A Business'))).toBe(false);
    expect(hydrator.acceptConfirmed('user-b', 'site-b', settings('sb', 'site-b', 'user-b', 'Tenant B Business'))).toBe(true);
    expect(target.business_name).toBe('Tenant B Business');
  });
});
