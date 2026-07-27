import { Page, RepoResponse, User } from './types';
import { mockPages } from './db';
import type { BuilderPageSettingsPatch } from './builder_page_settings';
import type { SupabaseClient } from '@supabase/supabase-js';

async function getServerSupabaseClient(): Promise<SupabaseClient | null> {
  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.env.SUPABASE_URL) {
    return null;
  }
  const serverModulePath = './utils/db/supabase';
  const serverModule = await import(/* @vite-ignore */ serverModulePath) as {
    supabase?: SupabaseClient;
  };
  return serverModule.supabase ?? null;
}

async function queryResult<T>(
  promise: PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>
): Promise<RepoResponse<T>> {
  try {
    const { data, error } = await promise;
    if (error) return { success: false, error: error.message ?? 'DATABASE_ERROR', code: error.code };
    return { success: true, data: data as T };
  } catch {
    return { success: false, error: 'DATABASE_CRASH', code: 'INTERNAL_ERROR' };
  }
}

export interface CreatePageRepositoryInput {
  id: string;
  name: string;
  slug: string;
  funnelId: string;
  stepOrder?: number;
}

function localPagesStorageKey(userId: string): string {
  return `mock_pages_${userId}`;
}

function persistLocalPages(userId: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  try {
    window.localStorage.setItem(
      localPagesStorageKey(userId),
      JSON.stringify(mockPages.filter(page => page.user_id === userId))
    );
    return true;
  } catch {
    return false;
  }
}

function mapCreatedPage(row: Record<string, unknown>): Page {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status === 'published' ? 'published' : 'draft',
    seo_title: typeof row.seo_title === 'string' ? row.seo_title : '',
    seo_description: typeof row.seo_description === 'string' ? row.seo_description : '',
    seo_keywords: Array.isArray(row.seo_keywords)
      ? row.seo_keywords.filter((value): value is string => typeof value === 'string')
      : [],
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    ...(typeof row.funnel_id === 'string' ? { funnel_id: row.funnel_id } : {}),
    ...(typeof row.step_type === 'string' ? { step_type: row.step_type } : {}),
    ...(typeof row.step_order === 'number' && Number.isFinite(row.step_order) ? { step_order: row.step_order } : {})
  };
}

function matchesCreateRequest(page: Page, input: CreatePageRepositoryInput, userId: string): boolean {
  return page.id === input.id
    && page.user_id === userId
    && page.name === input.name
    && page.slug === input.slug
    && page.funnel_id === input.funnelId
    && page.status === 'draft';
}

/**
 * 🔒 SERVER-ONLY REPOSITORY
 * Handles database operations for Website Pages.
 */
