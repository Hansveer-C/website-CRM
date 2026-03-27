import { DB } from './utils/db/db_module';
import { Website } from './types';

/**
 * Websites Repository (Supabase Version).
 * Introduced in Phase W1.1 to manage user-specific website containers.
 */
export const WebsitesRepo = {
  /**
   * Creates a new website for a user with a unique subdomain.
   */
  async createWebsite(user_id: string, name: string): Promise<Website> {
    console.log(`[DB: WEBSITES] Creating website for user ${user_id}: ${name}`);
    
    // Generate a sanitized subdomain from the name (for initial creation)
    const baseSubdomain = name.toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Add a small random suffix to ensure initial uniqueness, or let the user change it later
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const subdomain = `${baseSubdomain || 'site'}-${randomSuffix}`;
    
    const payload: Partial<Website> = {
      user_id,
      name,
      subdomain,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      return await DB.upsert<Website>('websites', payload);
    } catch (e: any) {
      if (e.message?.includes('unique constraint') || e.message?.includes('duplicate key')) {
        // Handle race conditions or duplicate user handles
        if (e.message?.includes('user_id')) {
          throw new Error('USER_WEBSITE_ALREADY_EXISTS: This user already has a website.');
        }
        throw new Error(`WEBSITE_CREATION_FAILED: subdomain "${subdomain}" might already be taken.`);
      }
      throw e;
    }
  },

  /**
   * Looks up a website by its custom domain or unique subdomain.
   */
  async lookupWebsite(host: string): Promise<Website | null> {
    if (!host) return null;

    try {
      // Phase W1.7: Domain-ready architecture. 
      // Prioritize custom domain hits first.
      const { data: domainHit, error: domainError } = await DB.query('websites')
        .select('*')
        .eq('domain', host)
        .maybeSingle();

      if (domainError) throw domainError;

      if (domainHit) {
        console.log(`[DB: WEBSITES] Resolved ${host} via custom domain.`);
        return domainHit as Website;
      }

      // Fallback to subdomain hit
      const { data: subdomainHit, error: subdomainError } = await DB.query('websites')
        .select('*')
        .eq('subdomain', host)
        .maybeSingle();

      if (subdomainError) throw subdomainError;

      if (subdomainHit) {
        console.log(`[DB: WEBSITES] Resolved ${host} via subdomain.`);
      }

      return subdomainHit as Website | null;
    } catch (e: any) {
      console.error('[DB: WEBSITES] Error looking up website by host:', e.message);
      throw new Error(`DB_LOOKUP_ERROR: ${e.message}`);
    }
  },

  /**
   * Retrieves the website container for a specific user.
   */
  async getWebsiteByUser(user_id: string): Promise<Website | null> {
    if (!user_id) return null;
    
    try {
      const { data, error } = await DB.query('websites')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as Website | null;
    } catch (e: any) {
      console.error('[DB: WEBSITES] Error fetching website by user:', e.message);
      throw new Error(`DB_GET_ERROR: ${e.message}`);
    }
  },

  /**
   * Updates an existing website record.
   * Requires the website ID to be present in the update object.
   */
  async updateWebsite(website: Partial<Website> & { id: string }): Promise<Website> {
    if (!website.id) {
        throw new Error('UPDATE_ERROR: Website ID is required for updates.');
    }

    const { id, ...updateData } = website;
    const payload = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await DB.query('websites')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`DB_UPDATE_ERROR: ${error.message}`);
      }

      return data as Website;
    } catch (e: any) {
      console.error('[DB: WEBSITES] Failed to update website:', e.message);
      throw e;
    }
  }
};
