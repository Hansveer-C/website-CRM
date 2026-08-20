import type { Funnel, Page, Website, WebsiteRoute } from './types';
import type { RouteDraft, EffectiveRoute } from './builder_route_lifecycle';
import {
  SiteNavigationItem,
  ResolvedNavigationItem,
  resolveNavigationItem
} from './builder_site_navigation_domain';

export interface PreviewNavigationSnapshot {
  website_id: string;
  menu_scope: 'primary' | 'footer';
  items: SiteNavigationItem[];
  revision?: number;
  base_revision?: number;
  draft_revision?: number;
}

export type PreviewNavigationSourceAuthority = 'canonical-draft' | 'canonical-live' | 'legacy';

export interface AuthenticatedPreviewTarget {
  website: Website;
  route: WebsiteRoute;
  funnel: Funnel;
  page: Page;
  path: string;
  effectiveNavigation?: {
    primary: readonly ResolvedNavigationItem[];
    footer: readonly ResolvedNavigationItem[];
    primarySource: PreviewNavigationSourceAuthority;
    footerSource: PreviewNavigationSourceAuthority;
    source?: PreviewNavigationSourceAuthority;
  };
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
  canonicalNavDrafts?: readonly PreviewNavigationSnapshot[];
  canonicalNavLive?: readonly PreviewNavigationSnapshot[];
  legacyLayout?: {
    headerConfig?: { nav_items?: unknown[]; navigation?: unknown[] };
    footerConfig?: { links?: unknown[] };
  } | null;
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

  // Compute effective routes for this website
  const effectiveRoutes: EffectiveRoute[] = [];
  for (const r of input.routes.filter(r => r.website_id === website.id)) {
    const draftForRoute = drafts.find(d => d.route_id === r.id);
    if (!draftForRoute) {
      effectiveRoutes.push({
        id: r.id,
        website_id: website.id,
        path: r.path,
        funnel_id: r.funnel_id,
        live_path: r.path,
        draft_path: null,
        is_draft_override: false,
        is_staged_delete: false,
        is_new_draft: false
      });
    } else if (draftForRoute.action === 'delete') {
      effectiveRoutes.push({
        id: r.id,
        website_id: website.id,
        path: r.path,
        funnel_id: r.funnel_id,
        live_path: r.path,
        draft_path: null,
        draft_id: draftForRoute.id,
        is_draft_override: false,
        is_staged_delete: true,
        is_new_draft: false
      });
    } else if (draftForRoute.action === 'upsert') {
      effectiveRoutes.push({
        id: r.id,
        website_id: website.id,
        path: draftForRoute.path,
        funnel_id: draftForRoute.funnel_id,
        live_path: r.path,
        draft_path: draftForRoute.path,
        draft_id: draftForRoute.id,
        is_draft_override: true,
        is_staged_delete: false,
        is_new_draft: false
      });
    }
  }
  for (const d of drafts.filter(d => !d.route_id && d.action === 'upsert')) {
    effectiveRoutes.push({
      id: d.id,
      website_id: website.id,
      path: d.path,
      funnel_id: d.funnel_id,
      live_path: null,
      draft_path: d.path,
      draft_id: d.id,
      is_draft_override: true,
      is_staged_delete: false,
      is_new_draft: true
    });
  }

  // Determine effective navigation
  const primaryDraft = input.canonicalNavDrafts?.find(d => d.website_id === website.id && d.menu_scope === 'primary');
  const primaryLive = input.canonicalNavLive?.find(l => l.website_id === website.id && l.menu_scope === 'primary');
  const footerDraft = input.canonicalNavDrafts?.find(d => d.website_id === website.id && d.menu_scope === 'footer');
  const footerLive = input.canonicalNavLive?.find(l => l.website_id === website.id && l.menu_scope === 'footer');

  let primarySource: PreviewNavigationSourceAuthority = 'legacy';
  let footerSource: PreviewNavigationSourceAuthority = 'legacy';
  let primaryItems: SiteNavigationItem[] = [];
  let footerItems: SiteNavigationItem[] = [];

  if (primaryDraft) {
    primarySource = 'canonical-draft';
    primaryItems = primaryDraft.items;
  } else if (primaryLive) {
    primarySource = 'canonical-live';
    primaryItems = primaryLive.items;
  } else if (input.legacyLayout?.headerConfig) {
    const legacyRaw = (input.legacyLayout.headerConfig.nav_items ?? input.legacyLayout.headerConfig.navigation ?? []) as Array<Record<string, unknown>>;
    primaryItems = legacyRaw.map((item, idx) => ({
      id: `00000000-0000-4000-8000-${String(idx).padStart(12, '0')}`,
      label: String(item.label || ''),
      target_kind: (String(item.path || '') === '/' ? 'homepage' : 'external') as any,
      target_value: String(item.path || '/'),
      position: idx,
      visible: typeof item.visible === 'boolean' ? item.visible : true,
      is_cta: Boolean(item.is_cta || item.isCta)
    }));
  }

  if (footerDraft) {
    footerSource = 'canonical-draft';
    footerItems = footerDraft.items;
  } else if (footerLive) {
    footerSource = 'canonical-live';
    footerItems = footerLive.items;
  } else if (input.legacyLayout?.footerConfig?.links) {
    const legacyLinks = input.legacyLayout.footerConfig.links as Array<Record<string, unknown>>;
    footerItems = legacyLinks.map((item, idx) => ({
      id: `00000000-0000-4000-9000-${String(idx).padStart(12, '0')}`,
      label: String(item.label || ''),
      target_kind: (String(item.path || '') === '/' ? 'homepage' : 'external') as any,
      target_value: String(item.path || '/'),
      position: idx,
      visible: true,
      is_cta: Boolean(item.is_cta || item.isCta)
    }));
  }

  const effectivePrimary = primaryItems.map(item => resolveNavigationItem(item, {
    effectiveRoutes,
    homepageFunnelId: website.draft_homepage_funnel_id ?? website.homepage_funnel_id
  }));

  const effectiveFooter = footerItems.map(item => resolveNavigationItem(item, {
    effectiveRoutes,
    homepageFunnelId: website.draft_homepage_funnel_id ?? website.homepage_funnel_id
  }));

  return {
    status: 'resolved',
    target: {
      website,
      route: effectiveRoute,
      funnel,
      page,
      path,
      effectiveNavigation: {
        primary: effectivePrimary,
        footer: effectiveFooter,
        primarySource,
        footerSource,
        source: primarySource
      }
    }
  };
}
