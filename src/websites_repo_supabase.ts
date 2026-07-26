import { DB } from './utils/db/db_module';
import { Website } from './types';
import { mockWebsites } from './db';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

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

    if (!hasSupabase) {
      const offlineSite: Website = {
        id: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id,
        name,
        subdomain,
        domain: '',
        homepage_funnel_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockWebsites.push(offlineSite);
      return offlineSite;
    }
    
    try {
      return await DB.upsert<Website>('websites', payload);
    } catch (e: any) {
      if (e.message?.includes('unique constraint') || e.message?.includes('duplicate key')) {
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

    const siteHost = host.toLowerCase().trim();
    const subdomainCandidate = siteHost.endsWith('.pressurepro.io') 
      ? siteHost.replace('.pressurepro.io', '') 
      : siteHost;

    if (!hasSupabase) {
      return mockWebsites.find(w => w.domain === siteHost || w.subdomain === subdomainCandidate) || null;
    }

    try {
      const { data: domainHit, error: domainError } = await DB.query('websites')
        .select('*')
        .eq('domain', siteHost)
        .maybeSingle();

      if (domainError) throw domainError;

      if (domainHit) {
        console.log(`[DB: WEBSITES] Resolved ${siteHost} via custom domain.`);
        return domainHit as Website;
      }

      // Fallback to subdomain hit
      const { data: subdomainHit, error: subdomainError } = await DB.query('websites')
        .select('*')
        .eq('subdomain', subdomainCandidate)
        .maybeSingle();

      if (subdomainError) throw subdomainError;

      if (subdomainHit) {
        console.log(`[DB: WEBSITES] Resolved ${siteHost} via subdomain.`);
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

    if (!hasSupabase) {
      return mockWebsites.find(w => w.user_id === user_id) || null;
    }
    
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

    if (!hasSupabase) {
      const idx = mockWebsites.findIndex(w => w.id === website.id);
      if (idx !== -1) {
        mockWebsites[idx] = {
          ...mockWebsites[idx],
          ...website,
          updated_at: new Date().toISOString()
        };
        return mockWebsites[idx];
      }
      throw new Error(`WEBSITE_NOT_FOUND: ${website.id}`);
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
  },

  /**
   * Checks if a subdomain is available (not claimed by another tenant).
   */
  async checkSubdomainAvailable(subdomain: string, currentWebsiteId?: string): Promise<boolean> {
    if (!subdomain) return false;
    const normalized = subdomain.trim().toLowerCase();

    if (!hasSupabase) {
      const conflict = mockWebsites.find(w => w.subdomain === normalized && w.id !== currentWebsiteId);
      return !conflict;
    }

    try {
      const { data, error } = await DB.query('websites')
        .select('id')
        .eq('subdomain', normalized);

      if (error) throw error;
      
      const records = data as { id: string }[];
      const conflict = records.find(r => r.id !== currentWebsiteId);
      return !conflict;
    } catch (e: any) {
      console.error('[DB: WEBSITES] Collision check failed:', e.message);
      return false;
    }
  },

  /**
   * Updates only the website's subdomain after validation and uniqueness checks.
   */
  async updateWebsiteSubdomain(userId: string, websiteId: string, subdomain: string): Promise<Website> {
    const { validateSubdomain } = await import('./utils/subdomain_utils');
    const valResult = validateSubdomain(subdomain);
    if (!valResult.valid) {
      throw new Error(`VALIDATION_ERROR: ${valResult.error}`);
    }

    const isAvailable = await this.checkSubdomainAvailable(valResult.normalized, websiteId);
    if (!isAvailable) {
      throw new Error('SUBDOMAIN_ALREADY_TAKEN: This subdomain is already claimed by another user.');
    }

    // Tenant boundary verification: ensure user owns the website
    const existing = await this.getWebsiteByUser(userId);
    if (!existing || existing.id !== websiteId) {
      throw new Error('UNAUTHORIZED_ACCESS: You do not own this website.');
    }

    return await this.updateWebsite({
      id: websiteId,
      subdomain: valResult.normalized
    });
  },

  /**
   * Checks if a custom domain is available (not claimed by another tenant).
   * Passing an empty string always returns true (clearing a domain is always allowed).
   */
  async checkDomainAvailable(domain: string, currentWebsiteId?: string): Promise<boolean> {
    if (!domain) return true; // Clearing a domain is always allowed
    const normalized = domain.trim().toLowerCase();

    if (!hasSupabase) {
      const conflict = mockWebsites.find(
        w => w.domain === normalized && w.id !== currentWebsiteId
      );
      return !conflict;
    }

    try {
      const { data, error } = await DB.query('websites')
        .select('id')
        .eq('domain', normalized);

      if (error) throw error;

      const records = data as { id: string }[];
      const conflict = records.find(r => r.id !== currentWebsiteId);
      return !conflict;
    } catch (e: any) {
      console.error('[DB: WEBSITES] Domain collision check failed:', e.message);
      return false;
    }
  },

  /**
   * Updates only the website's custom domain after validation and uniqueness checks.
   * Passing an empty string clears the custom domain (falls back to subdomain URL).
   */
  async updateWebsiteDomain(userId: string, websiteId: string, domain: string): Promise<Website> {
    // Allow clearing the domain
    if (!domain || domain.trim() === '') {
      // Tenant boundary verification
      const existing = await this.getWebsiteByUser(userId);
      if (!existing || existing.id !== websiteId) {
        throw new Error('UNAUTHORIZED_ACCESS: You do not own this website.');
      }
      return await this.updateWebsite({ id: websiteId, domain: null });
    }

    const { validateDomain } = await import('./utils/domain_utils');
    const valResult = validateDomain(domain);
    if (!valResult.valid) {
      throw new Error(`VALIDATION_ERROR: ${valResult.error}`);
    }

    const isAvailable = await this.checkDomainAvailable(valResult.normalized, websiteId);
    if (!isAvailable) {
      throw new Error('DOMAIN_ALREADY_TAKEN: This custom domain is already in use by another website.');
    }

    // Tenant boundary verification: ensure user owns the website
    const existing = await this.getWebsiteByUser(userId);
    if (!existing || existing.id !== websiteId) {
      throw new Error('UNAUTHORIZED_ACCESS: You do not own this website.');
    }

    return await this.updateWebsite({
      id: websiteId,
      domain: valResult.normalized
    });
  }
};
