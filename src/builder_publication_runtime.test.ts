import { describe, expect, it, vi } from 'vitest';
import type { BuilderPublicationRepository } from './builder_publication_repository';
import type { BuilderPublicationStorage } from './builder_publication_repository_local';
import {
  createBuilderPublicationRuntime,
  createBuilderPublicationRuntimeResolver,
  parseBuilderPublicationPersistenceMode,
  type BuilderPublicationAuthenticatedClient,
  type BuilderPublicationRuntimeOptions
} from './builder_publication_runtime';

const repository = {} as BuilderPublicationRepository;
const otherRepository = {} as BuilderPublicationRepository;

function makeStorage(): BuilderPublicationStorage {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn()
  };
}

function makeClient(userId: string | null = 'user-1', error: unknown = null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
        error
      }))
    }
  } satisfies BuilderPublicationAuthenticatedClient;
}

function makeOptions(
  overrides: Partial<BuilderPublicationRuntimeOptions> = {}
): BuilderPublicationRuntimeOptions {
  return {
    configuredMode: 'auto',
    production: false,
    actingUserId: 'user-1',
    supabaseConfigured: false,
    getStorage: vi.fn(() => makeStorage()),
    getSupabaseClient: vi.fn(async () => makeClient()),
    createLocalRepository: vi.fn(() => repository),
    createSupabaseRepository: vi.fn(() => otherRepository),
    ...overrides
  };
}

describe('Builder publication persistence mode parsing', () => {
  it.each([
    [undefined, 'auto'],
    [null, 'auto'],
    ['', 'auto'],
    ['   ', 'auto'],
    [' local ', 'local'],
    [' SUPABASE ', 'supabase'],
    [' AuTo ', 'auto']
  ])('normalizes %# to %s', (input, expected) => {
    expect(parseBuilderPublicationPersistenceMode(input)).toBe(expected);
  });

  it('rejects unknown nonblank values', async () => {
    const result = await createBuilderPublicationRuntime(makeOptions({
      configuredMode: 'remote'
    }));
    expect(result).toEqual({
      success: false,
      status: 'unavailable',
      failure: {
        code: 'INVALID_MODE',
        message: 'Builder publication persistence configuration is invalid.'
      }
    });
  });
});

describe('local Builder publication runtime', () => {
  it('selects the local repository without inspecting Supabase', async () => {
    const options = makeOptions({ configuredMode: 'local', supabaseConfigured: true });
    const result = await createBuilderPublicationRuntime(options);
    expect(result).toMatchObject({
      success: true,
      status: 'local',
      persistence: { mode: 'local', repository }
    });
    expect(options.getSupabaseClient).not.toHaveBeenCalled();
    expect(options.createSupabaseRepository).not.toHaveBeenCalled();
  });

  it('passes storage to the local factory without reading the snapshot', async () => {
    const storage = makeStorage();
    const options = makeOptions({
      configuredMode: 'local',
      getStorage: vi.fn(() => storage)
    });
    await createBuilderPublicationRuntime(options);
    expect(options.createLocalRepository).toHaveBeenCalledWith(storage);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['null', () => null],
    ['throwing', () => { throw new Error('private storage detail'); }]
  ])('returns a safe failure when storage is %s', async (_label, getStorage) => {
    const result = await createBuilderPublicationRuntime(makeOptions({
      configuredMode: 'local',
      getStorage
    }));
    expect(result).toMatchObject({
      success: false,
      status: 'unavailable',
      failure: { code: 'LOCAL_STORAGE_UNAVAILABLE' }
    });
    expect(JSON.stringify(result)).not.toContain('private storage detail');
  });
});

