import { DB } from './utils/db/db_module';
import { WebsiteRoute } from './types';
import { mockFunnels, mockWebsites, mockWebsiteRoutes } from './db';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

/**
 * Website Routes Repository (Supabase Version).
 * Introduced in Phase W1.2 to map URLs to specific funnels within a website container.
 */
export const WebsiteRoutesRepo = {
  /**
   * Adds a new route to a website or updates an existing one.
   */
  async addRoute(website_id: string, path: string, funnel_id: string, seoData?: { is_seo_page?: boolean; city?: string; service?: string; slug?: string }): Promise<WebsiteRoute> {
    console.log(`[DB: ROUTES] Adding route ${path} for website ${website_id} -> funnel ${funnel_id}${seoData?.is_seo_page ? ' (SEO PAGE)' : ''}`);
    
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (!hasSupabase) {
      const localWebsite = mockWebsites.find(website => website.id === website_id);
      const localFunnel = mockFunnels.find(funnel => funnel.id === funnel_id);
      if (!localWebsite || !localFunnel
        || localWebsite.user_id !== localFunnel.user_id
        || localFunnel.website_id !== website_id) {
        throw new Error('FUNNEL_WEBSITE_OWNERSHIP_MISMATCH');
      }
      console.log('[DB MOCK FALLBACK: ADD_ROUTE] Saving to mockWebsiteRoutes:', { website_id, normalizedPath, funnel_id, seoData });
      const newRoute: WebsiteRoute = {
        id: `r-${Date.now()}`,
        website_id,
        path: normalizedPath,
        funnel_id,
        is_seo_page: seoData?.is_seo_page ?? false,
        city: seoData?.city || '',
        service: seoData?.service || '',
        slug: seoData?.slug || path.replace(/^\//, ''),
        created_at: new Date().toISOString()
      };
      const idx = mockWebsiteRoutes.findIndex(r => r.website_id === website_id && r.path === normalizedPath);
      if (idx !== -1) {
        mockWebsiteRoutes[idx] = newRoute;
      } else {
        mockWebsiteRoutes.push(newRoute);
      }
      return newRoute;
    }

    const payload: Partial<WebsiteRoute> = {
      website_id,
      path: normalizedPath,
      funnel_id,
      is_seo_page: seoData?.is_seo_page ?? false,
      city: seoData?.city || null as any,
      service: seoData?.service || null as any,
      slug: seoData?.slug || null as any,
      created_at: new Date().toISOString()
    };

    try {
      return await DB.upsert<WebsiteRoute>('website_routes', payload);
    } catch (e: any) {
      if (e.message?.includes('unique constraint') || e.message?.includes('duplicate key')) {
        throw new Error(`ROUTE_ALREADY_EXISTS: Path "${normalizedPath}" is already mapped for this website.`);
      }
      throw e;
    }
  },

  /**
   * Retrieves a specific route by path for a website.
   */
  async getRouteByPath(website_id: string, path: string): Promise<WebsiteRoute | null> {
    if (!website_id || !path) return null;
    
    if (!hasSupabase) {
      const route = mockWebsiteRoutes.find(r => r.website_id === website_id && r.path === path);
      return route || null;
    }

    try {
      const { data, error } = await DB.query('website_routes')
        .select('*')
        .eq('website_id', website_id)
        .eq('path', path)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as WebsiteRoute | null;
    } catch (e: any) {
      console.error('[DB: ROUTES] Error fetching route by path:', e.message);
      throw new Error(`DB_GET_ERROR: ${e.message}`);
    }
  },

  /**
   * Retrieves all routes for a specific website.
   */
  async getAllRoutes(website_id: string): Promise<WebsiteRoute[]> {
    if (!website_id) return [];
    
    if (!hasSupabase) {
      return mockWebsiteRoutes.filter(r => r.website_id === website_id);
    }

    try {
      const { data, error } = await DB.query('website_routes')
        .select('*')
        .eq('website_id', website_id)
        .order('path', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []) as WebsiteRoute[];
    } catch (e: any) {
      console.error('[DB: ROUTES] Error listing routes:', e.message);
      throw new Error(`DB_LIST_ERROR: ${e.message}`);
    }
  },

  /**
   * Deletes a specific route by ID.
   */
  async deleteRoute(id: string): Promise<void> {
    if (!id) return;
    
    if (!hasSupabase) {
      const idx = mockWebsiteRoutes.findIndex(r => r.id === id);
      if (idx !== -1) {
        mockWebsiteRoutes.splice(idx, 1);
      }
      return;
    }

    try {
      const { error } = await DB.query('website_routes')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }
    } catch (e: any) {
      console.error('[DB: ROUTES] Error deleting route:', e.message);
      throw new Error(`DB_DELETE_ERROR: ${e.message}`);
    }
  }
};
