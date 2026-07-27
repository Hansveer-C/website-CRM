import { DB } from './utils/db/db_module';
import { WebsiteLayout } from './types';
import { mockWebsiteLayouts } from './db';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

/**
 * Website Layout Repository (Supabase Version).
 * Introduced in Phase W1.4 to manage global website architecture like 
 * shared headers and footers for consistent branding.
 */
export const WebsiteLayoutsRepo = {
  /**
   * Retrieves the layout configuration for a specific website container.
   */
  async getLayoutByWebsite(website_id: string): Promise<WebsiteLayout | null> {
    if (!website_id) return null;

    if (!hasSupabase) {
      return mockWebsiteLayouts.find(l => l.website_id === website_id) || null;
    }
    
    try {
      const { data, error } = await DB.query('website_layouts')
        .select('*')
        .eq('website_id', website_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as WebsiteLayout | null;
    } catch (e: any) {
      console.error('[DB: LAYOUTS] Error fetching website layout:', e.message);
      throw new Error(`DB_GET_ERROR: ${e.message}`);
    }
  },

  /**
   * Persists or updates the shared layout configuration.
   * Automatically handles creation if not exists via unique website_id.
   */
  async upsertLayout(website_id: string, layout: Partial<WebsiteLayout>): Promise<WebsiteLayout> {
    if (!website_id) {
        throw new Error('PERSIST_ERROR: Website ID is required for layout.');
    }

    if (!hasSupabase) {
      const idx = mockWebsiteLayouts.findIndex(l => l.website_id === website_id);
      const newLayout = {
        id: idx !== -1 ? mockWebsiteLayouts[idx].id : `ly-${Date.now()}`,
        website_id,
        header_config: layout.header_config || {},
        footer_config: layout.footer_config || {},
        created_at: idx !== -1 ? mockWebsiteLayouts[idx].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as WebsiteLayout;

      if (idx !== -1) {
        mockWebsiteLayouts[idx] = newLayout;
      } else {
        mockWebsiteLayouts.push(newLayout);
      }
      return newLayout;
    }

    const payload = {
      ...layout,
      website_id,
      updated_at: new Date().toISOString()
    };

    try {
      // Use explicit onConflict for website_id
      const { data, error } = await DB.query('website_layouts')
        .upsert(payload, { onConflict: 'website_id' })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as WebsiteLayout;
    } catch (e: any) {
      console.error('[DB: LAYOUTS] Failed to persist website layout:', e.message);
      throw e;
    }
  }
};