describe('Supabase Builder publication runtime', () => {
  it('selects Supabase without accessing local storage', async () => {
    const client = makeClient();
    const options = makeOptions({
      configuredMode: 'supabase',
      supabaseConfigured: true,
      getSupabaseClient: vi.fn(async () => client)
    });
    const result = await createBuilderPublicationRuntime(options);
    expect(result).toMatchObject({
      success: true,
      status: 'supabase',
      persistence: { mode: 'supabase', repository: otherRepository }
    });
    expect(options.getStorage).not.toHaveBeenCalled();
    expect(options.createLocalRepository).not.toHaveBeenCalled();
  });

  it('enables repository-level authenticated-user verification', async () => {
    const client = makeClient();
    const options = makeOptions({
      configuredMode: 'supabase',
      supabaseConfigured: true,
      getSupabaseClient: vi.fn(async () => client)
    });
    await createBuilderPublicationRuntime(options);
    expect(options.createSupabaseRepository).toHaveBeenCalledWith(client, {
      verifyAuthenticatedUser: true
    });
  });

  it('returns SUPABASE_NOT_CONFIGURED without falling back', async () => {
    const options = makeOptions({ configuredMode: 'supabase' });
    const result = await createBuilderPublicationRuntime(options);
    expect(result).toMatchObject({
      success: false,
      failure: { code: 'SUPABASE_NOT_CONFIGURED' }
    });
    expect(options.createLocalRepository).not.toHaveBeenCalled();
  });

  it.each([
    ['missing getter', undefined],
    ['missing client', async () => null],
    ['client initialization error', async () => { throw new Error('raw client failure'); }]
  ])('returns SUPABASE_CLIENT_UNAVAILABLE for %s', async (_label, getSupabaseClient) => {
    const result = await createBuilderPublicationRuntime(makeOptions({
      configuredMode: 'supabase',
      supabaseConfigured: true,
      getSupabaseClient
    }));
    expect(result).toMatchObject({
      success: false,
      failure: { code: 'SUPABASE_CLIENT_UNAVAILABLE' }
    });
    expect(JSON.stringify(result)).not.toContain('raw client failure');
  });

  it.each([
    ['missing user', makeClient(null)],
    ['auth error', makeClient(null, new Error('raw auth response'))],
    ['mismatched user', makeClient('user-2')]
  ])('returns a safe authentication failure for %s', async (_label, client) => {
    const options = makeOptions({
      configuredMode: 'supabase',
      supabaseConfigured: true,
      getSupabaseClient: vi.fn(async () => client)
    });
    const result = await createBuilderPublicationRuntime(options);
    expect(result).toMatchObject({
      success: false,
      failure: { code: 'SUPABASE_NOT_AUTHENTICATED' }
    });
    expect(JSON.stringify(result)).not.toContain('raw auth response');
    expect(options.createLocalRepository).not.toHaveBeenCalled();
  });

  it('requires a current acting user', async () => {
    const result = await createBuilderPublicationRuntime(makeOptions({
      configuredMode: 'supabase',
      supabaseConfigured: true,
      actingUserId: ' '
    }));
    expect(result).toMatchObject({
      success: false,
      failure: { code: 'SUPABASE_NOT_AUTHENTICATED' }
    });
  });

  it('succeeds only when the authenticated and acting users match', async () => {
    const client = makeClient('user-1');
    const result = await createBuilderPublicationRuntime(makeOptions({
      configuredMode: 'supabase',
      supabaseConfigured: true,
      actingUserId: 'user-1',
      getSupabaseClient: vi.fn(async () => client)
    }));
    expect(result.success).toBe(true);
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it('does not accept service-role configuration in its public options', () => {
    const options: BuilderPublicationRuntimeOptions = {
      ...makeOptions(),
      // @ts-expect-error Browser runtime options intentionally have no privileged-key input.
      serviceRoleKey: 'server-only-value'
    };
    expect('serviceRoleKey' in options).toBe(true);
    expect(createBuilderPublicationRuntime).toBeTypeOf('function');
  });
});

describe('auto mode and caching', () => {
  it('uses local storage in development when Supabase is not configured', async () => {
    const result = await createBuilderPublicationRuntime(makeOptions());
    expect(result).toMatchObject({ success: true, status: 'local' });
  });

  it('uses Supabase in development when configuration and authentication match', async () => {
    const result = await createBuilderPublicationRuntime(makeOptions({
      supabaseConfigured: true
    }));
    expect(result).toMatchObject({ success: true, status: 'supabase' });
  });

  it('deterministically falls back to local in development when auth is unavailable', async () => {
    const options = makeOptions({
      supabaseConfigured: true,
      getSupabaseClient: vi.fn(async () => makeClient(null))
    });
    const result = await createBuilderPublicationRuntime(options);
    expect(result).toMatchObject({ success: true, status: 'local' });
    expect(options.createLocalRepository).toHaveBeenCalledTimes(1);
  });

  it('requires configured Supabase in production auto mode', async () => {
    const options = makeOptions({ production: true });
    const result = await createBuilderPublicationRuntime(options);
    expect(result).toMatchObject({
      success: false,
      failure: { code: 'SUPABASE_NOT_CONFIGURED' }
    });
    expect(options.getStorage).not.toHaveBeenCalled();
  });

  it('never falls back locally after a production Supabase auth failure', async () => {
    const options = makeOptions({
      production: true,
      supabaseConfigured: true,
      getSupabaseClient: vi.fn(async () => makeClient(null))
    });
    const result = await createBuilderPublicationRuntime(options);
    expect(result).toMatchObject({
      success: false,
      failure: { code: 'SUPABASE_NOT_AUTHENTICATED' }
    });
    expect(options.getStorage).not.toHaveBeenCalled();
    expect(options.createLocalRepository).not.toHaveBeenCalled();
  });

  it('does not mutate its inputs', async () => {
    const options = makeOptions({ configuredMode: ' local ' });
    const before = { ...options };
    await createBuilderPublicationRuntime(options);
    expect(options).toEqual(before);
  });

  it('keeps all factories lazy until resolution', () => {
    const options = makeOptions();
    createBuilderPublicationRuntimeResolver(options);
    expect(options.getStorage).not.toHaveBeenCalled();
    expect(options.getSupabaseClient).not.toHaveBeenCalled();
    expect(options.createLocalRepository).not.toHaveBeenCalled();
    expect(options.createSupabaseRepository).not.toHaveBeenCalled();
  });

  it('creates one repository for repeated resolution of the same user and mode', async () => {
    const options = makeOptions({ configuredMode: 'local' });
    const resolver = createBuilderPublicationRuntimeResolver(options);
    const first = await resolver.resolve('user-1');
    const second = await resolver.resolve('user-1');
    expect(second).toBe(first);
    expect(options.createLocalRepository).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent resolution for the same user', async () => {
    const options = makeOptions({ configuredMode: 'supabase', supabaseConfigured: true });
    const resolver = createBuilderPublicationRuntimeResolver(options);
    await Promise.all([resolver.resolve('user-1'), resolver.resolve('user-1')]);
    expect(options.getSupabaseClient).toHaveBeenCalledTimes(1);
    expect(options.createSupabaseRepository).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cached repository when the acting user changes', async () => {
    const createLocalRepository = vi
      .fn<[BuilderPublicationStorage], BuilderPublicationRepository>()
      .mockReturnValueOnce(repository)
      .mockReturnValueOnce(otherRepository);
    const resolver = createBuilderPublicationRuntimeResolver(makeOptions({
      configuredMode: 'local',
      createLocalRepository
    }));
    const first = await resolver.resolve('user-1');
    const second = await resolver.resolve('user-2');
    expect(first.success && first.persistence.repository).toBe(repository);
    expect(second.success && second.persistence.repository).toBe(otherRepository);
    expect(createLocalRepository).toHaveBeenCalledTimes(2);
  });

  it('supports deliberate invalidation and re-resolution', async () => {
    const options = makeOptions({ configuredMode: 'local' });
    const resolver = createBuilderPublicationRuntimeResolver(options);
    await resolver.resolve('user-1');
    resolver.invalidate();
    await resolver.resolve('user-1');
    expect(options.createLocalRepository).toHaveBeenCalledTimes(2);
  });
});

describe('programmer misuse', () => {
  it('throws only when a mandatory repository factory is missing', async () => {
    const options = makeOptions();
    await expect(createBuilderPublicationRuntime({
      ...options,
      createLocalRepository: undefined as never
    })).rejects.toThrow('requires createLocalRepository');
    await expect(createBuilderPublicationRuntime({
      ...options,
      createSupabaseRepository: undefined as never
    })).rejects.toThrow('requires createSupabaseRepository');
  });
});
