import type { Funnel, Page, Website, WebsiteRoute } from './types';

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
}): AuthenticatedPreviewResolution {
  const ownedWebsites = input.websites.filter(website => website.user_id === input.actingUserId);
  const website = input.explicitWebsiteId
    ? ownedWebsites.find(candidate => candidate.id === input.explicitWebsiteId)
    : ownedWebsites.length === 1 ? ownedWebsites[0] : undefined;
  if (!website) return { status: ownedWebsites.length > 1 ? 'selection-required' : 'not-found' };

  const path = normalizeAuthenticatedPreviewPath(input.path);
  const route = input.routes.find(candidate => (
    candidate.website_id === website.id
    && normalizeAuthenticatedPreviewPath(candidate.path) === path
  ));
  if (!route) return { status: 'not-found' };

  const targetFunnelId = (path === '/' && website.draft_homepage_funnel_id)
    ? website.draft_homepage_funnel_id
    : route.funnel_id;

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
      : ownedPages.find(candidate => candidate.slug === (route.slug || path.replace(/^\//, '')))
        ?? ownedPages[0];
  if (!page) return { status: 'not-found' };

  return { status: 'resolved', target: { website, route, funnel, page, path } };
}
