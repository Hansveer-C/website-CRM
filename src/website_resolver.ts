import { Website, WebsiteRoute } from './types';
import { mockWebsites, mockWebsiteRoutes } from './db';

export interface ResolutionResult {
  funnel_id: string | null;
  website: Website | null;
  route?: WebsiteRoute | null;
  error?: 'WEBSITE_NOT_FOUND' | 'NO_FUNNEL_MAPPED';
}

/**
 * Resolves an incoming request to a specific funnel based on the host and path.
 * 
 * 🏗️ FRONTEND-SAFE RESOLVER (Phase S3 / W1.x)
 * Uses mock data arrays from db.ts as the 'local database' during prototype phase.
 */
export async function resolveWebsiteRequest(
  host: string,
  path: string = '/'
): Promise<ResolutionResult> {
  const siteHost = host.toLowerCase().trim();
  const normalizedPath = (!path || path === '') ? '/' : (path.startsWith('/') ? path : `/${path}`);

  console.log(`[RESOLVER] Attempting to resolve ${siteHost}${normalizedPath}`);

  // 1. Identify Website (via domain or subdomain)
  // Check custom domain first, then fallback to subdomain
  let website = mockWebsites.find(w => w.domain === siteHost) || 
                mockWebsites.find(w => w.subdomain === siteHost);
  
  // Debug Fallback: if localhost or unknown, use the first mock website for testing
  if (!website && (siteHost === 'localhost' || siteHost === '127.0.0.1')) {
    console.warn(`[RESOLVER] Localhost host detected, using fallback website: ${mockWebsites[0]?.id}`);
    website = mockWebsites[0];
  }

  if (!website) {
    console.error(`[RESOLVER] WEBSITE_NOT_FOUND for host: ${siteHost}`);
    return { funnel_id: null, website: null, error: 'WEBSITE_NOT_FOUND' };
  }

  // 2. Lookup exact route
  // A route belongs to a website_id and has a specific path
  let route = mockWebsiteRoutes.find(r => r.website_id === website!.id && r.path === normalizedPath);
  
  // 3. Fallback to root route if path was specific but not found
  if (!route && normalizedPath !== '/') {
    console.warn(`[RESOLVER] No exact route for ${normalizedPath}, falling back to '/'`);
    route = mockWebsiteRoutes.find(r => r.website_id === website!.id && r.path === '/');
  }

  // 4. Final resolve using route or website homepage default
  const funnel_id = route?.funnel_id || website.homepage_funnel_id || null;

  if (!funnel_id) {
    console.error(`[RESOLVER] NO_FUNNEL_MAPPED for website: ${website.id} at path: ${normalizedPath}`);
    return { funnel_id: null, website, error: 'NO_FUNNEL_MAPPED' };
  }

  console.log(`[RESOLVER] RESOLVED to funnel_id: ${funnel_id}`);
  return { funnel_id, website, route };
}
