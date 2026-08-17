import { Page, PageSection, RepoResponse, User } from './types';
import { mockPages, mockPageSections } from './db';
import type { BuilderPageSettingsPatch } from './builder_page_settings';
import { createDuplicatePageDefaults } from './builder_page_lifecycle';
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

export interface DuplicatePageRepositoryInput {
  sourcePageId: string;
  newPageId: string;
  name?: string;
  slug?: string;
  destinationFunnelId?: string;
  stepOrder?: number;
  generateSectionId?: () => string;
}

export interface DuplicatePageRepositoryResult {
  page: Page;
  sections: PageSection[];
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
    ...(typeof row.schema_markup === 'string' ? { schema_markup: row.schema_markup } : {}),
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
      const rpcPayload = {
        p_id: input.id || null,
        p_name: input.name,
        p_slug: input.slug,
        p_funnel_id: input.funnelId,
        p_step_order: input.stepOrder !== undefined ? input.stepOrder : null,
        p_seo_title: null,
        p_seo_description: null,
        p_seo_keywords: [],
        p_schema_markup: null
      };

      const rpcResult = await db.rpc('create_builder_page', rpcPayload);
      if (rpcResult.error) {
        const code = rpcResult.error.code;
        const message = rpcResult.error.message;
        if (code === 'PT401') return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
        if (code === 'PT403') return { success: false, error: 'FORBIDDEN', code: 'FORBIDDEN' };
        if (code === 'PT409' || code === '23505' || message?.includes('already uses this URL') || message?.includes('Page ID already exists')) {
          const isIdConflict = message?.includes('Page ID already exists');
          return { success: false, error: isIdConflict ? 'ID_CONFLICT' : 'CONFLICT', code: isIdConflict ? 'ID_CONFLICT' : '23505' };
        }
        if (code === 'PT422') return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' };
        return { success: false, error: message ?? 'CREATE_FAILED', code: code ?? 'UNAVAILABLE' };
      }

      const data = rpcResult.data as Record<string, unknown>;
      if (!data || !data.id) {
        return { success: false, error: 'INVALID_RESPONSE', code: 'INVALID_RESPONSE' };
      }

      return { success: true, data: mapCreatedPage(data) };
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
      return { success: true, data: { ...nextPage } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.slug !== undefined) payload.slug = patch.slug;
      if (patch.seo_title !== undefined) payload.seo_title = patch.seo_title || null;
      if (patch.seo_description !== undefined) payload.seo_description = patch.seo_description || null;

