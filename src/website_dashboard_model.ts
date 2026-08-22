import type { Funnel, Page, Website, WebsiteRoute } from './types';
import { isOwnedWebsiteFunnel } from './website_funnel_ownership';

export type ActiveWebsiteResolution =
  | { status: 'resolved'; website: Website; ownedWebsites: readonly Website[] }
  | { status: 'selection-required'; ownedWebsites: readonly Website[] }
  | { status: 'empty'; ownedWebsites: readonly Website[] }
  | { status: 'unavailable'; reason: 'explicit-website-unavailable'; ownedWebsites: readonly Website[] };

export type WebsiteHomepageResolution =
  | { status: 'resolved'; page: Page; funnel: Funnel; route: WebsiteRoute | undefined }
  | { status: 'missing-homepage-funnel' | 'missing-funnel' | 'no-homepage-page' | 'ownership-mismatch' | 'invalid-relationship' };

export type BuilderPublicationDisplayState =
  | 'loading'
  | 'never-published'
  | 'published'
  | 'unpublished-changes'
  | 'unavailable';

export interface WebsiteDashboardSummaryInput {
  publicationState?: BuilderPublicationDisplayState;
  lastPublishedAt?: string;
  pagesWithTargets?: number;
  mediaAssetCount?: number;
  settingsAvailable?: boolean;
  setupBriefVersion?: number;
}

export interface WebsiteDashboardModel {
  website: { id: string; name: string; publicHost: string | null };
  homepage: {
    state: WebsiteHomepageResolution['status'];
    id: string | null;
    name: string | null;
    path: string | null;
    legacyPageStatus: Page['status'] | null;
    publicationState: BuilderPublicationDisplayState;
    lastPublishedAt: string | null;
  };
  currentPage: { id: string; name: string } | null;
  counts: {
    pages: number;
    draftPages: number;
    pagesWithTargets: number | null;
    mediaAssets: number | null;
  };
  readiness: {
    homepage: boolean;
    publicHost: boolean;
    settings: boolean | null;
    setupBriefVersion: number | null;
  };
  publicUrl: string | null;
  actions: Record<'edit' | 'pages' | 'settings' | 'assets' | 'guidedSetup' | 'preview' | 'publish' | 'viewLive', { enabled: boolean; reason?: string }>;
}

const clean = (value: string | null | undefined): string | null => {
  const result = value?.trim();
  return result ? result : null;
};

export function resolveActiveWebsite(input: {
  actingUserId: string;
  websites: readonly Website[];
  explicitWebsiteId?: string | null;
  previousWebsiteId?: string | null;
}): ActiveWebsiteResolution {
  const ownedWebsites = input.websites.filter(website => website.user_id === input.actingUserId);
  if (input.explicitWebsiteId) {
    const website = ownedWebsites.find(item => item.id === input.explicitWebsiteId);
    return website
      ? { status: 'resolved', website, ownedWebsites }
      : { status: 'unavailable', reason: 'explicit-website-unavailable', ownedWebsites };
  }
  if (ownedWebsites.length === 0) return { status: 'empty', ownedWebsites };
  if (ownedWebsites.length === 1) return { status: 'resolved', website: ownedWebsites[0], ownedWebsites };
  const previous = input.previousWebsiteId
    ? ownedWebsites.find(item => item.id === input.previousWebsiteId)
    : undefined;
  return previous
    ? { status: 'resolved', website: previous, ownedWebsites }
    : { status: 'selection-required', ownedWebsites };
}

function compareHomepageCandidates(left: Page, right: Page): number {
  const leftOrder = Number.isFinite(left.step_order) ? left.step_order! : Number.POSITIVE_INFINITY;
  const rightOrder = Number.isFinite(right.step_order) ? right.step_order! : Number.POSITIVE_INFINITY;
  return leftOrder - rightOrder || left.id.localeCompare(right.id);
}

export function resolveWebsiteHomepage(input: {
  actingUserId: string;
  website: Website;
  routes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
}): WebsiteHomepageResolution {
  if (input.website.user_id !== input.actingUserId) return { status: 'ownership-mismatch' };
  const funnelId = clean(input.website.draft_homepage_funnel_id ?? input.website.homepage_funnel_id);
  if (!funnelId) return { status: 'missing-homepage-funnel' };
  const funnel = input.funnels.find(item => item.id === funnelId);
  if (!funnel) return { status: 'missing-funnel' };
  if (!isOwnedWebsiteFunnel(funnel, input.website, input.actingUserId)) return { status: 'ownership-mismatch' };
  const candidates = input.pages.filter(page => page.user_id === input.actingUserId && page.funnel_id === funnelId);
  if (candidates.length === 0) return { status: 'no-homepage-page' };
  const sorted = [...candidates].sort(compareHomepageCandidates);
  const page = sorted.find(item => item.slug.trim().toLowerCase() === 'home')
    ?? sorted.find(item => item.name.trim().toLowerCase() === 'home')
    ?? sorted[0];
  const route = input.routes.find(item => item.website_id === input.website.id && item.funnel_id === funnelId && item.path === '/')
    ?? input.routes.find(item => item.website_id === input.website.id && item.funnel_id === funnelId);
  return { status: 'resolved', page, funnel, route };
}

