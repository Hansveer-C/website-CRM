import type { SupabaseClient } from '@supabase/supabase-js';
import type { BuilderMediaRepository } from './builder_media_repository';
import type { BuilderMediaLocalDatabase } from './builder_media_repository_local';

export type BuilderMediaPersistenceMode = 'local' | 'supabase' | 'auto';

export type BuilderMediaRuntimeResult =
  | { success: true; mode: 'local' | 'supabase'; repository: BuilderMediaRepository }
  | {
      success: false;
      code: 'INVALID_MODE' | 'LOCAL_UNAVAILABLE' | 'SUPABASE_NOT_CONFIGURED' | 'SUPABASE_NOT_AUTHENTICATED';
      message: string;
    };

export interface BuilderMediaRuntimeOptions {
  configuredMode?: string | null;
  production: boolean;
  userId?: string | null;
  supabaseConfigured: boolean;
  getLocalDatabase: () => BuilderMediaLocalDatabase | null | undefined;
  getSupabaseClient: () => SupabaseClient | null | undefined | Promise<SupabaseClient | null | undefined>;
  createLocalRepository: (database: BuilderMediaLocalDatabase, userId: string) => BuilderMediaRepository;
  createSupabaseRepository: (client: SupabaseClient) => BuilderMediaRepository;
}

export function parseBuilderMediaPersistenceMode(value?: string | null): BuilderMediaPersistenceMode | undefined {
  if (value === undefined || value === null || !value.trim()) return 'auto';
  const normalized = value.trim().toLowerCase();
  return normalized === 'local' || normalized === 'supabase' || normalized === 'auto'
    ? normalized
    : undefined;
}

export async function createBuilderMediaRuntime(
  options: BuilderMediaRuntimeOptions
): Promise<BuilderMediaRuntimeResult> {
  const mode = parseBuilderMediaPersistenceMode(options.configuredMode);
  if (!mode) return { success: false, code: 'INVALID_MODE', message: 'Builder media persistence mode is invalid.' };
  const resolved = mode === 'auto' ? (options.production ? 'supabase' : 'local') : mode;
  const userId = options.userId?.trim() ?? '';
  if (!userId) {
    return { success: false, code: 'SUPABASE_NOT_AUTHENTICATED', message: 'Sign in to use the media library.' };
  }

  if (resolved === 'local') {
    let database: BuilderMediaLocalDatabase | null | undefined;
    try { database = options.getLocalDatabase(); } catch { database = null; }
    if (!database) return { success: false, code: 'LOCAL_UNAVAILABLE', message: 'Browser media storage is unavailable.' };
    return { success: true, mode: 'local', repository: options.createLocalRepository(database, userId) };
  }

  if (!options.supabaseConfigured) {
    return { success: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Remote media storage is not configured.' };
  }
  const client = await options.getSupabaseClient();
  if (!client) return { success: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Remote media storage is unavailable.' };
  try {
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user || auth.data.user.id !== userId) {
      return { success: false, code: 'SUPABASE_NOT_AUTHENTICATED', message: 'Your media session could not be verified.' };
    }
  } catch {
    return { success: false, code: 'SUPABASE_NOT_AUTHENTICATED', message: 'Your media session could not be verified.' };
  }
  return { success: true, mode: 'supabase', repository: options.createSupabaseRepository(client) };
}
