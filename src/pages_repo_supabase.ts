import { supabase, safeDbCall } from './utils/db/supabase';
import { Page, RepoResponse, User } from './types';

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

    return safeDbCall('DELETE_PAGE', userId, supabase
      .from('pages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    );
  }
};
