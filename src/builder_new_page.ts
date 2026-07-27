import type { Funnel, Page, Website, WebsiteRoute } from './types';
import {
  BUILDER_PAGE_NAME_MAX_LENGTH,
  BUILDER_PAGE_SLUG_MAX_LENGTH,
  normalizeBuilderPageSlug,
  validateBuilderPageSettings
} from './builder_page_settings';

export interface BuilderNewPageRoutePath {
  routeId: string;
  path: string;
}

export interface BuilderNewPageDestination {
  key: string;
  funnelId: string;
  routeId?: string;
  routePath: string;
  routePaths: readonly BuilderNewPageRoutePath[];
  isHomepage: boolean;
  label: string;
}

export interface BuilderNewPageDestinationInput {
  website: Website | null | undefined;
  websiteRoutes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
  actingUserId: string | null | undefined;
}

export interface BuilderNewPageInput {
  name: string;
  slug: string;
  destinationKey: string;
}

export type BuilderNewPageValidationField = 'name' | 'slug' | 'destination';

export interface BuilderNewPageValidationIssue {
  field: BuilderNewPageValidationField;
  code:
    | 'required'
    | 'control-character'
    | 'too-long'
    | 'invalid-slug'
    | 'reserved-slug'
    | 'duplicate-slug'
    | 'invalid-destination'
    | 'unroutable-slug';
  message: string;
}

export interface BuilderNewPageValidationContext {
  destinations: readonly BuilderNewPageDestination[];
  existingPages: readonly Page[];
}

export interface BuilderNewPageCreateDefaultsOptions {
  input: BuilderNewPageInput;
  destination: BuilderNewPageDestination;
  actingUserId: string;
  existingPages: readonly Page[];
  id: string;
  now?: () => string;
}

export const BUILDER_NEW_PAGE_RESERVED_SLUGS = Object.freeze([
  'api',
  'builder',
  'functions',
  'login',
  'preview',
  'website-dashboard'
] as const);

function normalizeRoutePath(value: string): string | null {
  const raw = value.trim();
  if (!raw || !raw.startsWith('/') || raw.includes('://') || raw.includes('?') || raw.includes('#') || raw.includes('\\')) {
    return null;
  }
  const segments = raw.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..' || /[\u0000-\u001f\u007f]/.test(segment))) {
    return null;
  }
  return segments.length ? `/${segments.join('/')}`.replace(/\/+$/, '') : '/';
}

function routeOrder(left: BuilderNewPageRoutePath, right: BuilderNewPageRoutePath): number {
  return left.path.localeCompare(right.path) || left.routeId.localeCompare(right.routeId);
}

export function getEligibleNewPageDestinations(
  input: BuilderNewPageDestinationInput
): readonly BuilderNewPageDestination[] {
  const userId = input.actingUserId?.trim() ?? '';
  const website = input.website;
  if (!userId || !website || website.user_id !== userId) return [];

  const ownedFunnels = new Map(input.funnels
    .filter(funnel => funnel.user_id === userId)
    .map(funnel => [funnel.id, funnel]));
  const routes = input.websiteRoutes
    .filter(route => route.website_id === website.id && !!route.funnel_id && ownedFunnels.has(route.funnel_id))
    .flatMap(route => {
      const path = normalizeRoutePath(route.path);
      return path ? [{ route, path }] : [];
    });
  const associatedFunnelIds = new Set(routes.map(item => item.route.funnel_id));
  if (website.homepage_funnel_id && ownedFunnels.has(website.homepage_funnel_id)) {
    associatedFunnelIds.add(website.homepage_funnel_id);
  }

  const destinations = Array.from(associatedFunnelIds).flatMap(funnelId => {
    const funnel = ownedFunnels.get(funnelId);
    if (!funnel) return [];
    const isHomepage = website.homepage_funnel_id === funnelId;
    const routePaths = routes
      .filter(item => item.route.funnel_id === funnelId)
      .map(item => ({ routeId: item.route.id, path: item.path }))
      .filter((item, index, all) => all.findIndex(candidate => (
        candidate.routeId === item.routeId && candidate.path === item.path
      )) === index)
      .sort(routeOrder);
    if (!routePaths.some(item => item.path !== '/')) return [];
    const representative = isHomepage
      ? routePaths.find(item => item.path === '/') ?? routePaths[0]
      : routePaths[0];
    const routePath = representative?.path ?? (isHomepage ? '/' : '');
    return [{
      key: `funnel:${funnelId}`,
      funnelId,
      ...(representative ? { routeId: representative.routeId } : {}),
      routePath,
      routePaths,
      isHomepage,
      label: isHomepage
        ? `Homepage · / · ${funnel.name}`
        : `${routePath || 'Unrouted'} · ${funnel.name}`
    } satisfies BuilderNewPageDestination];
  });

  return destinations.sort((left, right) => (
    Number(right.isHomepage) - Number(left.isHomepage)
    || left.routePath.localeCompare(right.routePath)
    || (left.routeId ?? '').localeCompare(right.routeId ?? '')
    || left.funnelId.localeCompare(right.funnelId)
  ));
}