export const PagesRepo = {
  hydrateLocalPages(user: User | string, remoteConfigured = false): void {
    if (remoteConfigured || typeof window === 'undefined' || !window.localStorage) return;
    const userId = typeof user === 'string' ? user : user.id;
    try {
      const raw = window.localStorage.getItem(localPagesStorageKey(userId));
      if (!raw) return;
      const pages = JSON.parse(raw) as unknown;
      if (!Array.isArray(pages)) return;
      pages.forEach(candidate => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
        const page = mapCreatedPage(candidate as Record<string, unknown>);
        if (!page.id || page.user_id !== userId || !page.name || !page.slug) return;
        const index = mockPages.findIndex(existing => existing.id === page.id && existing.user_id === userId);
        if (index >= 0) mockPages[index] = page;
        else mockPages.push(page);
      });
    } catch {
      // Corrupt local data is ignored; no partial blank Page is created.
    }
  },

  async createPage(
    input: CreatePageRepositoryInput,
    user: User | string,
    client?: SupabaseClient
  ): Promise<RepoResponse<Page>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();
    const useRemote = db !== null;

    if (!useRemote) {
      const existingById = mockPages.find(page => page.id === input.id);
      if (existingById) {
        return matchesCreateRequest(existingById, input, userId)
          ? { success: true, data: { ...existingById } }
          : { success: false, error: 'ID_CONFLICT', code: 'ID_CONFLICT' };
      }
      if (mockPages.some(page => page.user_id === userId && page.slug === input.slug)) {
        return { success: false, error: 'CONFLICT', code: '23505' };
      }
      const page: Page = {
        id: input.id,
        user_id: userId,
        name: input.name,
        slug: input.slug,
        status: 'draft',
        seo_title: '',
        seo_description: '',
        seo_keywords: [],
        created_at: new Date().toISOString(),
        funnel_id: input.funnelId,
        ...(input.stepOrder !== undefined ? { step_order: input.stepOrder } : {})
      };
      mockPages.push(page);
      if (!persistLocalPages(userId)) {
        mockPages.splice(mockPages.findIndex(candidate => candidate.id === page.id), 1);
        return { success: false, error: 'PERSISTENCE_ERROR', code: 'PERSISTENCE_ERROR' };
      }
      return { success: true, data: { ...page } };
    }

    try {
      const existing = await db.from('pages').select('*').eq('id', input.id).limit(1).maybeSingle();
      if (existing.error) return { success: false, error: 'UNAVAILABLE', code: existing.error.code };
      if (existing.data) {
        const page = mapCreatedPage(existing.data as Record<string, unknown>);
        return matchesCreateRequest(page, input, userId)
          ? { success: true, data: page }
          : { success: false, error: 'ID_CONFLICT', code: 'ID_CONFLICT' };
      }
      const payload = {
        id: input.id,
        user_id: userId,
        name: input.name,
        slug: input.slug,
        status: 'draft',
        seo_title: null,
        seo_description: null,
        seo_keywords: [],
        funnel_id: input.funnelId,
        ...(input.stepOrder !== undefined ? { step_order: input.stepOrder } : {})
      };
      const inserted = await db.from('pages').insert(payload).select('*').single();
      if (inserted.error || !inserted.data) {
        return { success: false, error: 'CREATE_FAILED', code: inserted.error?.code };
      }
      return { success: true, data: mapCreatedPage(inserted.data as Record<string, unknown>) };
    } catch {
      return { success: false, error: 'UNAVAILABLE', code: 'UNAVAILABLE' };
    }
  },

  /**
   * Updates only the Builder-authorized page metadata fields.
   */
  async updatePageSettings(
    id: string,
    patch: BuilderPageSettingsPatch,
    user: User | string,
    client?: SupabaseClient
  ): Promise<RepoResponse<Page>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();

    if (!db) {
      const index = mockPages.findIndex(page => page.id === id && page.user_id === userId);
      if (index < 0) return { success: false, error: 'NOT_FOUND', code: 'NOT_FOUND' };
      const nextPage = { ...mockPages[index], ...patch };
      const slugConflict = mockPages.some(page => (
        page.id !== id && page.user_id === userId && page.slug === nextPage.slug
      ));
      if (slugConflict) return { success: false, error: 'CONFLICT', code: '23505' };
      const previousPage = mockPages[index];
      mockPages[index] = nextPage;
      if (!persistLocalPages(userId)) {
        mockPages[index] = previousPage;
        return { success: false, error: 'PERSISTENCE_ERROR', code: 'PERSISTENCE_ERROR' };
      }
      return { success: true, data: nextPage };
    }

    return queryResult<Page>(db
      .from('pages')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    );
  },

  /**
   * Persists a page to Supabase.
   */
  async persistPage(page: Page, user: User | string, client?: SupabaseClient): Promise<RepoResponse<Page>> {
    const userId = typeof user === 'string' ? user : user.id;
    const payload = { ...page, user_id: userId };
    const db = client ?? await getServerSupabaseClient();

    if (!db) {
      const idx = mockPages.findIndex(p => p.id === page.id);
      if (idx !== -1) {
        mockPages[idx] = payload;
      } else {
        mockPages.push(payload);
      }
      return { success: true, data: payload };
    }

    return queryResult<Page>(db
      .from('pages')
      .upsert(payload)
      .select()
      .single()
    );
  },

  /**
   * Retrieves a single page by ID, scoped to the user.
   */
  async getPage(id: string, user: User | string, client?: SupabaseClient): Promise<RepoResponse<Page>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();

    if (!db) {
      const page = mockPages.find(p => p.id === id && p.user_id === userId);
      return page ? { success: true, data: page } : { success: false, error: 'NOT_FOUND' };
    }

    return queryResult<Page>(db
      .from('pages')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    );
  },

  /**
   * Retrieves all pages for a user.
   */
  async getAllPages(user: User | string, client?: SupabaseClient): Promise<RepoResponse<Page[]>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();

    if (!db) {
      return { success: true, data: mockPages.filter(p => p.user_id === userId) };
    }

    return queryResult<Page[]>(db
      .from('pages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    );
  },

  /**
   * Deletes a page and all its sections (cascading).
   */
  async deletePage(id: string, user: User | string, client?: SupabaseClient): Promise<RepoResponse<any>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();

    if (!db) {
      const idx = mockPages.findIndex(p => p.id === id && p.user_id === userId);
      if (idx !== -1) {
        mockPages.splice(idx, 1);
      }
      return { success: true, data: { id } };
    }

    return queryResult(db
      .from('pages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    );
  }
};