export function getWebsiteScopedPages(input: {
  actingUserId: string;
  website: Website;
  routes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
}): readonly Page[] {
  if (input.website.user_id !== input.actingUserId) return [];
  const owned = new Set(input.funnels
    .filter(funnel => isOwnedWebsiteFunnel(funnel, input.website, input.actingUserId))
    .map(funnel => funnel.id));
  return input.pages.filter(page => page.user_id === input.actingUserId && !!page.funnel_id && owned.has(page.funnel_id));
}

export function resolveDashboardCurrentPage(input: {
  actingUserId: string;
  explicitPageId?: string | null;
  scopedPages: readonly Page[];
  homepage: WebsiteHomepageResolution;
}): Page | null {
  if (input.explicitPageId) {
    return input.scopedPages.find(page => page.id === input.explicitPageId && page.user_id === input.actingUserId) ?? null;
  }
  return input.homepage.status === 'resolved' ? input.homepage.page : null;
}

export function deriveWebsitePublicHost(website: Website): string | null {
  const candidate = clean(website.domain) ?? (clean(website.subdomain) ? `${website.subdomain.trim()}.pressurepro.io` : null);
  if (!candidate || candidate.includes('/') || candidate.includes('?') || candidate.includes('#') || /\s/.test(candidate)) return null;
  try {
    const url = new URL(`https://${candidate}`);
    return url.hostname === candidate.toLowerCase() ? url.hostname : null;
  } catch {
    return null;
  }
}

export function createWebsiteDashboardModel(input: {
  actingUserId: string;
  website: Website;
  routes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
  explicitPageId?: string | null;
  summary?: WebsiteDashboardSummaryInput;
}): WebsiteDashboardModel {
  const homepage = resolveWebsiteHomepage(input);
  const scopedPages = getWebsiteScopedPages(input);
  const currentPage = resolveDashboardCurrentPage({ ...input, scopedPages, homepage });
  const publicHost = deriveWebsitePublicHost(input.website);
  const publicationState = input.summary?.publicationState ?? 'loading';
  const live = homepage.status === 'resolved'
    && !!publicHost
    && (publicationState === 'published' || publicationState === 'unpublished-changes');
  const requiresPageReason = currentPage ? undefined : 'A valid website page is required.';
  const homepageReason = homepage.status === 'resolved' ? undefined : 'No editable homepage was found for this website.';
  const pageAction = { enabled: !!currentPage, ...(requiresPageReason ? { reason: requiresPageReason } : {}) };
  return {
    website: { id: input.website.id, name: input.website.name, publicHost },
    homepage: {
      state: homepage.status,
      id: homepage.status === 'resolved' ? homepage.page.id : null,
      name: homepage.status === 'resolved' ? homepage.page.name : null,
      path: homepage.status === 'resolved' ? (homepage.route?.path ?? '/') : null,
      legacyPageStatus: homepage.status === 'resolved' ? homepage.page.status : null,
      publicationState,
      lastPublishedAt: input.summary?.lastPublishedAt ?? null
    },
    currentPage: currentPage ? { id: currentPage.id, name: currentPage.name } : null,
    counts: {
      pages: scopedPages.length,
      draftPages: scopedPages.filter(page => page.status === 'draft').length,
      pagesWithTargets: input.summary?.pagesWithTargets ?? null,
      mediaAssets: input.summary?.mediaAssetCount ?? null
    },
    readiness: {
      homepage: homepage.status === 'resolved',
      publicHost: !!publicHost,
      settings: input.summary?.settingsAvailable ?? null,
      setupBriefVersion: input.summary?.setupBriefVersion ?? null
    },
    publicUrl: live ? `https://${publicHost}${homepage.status === 'resolved' ? homepage.route?.path ?? '/' : '/'}` : null,
    actions: {
      edit: { enabled: homepage.status === 'resolved', ...(homepageReason ? { reason: homepageReason } : {}) },
      pages: pageAction,
      settings: pageAction,
      assets: pageAction,
      guidedSetup: pageAction,
      preview: pageAction,
      publish: pageAction,
      viewLive: { enabled: live, ...(!live ? { reason: publicationState === 'unavailable' ? 'Publication status is temporarily unavailable.' : 'A live published website is not available yet.' } : {}) }
    }
  };
}
