import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBuilderMediaRuntime, parseBuilderMediaPersistenceMode } from './builder_media_runtime';
import type { BuilderMediaRepository } from './builder_media_repository';

const repository = {} as BuilderMediaRepository;
const database = { put: vi.fn(), getAll: vi.fn() };
const client = (userId = 'user-1') => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) }
}) as unknown as SupabaseClient;

function options(production: boolean) {
  return {
    production,
    userId: 'user-1',
    supabaseConfigured: true,
    getLocalDatabase: () => database,
    getSupabaseClient: () => client(),
    createLocalRepository: () => repository,
    createSupabaseRepository: () => repository
  };
}

describe('builder media runtime', () => {
  it('normalizes configuration and rejects invalid values', () => {
    expect(parseBuilderMediaPersistenceMode(' SUPABASE ')).toBe('supabase');
    expect(parseBuilderMediaPersistenceMode(undefined)).toBe('auto');
    expect(parseBuilderMediaPersistenceMode('fallback')).toBeUndefined();
  });

  it('resolves auto to local in development and Supabase in production', async () => {
    await expect(createBuilderMediaRuntime(options(false))).resolves.toMatchObject({ success: true, mode: 'local' });
    await expect(createBuilderMediaRuntime(options(true))).resolves.toMatchObject({ success: true, mode: 'supabase' });
  });

  it('does not silently fall back when Supabase authentication fails', async () => {
    const value = options(true);
    value.getSupabaseClient = () => client('someone-else');
    await expect(createBuilderMediaRuntime(value)).resolves.toMatchObject({
      success: false, code: 'SUPABASE_NOT_AUTHENTICATED'
    });
  });

  it('explicit local never initializes Supabase and explicit Supabase never initializes IndexedDB', async () => {
    const local = { ...options(true), configuredMode: 'local' };
    const getSupabaseClient = vi.fn(local.getSupabaseClient);
    local.getSupabaseClient = getSupabaseClient;
    await createBuilderMediaRuntime(local);
    expect(getSupabaseClient).not.toHaveBeenCalled();

    const remote = { ...options(false), configuredMode: 'supabase' };
    const getLocalDatabase = vi.fn(remote.getLocalDatabase);
    remote.getLocalDatabase = getLocalDatabase;
    await createBuilderMediaRuntime(remote);
    expect(getLocalDatabase).not.toHaveBeenCalled();
  });

  it('fails safely for invalid mode, missing auth, and unavailable production Supabase', async () => {
    await expect(createBuilderMediaRuntime({ ...options(false), configuredMode: 'other' }))
      .resolves.toMatchObject({ success: false, code: 'INVALID_MODE' });
    await expect(createBuilderMediaRuntime({ ...options(false), userId: ' ' }))
      .resolves.toMatchObject({ success: false, code: 'SUPABASE_NOT_AUTHENTICATED' });
    await expect(createBuilderMediaRuntime({ ...options(true), supabaseConfigured: false }))
      .resolves.toMatchObject({ success: false, code: 'SUPABASE_NOT_CONFIGURED' });
  });
});
