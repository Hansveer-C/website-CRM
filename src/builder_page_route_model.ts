import type { Page, Website } from './types';
import {
  normalizeRoutePath,
  type EffectiveRoute,
  type RouteDraftAction,
  type RouteOperationResultCode
} from './builder_route_lifecycle';

export type PageRouteStatus =
  | 'live'
  | 'draft-create'
  | 'draft-rename'
  | 'draft-delete'
  | 'unrouted';

export interface PageRouteViewModel {
  pageId: string;
  funnelId: string;
  websiteId: string;
  isHomepage: boolean;
  isLiveHomepage: boolean;
  isDraftHomepage: boolean;
  isRoot: boolean;
  isEditable: boolean;

  currentLivePath: string | null;
  effectivePath: string;
  displayPath: string;

  liveRouteId: string | null;
  draftRouteId: string | null;
  draftAction: RouteDraftAction | null;

  routeStatus: PageRouteStatus;
  statusLabel: string;
  hasUnpublishedChanges: boolean;

  previewPath: string;
  livePublicPath: string | null;
}

export interface CreatePageRouteViewModelInput {
  page: Page;
  website: Website;
  effectiveRoutes: readonly EffectiveRoute[];
  isHomepage?: boolean;
  isLiveHomepage?: boolean;
  isDraftHomepage?: boolean;
}

export function mapRouteErrorCodeToMessage(
  code?: RouteOperationResultCode | null,
  rawError?: string
): string {
  switch (code) {
    case 'COLLISION':
      return 'That URL is already being used by another page.';
    case 'RESERVED_PATH':
      return 'That URL is reserved by WashOps. Choose another URL.';
    case 'ROOT_ROUTE_RESERVED':
      return 'The homepage URL is managed by its root route and cannot be changed here.';
    case 'CONFLICT':
      return 'This URL was changed elsewhere. Reload the latest website state before continuing.';
    case 'UNPUBLISHED_DESTINATION':
      return 'Publish this page before making its URL live.';
    case 'NOT_FOUND':
      return 'The requested website, page, or route was not found.';
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return 'You do not have permission to modify this route.';
    case 'INVALID_PATH':
    case 'INVALID_INPUT':
      return rawError || 'Please enter a valid page URL.';
    case 'INVALID_REDIRECT':
      return 'This URL change would create an invalid redirect loop.';
    default:
      return rawError || 'An unexpected error occurred while updating the URL.';
  }
}

export function createPageRouteViewModel(
  input: CreatePageRouteViewModelInput
): PageRouteViewModel {
  const { page, website, effectiveRoutes } = input;
  const isHomepage = input.isHomepage ?? false;
  const isLiveHomepage = input.isLiveHomepage ?? false;
  const isDraftHomepage = input.isDraftHomepage ?? false;
  const isRoot = isHomepage;

  if (isRoot) {
    return {
      pageId: page.id,
      funnelId: page.funnel_id ?? '',
      websiteId: website.id,
      isHomepage: true,
      isLiveHomepage,
      isDraftHomepage,
      isRoot: true,
      isEditable: false,
      currentLivePath: '/',
      effectivePath: '/',
      displayPath: '/',
      liveRouteId: null,
      draftRouteId: null,
      draftAction: null,
      routeStatus: 'live',
      statusLabel: isDraftHomepage ? 'Home (Unpublished)' : 'Home (Live)',
      hasUnpublishedChanges: false,
      previewPath: '/',
      livePublicPath: '/'
    };
  }

  // Find effective route matching the page's funnel
  const matchingRoute = effectiveRoutes.find(r => r.funnel_id === page.funnel_id && r.website_id === website.id);

  if (!matchingRoute) {
    const fallbackPath = page.slug ? `/${page.slug.replace(/^\/+/, '')}` : '/';
    return {
      pageId: page.id,
      funnelId: page.funnel_id ?? '',
      websiteId: website.id,
      isHomepage: false,
      isLiveHomepage: false,
      isDraftHomepage: false,
      isRoot: false,
      isEditable: true,
      currentLivePath: null,
      effectivePath: fallbackPath,
      displayPath: fallbackPath,
      liveRouteId: null,
      draftRouteId: null,
      draftAction: null,
      routeStatus: 'unrouted',
      statusLabel: 'No public URL',
      hasUnpublishedChanges: false,
      previewPath: fallbackPath,
      livePublicPath: null
    };
  }

  const livePath = matchingRoute.live_path;
  const effectivePath = matchingRoute.path;
  const isStagedDelete = matchingRoute.is_staged_delete;
  const isNewDraft = matchingRoute.is_new_draft;
  const isDraftOverride = matchingRoute.is_draft_override;

  let routeStatus: PageRouteStatus;
  let statusLabel: string;
  let hasUnpublishedChanges = false;

  if (isStagedDelete) {
    routeStatus = 'draft-delete';
    statusLabel = 'URL removal pending';
    hasUnpublishedChanges = true;
  } else if (isNewDraft) {
    routeStatus = 'draft-create';
    statusLabel = 'Unpublished URL';
    hasUnpublishedChanges = true;
  } else if (isDraftOverride && livePath && livePath !== effectivePath) {
    routeStatus = 'draft-rename';
    statusLabel = 'Unpublished URL';
    hasUnpublishedChanges = true;
  } else {
    routeStatus = 'live';
    statusLabel = 'Live';
    hasUnpublishedChanges = false;
  }

  return {
    pageId: page.id,
    funnelId: page.funnel_id ?? '',
    websiteId: website.id,
    isHomepage: false,
    isLiveHomepage: false,
    isDraftHomepage: false,
    isRoot: false,
    isEditable: true,
    currentLivePath: livePath,
    effectivePath,
    displayPath: effectivePath,
    liveRouteId: matchingRoute.id || null,
    draftRouteId: matchingRoute.draft_path ? matchingRoute.id : null,
    draftAction: isStagedDelete ? 'delete' : (isNewDraft || isDraftOverride) ? 'upsert' : null,
    routeStatus,
    statusLabel,
    hasUnpublishedChanges,
    previewPath: effectivePath,
    livePublicPath: livePath
  };
}

export function validatePageRouteInput(
  rawInput: string,
  existingEffectivePaths: readonly string[] = [],
  currentRoutePath?: string | null
): { valid: boolean; normalizedPath: string; error?: string } {
  const norm = normalizeRoutePath(rawInput);
  if (!norm.valid) {
    return {
      valid: false,
      normalizedPath: norm.normalizedPath,
      error: mapRouteErrorCodeToMessage(norm.errorCode, norm.error)
    };
  }

  const cleanCurrent = currentRoutePath ? currentRoutePath.trim().toLowerCase() : null;
  const cleanTarget = norm.normalizedPath;

  // Collision against existing effective routes
  if (
    cleanTarget !== cleanCurrent &&
    existingEffectivePaths.some(p => p.trim().toLowerCase() === cleanTarget)
  ) {
    return {
      valid: false,
      normalizedPath: cleanTarget,
      error: 'That URL is already being used by another page.'
    };
  }

  return {
    valid: true,
    normalizedPath: cleanTarget
  };
}
