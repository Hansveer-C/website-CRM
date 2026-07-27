import type { BuilderPublicationRepository } from './builder_publication_repository';
import type { BuilderPublicationStorage } from './builder_publication_repository_local';

export type BuilderPublicationPersistenceMode =
  | 'local'
  | 'supabase'
  | 'auto';

export type ResolvedBuilderPublicationPersistence =
  | {
      mode: 'local';
      repository: BuilderPublicationRepository;
    }
  | {
      mode: 'supabase';
      repository: BuilderPublicationRepository;
    };

export type BuilderPublicationRuntimeFailure = {
  code:
    | 'INVALID_MODE'
    | 'SUPABASE_NOT_CONFIGURED'
    | 'SUPABASE_NOT_AUTHENTICATED'
    | 'SUPABASE_CLIENT_UNAVAILABLE'
    | 'LOCAL_STORAGE_UNAVAILABLE';
  message: string;
};

export type BuilderPublicationRuntimeStatus =
  | 'local'
  | 'supabase'
  | 'unavailable';

export type BuilderPublicationRuntimeResult =
  | {
      success: true;
      status: 'local' | 'supabase';
      persistence: ResolvedBuilderPublicationPersistence;
    }
  | {
      success: false;
      status: 'unavailable';
      failure: BuilderPublicationRuntimeFailure;
    };

export interface BuilderPublicationAuthenticatedClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
}

export interface BuilderPublicationRuntimeOptions {
  configuredMode?: string | null;
  production: boolean;
  actingUserId?: string | null;
  supabaseConfigured: boolean;
  getStorage?: () => BuilderPublicationStorage | null | undefined;
  getSupabaseClient?: () =>
    | BuilderPublicationAuthenticatedClient
    | null
    | undefined
    | Promise<BuilderPublicationAuthenticatedClient | null | undefined>;
  createLocalRepository: (
    storage: BuilderPublicationStorage
  ) => BuilderPublicationRepository;
  createSupabaseRepository: (
    client: BuilderPublicationAuthenticatedClient,
    options: { verifyAuthenticatedUser: true }
  ) => BuilderPublicationRepository;
}

export interface BuilderPublicationRuntimeResolverOptions
extends Omit<BuilderPublicationRuntimeOptions, 'actingUserId'> {}

export interface BuilderPublicationRuntimeResolver {
  resolve(actingUserId?: string | null): Promise<BuilderPublicationRuntimeResult>;
  invalidate(): void;
}

const FAILURES = {
  invalidMode: (): BuilderPublicationRuntimeFailure => ({
    code: 'INVALID_MODE',
    message: 'Builder publication persistence configuration is invalid.'
  }),
  supabaseNotConfigured: (): BuilderPublicationRuntimeFailure => ({
    code: 'SUPABASE_NOT_CONFIGURED',
    message: 'Publishing is unavailable because remote storage is not configured.'
  }),
  supabaseNotAuthenticated: (): BuilderPublicationRuntimeFailure => ({
    code: 'SUPABASE_NOT_AUTHENTICATED',
    message: 'Publishing is unavailable because your Supabase session could not be verified.'
  }),
  supabaseClientUnavailable: (): BuilderPublicationRuntimeFailure => ({
    code: 'SUPABASE_CLIENT_UNAVAILABLE',
    message: 'Publishing is unavailable because remote storage could not be initialized.'
  }),
  localStorageUnavailable: (): BuilderPublicationRuntimeFailure => ({
    code: 'LOCAL_STORAGE_UNAVAILABLE',
    message: 'Publishing is unavailable because browser storage could not be accessed.'
  })
};

function unavailable(failure: BuilderPublicationRuntimeFailure): BuilderPublicationRuntimeResult {
  return { success: false, status: 'unavailable', failure };
}

export function parseBuilderPublicationPersistenceMode(
  value?: string | null
): BuilderPublicationPersistenceMode | undefined {
  if (value === undefined || value === null || !value.trim()) return 'auto';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'local' || normalized === 'supabase' || normalized === 'auto') {
    return normalized;
  }
  return undefined;
}

function assertFactories(options: BuilderPublicationRuntimeOptions): void {
  if (!options || typeof options.createLocalRepository !== 'function') {
    throw new Error('createBuilderPublicationRuntime requires createLocalRepository.');
  }
  if (typeof options.createSupabaseRepository !== 'function') {
    throw new Error('createBuilderPublicationRuntime requires createSupabaseRepository.');
  }
  if (typeof options.production !== 'boolean') {
    throw new Error('createBuilderPublicationRuntime requires a production flag.');
  }
}