      const result = await db
        .from('pages')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
          code: result.error.code === '23505' ? '23505' : result.error.code
        };
      }

      return {
        success: true,
        data: mapCreatedPage(result.data as Record<string, unknown>)
      };
    } catch {
      return { success: false, error: 'UNAVAILABLE', code: 'UNAVAILABLE' };
    }
  },

  /**
   * Persists a Page record to storage.
   */
  async persistPage(page: Page, user: User | string, client?: SupabaseClient): Promise<RepoResponse<Page>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();

    if (!db) {
      const idx = mockPages.findIndex(p => p.id === page.id && p.user_id === userId);
      const existingSlug = mockPages.some(p => p.user_id === userId && p.slug === page.slug && p.id !== page.id);
      if (existingSlug) {
        return { success: false, error: 'CONFLICT', code: '23505' };
      }
      if (idx !== -1) {
        mockPages[idx] = { ...page, user_id: userId };
      } else {
        mockPages.push({ ...page, user_id: userId });
      }
      persistLocalPages(userId);
      return { success: true, data: page };
    }

    const payload = {
      id: page.id,
      user_id: userId,
      name: page.name,
      slug: page.slug,
      status: page.status,
      seo_title: page.seo_title || null,
      seo_description: page.seo_description || null,
      seo_keywords: page.seo_keywords || [],
      schema_markup: page.schema_markup || null,
      funnel_id: page.funnel_id,
      step_type: page.step_type,
      ...(page.step_order !== undefined ? { step_order: page.step_order } : {})
    };

    return queryResult<Page>(db
      .from('pages')
      .upsert(payload)
      .select('*')
      .single()
    );
  },

  /**
   * Fetches a single page by ID.
   */
  async getPage(id: string, user: User | string, client?: SupabaseClient): Promise<RepoResponse<Page | null>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();

    if (!db) {
      const page = mockPages.find(p => p.id === id && p.user_id === userId);
      return { success: true, data: page ? { ...page } : null };
    }

    return queryResult<Page | null>(db
      .from('pages')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    );
  },

  /**
   * Fetches all pages owned by the user.
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
  },

  /**
   * Duplicates a page and all of its sections atomically.
   */
  async duplicatePage(
    input: DuplicatePageRepositoryInput,
    user: User | string,
    client?: SupabaseClient
  ): Promise<RepoResponse<DuplicatePageRepositoryResult>> {
    const userId = typeof user === 'string' ? user : user.id;
    const db = client ?? await getServerSupabaseClient();
    const useRemote = db !== null;

    if (!useRemote) {
      const sourcePage = mockPages.find(page => page.id === input.sourcePageId && page.user_id === userId);
      if (!sourcePage) {
        return { success: false, error: 'SOURCE_PAGE_NOT_FOUND', code: 'NOT_FOUND' };
      }

      const newPageId = input.newPageId || crypto.randomUUID();
      if (mockPages.some(page => page.id === newPageId)) {
        return { success: false, error: 'ID_CONFLICT', code: 'ID_CONFLICT' };
      }

      // Real mock sections do NOT have user_id; scoped strictly through source page_id
      const sourceSections = mockPageSections.filter(s => s.page_id === input.sourcePageId);

      const defaults = createDuplicatePageDefaults({
        sourcePage,
        sourceSections,
        existingPages: mockPages.filter(p => p.user_id === userId),
        actingUserId: userId,
        newPageId,
        name: input.name,
        slug: input.slug,
        destinationFunnelId: input.destinationFunnelId,
        generateSectionId: input.generateSectionId
      });

      if (mockPages.some(page => page.user_id === userId && page.slug === defaults.page.slug)) {
        return { success: false, error: 'CONFLICT', code: '23505' };
      }

      const previousPages = [...mockPages];
      const previousSections = [...mockPageSections];

      mockPages.push(defaults.page);
      mockPageSections.push(...defaults.sections);

      let persistOk = persistLocalPages(userId);
      if (persistOk && typeof window !== 'undefined' && window.localStorage) {
        try {
          const storageKey = `mock_sections_${userId}:${defaults.page.id}`;
          window.localStorage.setItem(storageKey, JSON.stringify(defaults.sections));
        } catch {
          persistOk = false;
        }
      }

      if (!persistOk) {
        mockPages.splice(0, mockPages.length, ...previousPages);
        mockPageSections.splice(0, mockPageSections.length, ...previousSections);
        persistLocalPages(userId);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.removeItem(`mock_sections_${userId}:${defaults.page.id}`);
          } catch {
            // ignore
          }
        }
        return { success: false, error: 'PERSISTENCE_ERROR', code: 'PERSISTENCE_ERROR' };
      }

      return {
        success: true,
        data: {
          page: { ...defaults.page },
          sections: defaults.sections.map(s => ({ ...s }))
        }
      };
    }

    try {
      const rpcPayload = {
        p_page_id: input.sourcePageId,
        p_new_page_id: input.newPageId || null
      };

      const rpcResult = await db.rpc('duplicate_builder_page', rpcPayload);
      if (rpcResult.error) {
        const code = rpcResult.error.code;
        const message = rpcResult.error.message;
        if (code === 'PT404' || message?.includes('Page not found')) {
          return { success: false, error: 'SOURCE_PAGE_NOT_FOUND', code: 'NOT_FOUND' };
        }
        if (code === 'PT401' || message?.includes('Authentication required')) {
          return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
        }
        if (code === 'PT403') {
          return { success: false, error: 'FORBIDDEN', code: 'FORBIDDEN' };
        }
        if (code === 'PT409' || code === '23505' || message?.includes('already exists') || message?.includes('already uses this URL')) {
          return { success: false, error: 'CONFLICT', code: 'CONFLICT' };
        }
        return { success: false, error: message ?? 'DUPLICATE_FAILED', code: code ?? 'UNAVAILABLE' };
      }

      const data = rpcResult.data as { page?: Record<string, unknown>; sections?: Record<string, unknown>[] };
      if (!data || !data.page) {
        return { success: false, error: 'INVALID_RESPONSE', code: 'INVALID_RESPONSE' };
      }

      const mappedPage = mapCreatedPage(data.page);
      const mappedSections: PageSection[] = Array.isArray(data.sections)
        ? data.sections.map((row: any) => ({
            id: String(row.id),
            page_id: String(row.page_id),
            type: String(row.type),
            content: typeof row.content === 'object' && row.content !== null ? row.content : {},
            styles: typeof row.styles === 'object' && row.styles !== null ? row.styles : {},
            order: typeof row.order === 'number' ? row.order : (typeof row.order_index === 'number' ? row.order_index : 0),
            ...(row.variant ? { variant: String(row.variant) } : {})
          }))
        : [];

      return {
        success: true,
        data: {
          page: mappedPage,
          sections: mappedSections
        }
      };
    } catch {
      return { success: false, error: 'UNAVAILABLE', code: 'UNAVAILABLE' };
    }
  }
};
