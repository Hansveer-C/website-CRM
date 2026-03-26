import { supabase, safeDbCall } from './utils/db/supabase';
import { PageSection, RepoResponse, User } from './types';

/**
 * 🔒 SERVER-ONLY REPOSITORY
 * Handles database operations for Page Sections (Website Builder blocks).
 */
export const SectionsRepo = {
  /**
   * Persists a single section to Supabase.
   */
  async persistSection(section: PageSection, user: User | string): Promise<RepoResponse<PageSection>> {
    const userId = typeof user === 'string' ? user : user.id;
    const payload = {
      ...section,
      user_id: userId,
      order_index: section.order // Map local 'order' to DB 'order_index'
    };

    // Remove local 'order' property to match DB schema
    delete (payload as any).order;

    return safeDbCall('PERSIST_SECTION', userId, supabase
      .from('page_sections')
      .upsert(payload)
      .select('*, order:order_index')
      .single()
    );
  },

  /**
   * Retrieves all sections for a specific page.
   */
  async getSectionsForPage(pageId: string, user: User | string): Promise<RepoResponse<PageSection[]>> {
    const userId = typeof user === 'string' ? user : user.id;

    return safeDbCall('GET_SECTIONS_FOR_PAGE', userId, supabase
      .from('page_sections')
      .select('*, order:order_index')
      .eq('page_id', pageId)
      .eq('user_id', userId)
      .order('order_index', { ascending: true })
    );
  },

  /**
   * Reorders multiple sections for a page.
   */
  async reorderSections(pageId: string, sections: { id: string, order: number }[], user: User | string): Promise<RepoResponse<any>> {
    const userId = typeof user === 'string' ? user : user.id;

    const payload = sections.map(s => ({
        id: s.id,
        user_id: userId,
        page_id: pageId,
        order_index: s.order
    }));

    // Perform bulk upsert for reordering
    return safeDbCall('REORDER_SECTIONS', userId, supabase
      .from('page_sections')
      .upsert(payload)
      .select('id')
    );
  },

  /**
   * Deletes a single section.
   */
  async deleteSection(id: string, user: User | string): Promise<RepoResponse<any>> {
    const userId = typeof user === 'string' ? user : user.id;

    return safeDbCall('DELETE_SECTION', userId, supabase
      .from('page_sections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    );
  }
};