export function generateBuilderNewPageSlug(name: string): string {
  return normalizeBuilderPageSlug(name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^A-Za-z0-9\s_-]/g, ' '));
}

export function getBuilderNewPagePlannedPath(
  destination: BuilderNewPageDestination | undefined,
  slug: string
): string | null {
  if (!destination) return null;
  const normalizedSlug = normalizeBuilderPageSlug(slug);
  if (!normalizedSlug || normalizedSlug === 'home') return null;
  const expectedPath = `/${normalizedSlug}`;
  return destination.routePaths.some(route => route.path === expectedPath)
    ? expectedPath
    : null;
}

export function validateBuilderNewPageInput(
  input: BuilderNewPageInput,
  context: BuilderNewPageValidationContext
): BuilderNewPageValidationIssue[] {
  const issues: BuilderNewPageValidationIssue[] = [];
  const pageIssues = validateBuilderPageSettings({
    name: input.name,
    slug: input.slug,
    seo_title: '',
    seo_description: ''
  });
  for (const issue of pageIssues) {
    if (issue.field === 'name') issues.push({ field: 'name', code: issue.code as BuilderNewPageValidationIssue['code'], message: issue.message });
    if (issue.field === 'slug') issues.push({ field: 'slug', code: issue.code as BuilderNewPageValidationIssue['code'], message: issue.message });
  }

  const slug = normalizeBuilderPageSlug(input.slug);
  if (slug === 'home' || (BUILDER_NEW_PAGE_RESERVED_SLUGS as readonly string[]).includes(slug)) {
    issues.push({ field: 'slug', code: 'reserved-slug', message: 'This URL is reserved. Choose another page URL.' });
  }
  if (slug.length > BUILDER_PAGE_SLUG_MAX_LENGTH && !issues.some(issue => issue.field === 'slug' && issue.code === 'too-long')) {
    issues.push({ field: 'slug', code: 'too-long', message: `URL slug must be ${BUILDER_PAGE_SLUG_MAX_LENGTH} characters or fewer.` });
  }
  if (input.name.trim().length > BUILDER_PAGE_NAME_MAX_LENGTH && !issues.some(issue => issue.field === 'name' && issue.code === 'too-long')) {
    issues.push({ field: 'name', code: 'too-long', message: `Page name must be ${BUILDER_PAGE_NAME_MAX_LENGTH} characters or fewer.` });
  }
  if (context.existingPages.some(page => normalizeBuilderPageSlug(page.slug) === slug)) {
    issues.push({ field: 'slug', code: 'duplicate-slug', message: 'Another page in this account already uses this URL.' });
  }

  const destination = context.destinations.find(item => item.key === input.destinationKey);
  if (!destination) {
    issues.push({ field: 'destination', code: 'invalid-destination', message: 'This page destination is no longer available.' });
  } else if (slug && !getBuilderNewPagePlannedPath(destination, slug)) {
    issues.push({
      field: 'slug',
      code: 'unroutable-slug',
      message: 'This URL does not match an existing route for the selected destination.'
    });
  }
  return issues;
}

export function createBuilderNewPageDefaults(
  options: BuilderNewPageCreateDefaultsOptions
): Page {
  const name = options.input.name.trim();
  const slug = normalizeBuilderPageSlug(options.input.slug);
  const funnelPages = options.existingPages.filter(page => page.funnel_id === options.destination.funnelId);
  const finiteOrders = funnelPages
    .map(page => page.step_order)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const stepOrder = finiteOrders.length > 0
    ? Math.max(...finiteOrders) + 1
    : funnelPages.length === 0 ? 0 : undefined;

  return {
    id: options.id,
    user_id: options.actingUserId,
    name,
    slug,
    status: 'draft',
    seo_title: '',
    seo_description: '',
    seo_keywords: [],
    created_at: (options.now ?? (() => new Date().toISOString()))(),
    funnel_id: options.destination.funnelId,
    ...(stepOrder !== undefined ? { step_order: stepOrder } : {})
  };
}

export function isExpectedCreatedBuilderPage(actual: Page, expected: Page): boolean {
  return actual.id === expected.id
    && actual.user_id === expected.user_id
    && actual.name === expected.name
    && actual.slug === expected.slug
    && actual.status === 'draft'
    && actual.funnel_id === expected.funnel_id;
}
