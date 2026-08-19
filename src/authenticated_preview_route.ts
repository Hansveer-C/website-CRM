import type { Funnel, Page, Website, WebsiteRoute } from './types';
import type { RouteDraft } from './builder_route_lifecycle';

export interface AuthenticatedPreviewTarget {
  website: Website;
  route: WebsiteRoute;
  funnel: Funnel;
  page: Page;
  path: string;
}

export type AuthenticatedPreviewResolution =
  | { status: 'resolved'; target: AuthenticatedPreviewTarget }
  | { status: 'not-found' | 'selection-required' };

export function normalizeAuthenticatedPreviewPath(path: string): string {
  const clean = path.trim();
  const normalized = !clean || clean === '/' ? '/' : clean.startsWith('/') ? clean : `/${clean}`;
  return normalized === '/home' ? '/' : normalized.replace(/\/+$/, '') || '/';
}

export function buildAuthenticatedPreviewUrl(input: {
  websiteId: string;
  pageId: string;
  path: string;
}): string {
  const normalizedPath = normalizeAuthenticatedPreviewPath(input.path);
  const routePath = normalizedPath === '/' ? 'home' : normalizedPath.replace(/^\//, '');
  const params = new URLSearchParams({ websiteId: input.websiteId, pageId: input.pageId });
  return `/preview/${routePath}?${params.toString()}`;
}

export function resolveAuthenticatedPreview(input: {
  actingUserId: string;
  path: string;
  explicitWebsiteId?: string | null;
  explicitPageId?: string | null;
  websites: readonly Website[];
  routes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
  routeDrafts?: readonly RouteDraft[];
}): AuthenticatedPreviewResolution {
  const ownedWebsites = input.websites.filter(website => website.user_id === input.actingUserId);
  const website = input.explicitWebsiteId
    ? ownedWebsites.find(candidate => candidate.id === input.explicitWebsiteId)
    : ownedWebsites.length === 1 ? ownedWebsites[0] : undefined;
  if (!website) return { status: ownedWebsites.length > 1 ? 'selection-required' : 'not-found' };

  const path = normalizeAuthenticatedPreviewPath(input.path);

  // Compute effective routes for this website
  const drafts = (input.routeDrafts ?? []).filter(d => d.website_id === website.id);

  let targetFunnelId: string | null = null;
  let effectiveRoute: WebsiteRoute | null = null;

  if (path === '/') {
    // Root route governed exclusively by Task 4 homepage lifecycle: draft_homepage_funnel_id ?? liveRootRoute.funnel_id
    const liveRoot = input.routes.find(r => r.website_id === website.id && normalizeAuthenticatedPreviewPath(r.path) === '/');
    if (!liveRoot && !website.draft_homepage_funnel_id) {
      return { status: 'not-found' };
    }
    targetFunnelId = website.draft_homepage_funnel_id ?? liveRoot?.funnel_id ?? null;
    if (!targetFunnelId) return { status: 'not-found' };

    effectiveRoute = liveRoot ?? {
      id: `rt-preview-root-${website.id}`,
      website_id: website.id,
      path: '/',
      funnel_id: targetFunnelId,
      created_at: website.created_at
    };
  } else {
    // Non-root: check draft overrides and new draft routes
    // 1. Check if a draft matches requested path
    const matchingDraft = drafts.find(d => normalizeAuthenticatedPreviewPath(d.path) === path && d.action === 'upsert');

    if (matchingDraft) {
      targetFunnelId = matchingDraft.funnel_id;
      const liveMatch = matchingDraft.route_id
        ? input.routes.find(r => r.id === matchingDraft.route_id)
        : null;

      effectiveRoute = {
        id: liveMatch?.id ?? matchingDraft.id,
        website_id: website.id,
        path: matchingDraft.path,
        funnel_id: matchingDraft.funnel_id,
        slug: liveMatch?.slug,
        is_seo_page: liveMatch?.is_seo_page,
        city: liveMatch?.city,
        service: liveMatch?.service,
        created_at: liveMatch?.created_at ?? matchingDraft.created_at
      };
    } else {
      // 2. Check live routes (ensuring not superseded by a rename draft or delete draft)
      const liveMatch = input.routes.find(r => (
        r.website_id === website.id
        && normalizeAuthenticatedPreviewPath(r.path) === path
      ));

      if (liveMatch) {
        const draftForLive = drafts.find(d => d.route_id === liveMatch.id || d.funnel_id === liveMatch.funnel_id);
        if (draftForLive) {
          // If draft is delete or rename, old live path is superseded in preview -> 404
          return { status: 'not-found' };
        }
        targetFunnelId = liveMatch.funnel_id;
        effectiveRoute = liveMatch;
      }
    }
  }

  if (!targetFunnelId || !effectiveRoute) return { status: 'not-found' };

  const funnel = input.funnels.find(candidate => (
    candidate.id === targetFunnelId
    && candidate.user_id === input.actingUserId
  ));
  if (!funnel) return { status: 'not-found' };

  const ownedPages = input.pages.filter(candidate => (
    candidate.user_id === input.actingUserId
    && candidate.funnel_id === funnel.id
  ));
  const page = input.explicitPageId
    ? ownedPages.find(candidate => candidate.id === input.explicitPageId)
    : path === '/'
      ? ownedPages.find(candidate => candidate.slug.trim().toLowerCase() === 'home')
        ?? ownedPages.find(candidate => candidate.name.trim().toLowerCase() === 'home')
        ?? ownedPages[0]
      : ownedPages.find(candidate => candidate.slug === (effectiveRoute.slug || path.replace(/^\//, '')))
        ?? ownedPages[0];
  if (!page) return { status: 'not-found' };

  return { status: 'resolved', target: { website, route: effectiveRoute, funnel, page, path } };
}
