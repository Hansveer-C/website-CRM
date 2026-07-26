import { supabase, safeDbCall } from './utils/db/supabase';
import { Page, RepoResponse, User } from './types';
import { mockPages } from './db';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

/**
 * 🔒 SERVER-ONLY REPOSITORY
 * Handles database operations for Website Pages.
 */
export const PagesRepo = {
  /**
   * Persists a page to Supabase.
   */
  async persistPage(page: Page, user: User | string): Promise<RepoResponse<Page>> {
    const userId = typeof user === 'string' ? user : user.id;
    const payload = { ...page, user_id: userId };

    if (!hasSupabase) {
      const idx = mockPages.findIndex(p => p.id === page.id);
      if (idx !== -1) {
        mockPages[idx] = payload;
      } else {
        mockPages.push(payload);
      }
      return { success: true, data: payload };
    }

    return safeDbCall('PERSIST_PAGE', userId, supabase
      .from('pages')
      .upsert(payload)
      .select()
      .single()
    );
  },

  /**
   * Retrieves a single page by ID, scoped to the user.
   */
  async getPage(id: string, user: User | string): Promise<RepoResponse<Page>> {
    const userId = typeof user === 'string' ? user : user.id;

    if (!hasSupabase) {
      const page = mockPages.find(p => p.id === id && p.user_id === userId);
      return page ? { success: true, data: page } : { success: false, error: 'NOT_FOUND' };
    }

    return safeDbCall('GET_PAGE', userId, supabase
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
  async getAllPages(user: User | string): Promise<RepoResponse<Page[]>> {
    const userId = typeof user === 'string' ? user : user.id;

    if (!hasSupabase) {
      return { success: true, data: mockPages.filter(p => p.user_id === userId) };
    }

    return safeDbCall('GET_ALL_PAGES', userId, supabase
      .from('pages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    );
  },

  /**
   * Deletes a page and all its sections (cascading).
   */
  async deletePage(id: string, user: User | string): Promise<RepoResponse<any>> {
    const userId = typeof user === 'string' ? user : user.id;

    if (!hasSupabase) {
      const idx = mockPages.findIndex(p => p.id === id && p.user_id === userId);
      if (idx !== -1) {
        mockPages.splice(idx, 1);
      }
      return { success: true, data: { id } };
    }

    return safeDbCall('DELETE_PAGE', userId, supabase
      .from('pages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    );
  }
};
