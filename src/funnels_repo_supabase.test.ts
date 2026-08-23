import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Funnel, Website } from './types';

const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function localRepo() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.resetModules();
  const db = await import('./db');
  const repo = await import('./funnels_repo_supabase');
  return { ...db, ...repo };
}

describe('FunnelsRepo ownership authority', () => {
  beforeEach(() => vi.doUnmock('./utils/db/supabase'));

  afterEach(() => {
    vi.doUnmock('./utils/db/supabase');
    vi.resetModules();
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  });

  it('permits an owned local Website funnel, rejects unknown or foreign Websites, and allows standalone funnels', async () => {
    const owner = 'local-owner';
    const ownedWebsite: Website = {
      id: 'owned-website', user_id: owner, name: 'Owned', domain: null, subdomain: 'owned',
      homepage_funnel_id: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
    };
    const { FunnelsRepo, mockWebsites } = await localRepo();
    mockWebsites.splice(0, mockWebsites.length, ownedWebsite, { ...ownedWebsite, id: 'foreign-website', user_id: 'other-user' });

    await expect(FunnelsRepo.createFunnel(owner, 'Website funnel', undefined, undefined, ownedWebsite.id)).resolves.toMatchObject({ success: true, data: { website_id: ownedWebsite.id } });
    await expect(FunnelsRepo.createFunnel(owner, 'Unknown', undefined, undefined, 'missing-website')).resolves.toMatchObject({ success: false, error: 'WEBSITE_NOT_FOUND' });
    await expect(FunnelsRepo.createFunnel(owner, 'Foreign', undefined, undefined, 'foreign-website')).resolves.toMatchObject({ success: false, error: 'WEBSITE_NOT_FOUND' });
    await expect(FunnelsRepo.createFunnel(owner, 'Standalone')).resolves.toMatchObject({ success: true, data: { website_id: null } });
  });

  it('does not use mock Websites as authority for remote creation and returns database ownership failures truthfully', async () => {
    const insert = vi.fn(() => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Funnel must belong to the selected website and tenant', code: '23514' } }) }) }));
    const from = vi.fn(() => ({ insert }));
    vi.doMock('./utils/db/supabase', () => ({
      supabase: { from },
      safeDbCall: async (_operation: string, _userId: string, request: Promise<{ data: Funnel | null; error: { message: string; code: string } | null }>) => {
        const { data, error } = await request;
        return error ? { success: false, error: error.message, code: error.code } : { success: true, data };
      }
    }));
    process.env.SUPABASE_URL = 'https://remote.example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    vi.resetModules();
    const { FunnelsRepo } = await import('./funnels_repo_supabase');

    const result = await FunnelsRepo.createFunnel('remote-owner', 'Remote Website funnel', undefined, undefined, 'website-absent-from-mocks');
    expect(from).toHaveBeenCalledWith('funnels');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ website_id: 'website-absent-from-mocks', user_id: 'remote-owner' }));
    expect(result).toMatchObject({ success: false, code: '23514', error: 'Funnel must belong to the selected website and tenant' });
  });

  it('does not allow ordinary metadata updates to smuggle ownership identity changes', async () => {
    const owner = 'local-owner';
    const funnel: Funnel = {
      id: 'local-funnel', user_id: owner, website_id: 'owned-website', name: 'Before', status: 'draft',
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
    };
    const { FunnelsRepo, mockFunnels } = await localRepo();
    mockFunnels.splice(0, mockFunnels.length, funnel);

    const result = await FunnelsRepo.updateFunnel(owner, funnel.id, { name: 'After', website_id: 'other-website', user_id: 'other-user' } as never);
    expect(result).toMatchObject({ success: true, data: { name: 'After', website_id: 'owned-website', user_id: owner } });
  });
});
