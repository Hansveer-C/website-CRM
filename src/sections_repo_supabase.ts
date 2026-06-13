import { supabase, safeDbCall } from './utils/db/supabase';
import { PageSection, RepoResponse, User } from './types';
import { mockPageSections } from './db';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

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

    if (!hasSupabase) {
      const idx = mockPageSections.findIndex(s => s.id === section.id);
      const payload = {
        ...section,
        user_id: userId
      };
      if (idx !== -1) {
        mockPageSections[idx] = payload as any;
      } else {
        mockPageSections.push(payload as any);
      }

      // Persist the entire active set of sections for this page/user to localStorage
      if (typeof window !== 'undefined') {
        try {
          const storageKey = `mock_sections_${userId}:${section.page_id}`;
          const pageSections = mockPageSections.filter(s => s.page_id === section.page_id && (s as any).user_id === userId);
          window.localStorage.setItem(storageKey, JSON.stringify(pageSections));
        } catch (e) {
          console.error('Failed to save page sections to localStorage:', e);
        }
      }

      return { success: true, data: payload as PageSection };
    }

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

    if (!hasSupabase) {
      // Check and restore sections from localStorage first in browser local/mock mode
      if (typeof window !== 'undefined') {
        const storageKey = `mock_sections_${userId}:${pageId}`;
        const cached = window.localStorage.getItem(storageKey);
        if (cached) {
          try {
             const parsed = JSON.parse(cached);
             if (Array.isArray(parsed)) {
                for (const s of parsed) {
                   const idx = mockPageSections.findIndex(x => x.id === s.id);
                   if (idx !== -1) {
                      mockPageSections[idx] = s;
                   } else {
                      mockPageSections.push(s);
                   }
                }
             } else {
                throw new Error('Cached sections is not a valid array');
             }
          } catch (e) {
             console.error('Failed to parse cached page sections from localStorage (corrupted), clearing key:', e);
             try {
                window.localStorage.removeItem(storageKey);
             } catch (err) {
                console.error('Failed to remove corrupted key:', err);
             }
          }
        }
      }

      const list = mockPageSections
        .filter(s => s.page_id === pageId && (s as any).user_id === userId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      return { success: true, data: list };
    }

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

    if (!hasSupabase) {
      for (const s of sections) {
        const item = mockPageSections.find(x => x.id === s.id);
        if (item) {
          item.order = s.order;
        }
      }
      return { success: true, data: sections };
    }

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

    if (!hasSupabase) {
      const idx = mockPageSections.findIndex(s => s.id === id && (s as any).user_id === userId);
      if (idx !== -1) {
        mockPageSections.splice(idx, 1);
      }
      return { success: true, data: { id } };
    }

    return safeDbCall('DELETE_SECTION', userId, supabase
      .from('page_sections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    );
  }
};