function createLocalRuntime(
  options: BuilderPublicationRuntimeOptions
): BuilderPublicationRuntimeResult {
  let storage: BuilderPublicationStorage | null | undefined;
  try {
    storage = options.getStorage?.();
  } catch {
    return unavailable(FAILURES.localStorageUnavailable());
  }
  if (!storage) return unavailable(FAILURES.localStorageUnavailable());

  try {
    const repository = options.createLocalRepository(storage);
    return {
      success: true,
      status: 'local',
      persistence: { mode: 'local', repository }
    };
  } catch {
    return unavailable(FAILURES.localStorageUnavailable());
  }
}

async function createSupabaseRuntime(
  options: BuilderPublicationRuntimeOptions
): Promise<BuilderPublicationRuntimeResult> {
  if (!options.supabaseConfigured) {
    return unavailable(FAILURES.supabaseNotConfigured());
  }
  if (typeof options.getSupabaseClient !== 'function') {
    return unavailable(FAILURES.supabaseClientUnavailable());
  }

  let client: BuilderPublicationAuthenticatedClient | null | undefined;
  try {
    client = await options.getSupabaseClient();
  } catch {
    return unavailable(FAILURES.supabaseClientUnavailable());
  }
  if (!client || !client.auth || typeof client.auth.getUser !== 'function') {
    return unavailable(FAILURES.supabaseClientUnavailable());
  }

  const actingUserId = typeof options.actingUserId === 'string'
    ? options.actingUserId.trim()
    : '';
  if (!actingUserId) {
    return unavailable(FAILURES.supabaseNotAuthenticated());
  }

  try {
    const result = await client.auth.getUser();
    if (result.error || !result.data.user || result.data.user.id !== actingUserId) {
      return unavailable(FAILURES.supabaseNotAuthenticated());
    }
  } catch {
    return unavailable(FAILURES.supabaseNotAuthenticated());
  }

  try {
    const repository = options.createSupabaseRepository(client, {
      verifyAuthenticatedUser: true
    });
    return {
      success: true,
      status: 'supabase',
      persistence: { mode: 'supabase', repository }
    };
  } catch {
    return unavailable(FAILURES.supabaseClientUnavailable());
  }
}

export async function createBuilderPublicationRuntime(
  options: BuilderPublicationRuntimeOptions
): Promise<BuilderPublicationRuntimeResult> {
  assertFactories(options);
  const mode = parseBuilderPublicationPersistenceMode(options.configuredMode);
  if (!mode) return unavailable(FAILURES.invalidMode());

  if (mode === 'local') return createLocalRuntime(options);
  if (mode === 'supabase' || options.production) {
    return createSupabaseRuntime(options);
  }

  if (options.supabaseConfigured) {
    const supabase = await createSupabaseRuntime(options);
    if (supabase.success) return supabase;
  }
  return createLocalRuntime(options);
}

export function createBuilderPublicationRuntimeResolver(
  options: BuilderPublicationRuntimeResolverOptions
): BuilderPublicationRuntimeResolver {
  assertFactories({ ...options, actingUserId: undefined });

  let cachedUserId: string | null = null;
  let cachedResult: BuilderPublicationRuntimeResult | null = null;
  let pendingUserId: string | null = null;
  let pendingResult: Promise<BuilderPublicationRuntimeResult> | null = null;

  return {
    async resolve(actingUserId?: string | null): Promise<BuilderPublicationRuntimeResult> {
      const normalizedUserId = typeof actingUserId === 'string'
        ? actingUserId.trim()
        : '';
      if (cachedResult && cachedUserId === normalizedUserId) return cachedResult;
      if (pendingResult && pendingUserId === normalizedUserId) return pendingResult;

      cachedResult = null;
      cachedUserId = null;
      const currentPromise = createBuilderPublicationRuntime({
        ...options,
        actingUserId: normalizedUserId
      });
      pendingUserId = normalizedUserId;
      pendingResult = currentPromise;

      const result = await currentPromise;
      if (pendingResult === currentPromise) {
        pendingResult = null;
        pendingUserId = null;
        if (result.success) {
          cachedUserId = normalizedUserId;
          cachedResult = result;
        }
      }
      return result;
    },
    invalidate(): void {
      cachedUserId = null;
      cachedResult = null;
      pendingUserId = null;
      pendingResult = null;
    }
  };
}
