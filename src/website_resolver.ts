import { WebsitesRepo } from './websites_repo_supabase';
import { WebsiteRoutesRepo } from './website_routes_repo_supabase';
import { Website } from './types';

export interface ResolutionResult {
  funnel_id: string | null;
  website: Website | null;
  error?: 'WEBSITE_NOT_FOUND' | 'NO_FUNNEL_MAPPED';
}

/**
 * Resolves an incoming request to a specific funnel based on the host and path.
 * 
 * Flow:
 * 1. Identify website via domain or subdomain
 * 2. Lookup route matching exact path
 * 3. Fallback to "/" route
 * 4. Fallback to website.homepage_funnel_id
 */
export async function resolveWebsiteRequest(
  host: string,
  path: string = '/'
): Promise<ResolutionResult> {
  const siteHost = host.toLowerCase().trim();
  const normalizedPath = (path === '' || path === undefined) ? '/' : (path.startsWith('/') ? path : `/${path}`);

  // 1. Identify Website
  const website = await WebsitesRepo.lookupWebsite(siteHost);
  
  if (!website) {
    return { funnel_id: null, website: null, error: 'WEBSITE_NOT_FOUND' };
  }

  // 2. Lookup exact route
  let route = await WebsiteRoutesRepo.getRouteByPath(website.id, normalizedPath);
  
  // 3. Fallback to root route if path was specific but not found
  if (!route && normalizedPath !== '/') {
    route = await WebsiteRoutesRepo.getRouteByPath(website.id, '/');
  }

  // 4. Final resolve using website homepage setting if no route matched
  const funnel_id = route?.funnel_id || website.homepage_funnel_id || null;

  if (!funnel_id) {
    return { funnel_id: null, website, error: 'NO_FUNNEL_MAPPED' };
  }

  return { funnel_id, website };
}
