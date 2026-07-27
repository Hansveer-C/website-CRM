import type { Funnel, Page, Website, WebsiteRoute } from './types';

export const BUILDER_NAVIGATION_ACTIONS = [
  'edit',
  'pages',
  'settings',
  'assets',
  'guided-setup',
  'preview',
  'publish'
] as const;

export type BuilderNavigationAction = typeof BUILDER_NAVIGATION_ACTIONS[number];

export interface BuilderNavigationTarget {
  websiteId: string;
  pageId: string;
  action: BuilderNavigationAction;
}

export type BuilderNavigationParseResult =
  | { status: 'valid'; target: BuilderNavigationTarget }
  | { status: 'not-builder-route' }
  | { status: 'invalid'; reason: 'missing-website' | 'missing-page' | 'unknown-action' | 'duplicate-parameter' };

export type BuilderNavigationResolution =
  | { status: 'resolved'; website: Website; page: Page; target: BuilderNavigationTarget }
  | { status: 'unavailable'; reason: 'website-unavailable' | 'page-unavailable' | 'page-out-of-scope' };

const isNonblank = (value: string): boolean => value.trim().length > 0;

export function isBuilderNavigationAction(value: string): value is BuilderNavigationAction {
  return (BUILDER_NAVIGATION_ACTIONS as readonly string[]).includes(value);
}

export function buildBuilderNavigationTarget(target: BuilderNavigationTarget): string {
  if (!isNonblank(target.websiteId)) throw new Error('Builder navigation requires a website ID.');
  if (!isNonblank(target.pageId)) throw new Error('Builder navigation requires a page ID.');
  if (!isBuilderNavigationAction(target.action)) {
    throw new Error(`Unknown builder navigation action: ${String(target.action)}`);
  }

  const params = new URLSearchParams();
  params.set('websiteId', target.websiteId);
  params.set('pageId', target.pageId);
  params.set('action', target.action);
  return `#/builder?${params.toString()}`;
}

export function parseBuilderNavigationTarget(hash: string): BuilderNavigationParseResult {
  const normalized = hash.startsWith('#/') ? hash.slice(2) : hash.replace(/^#/, '');
  const [route, query = ''] = normalized.split('?');
  if (route !== 'builder') return { status: 'not-builder-route' };

  const params = new URLSearchParams(query);
  for (const key of ['websiteId', 'pageId', 'action']) {
    if (params.getAll(key).length > 1) return { status: 'invalid', reason: 'duplicate-parameter' };
  }

  const websiteId = params.get('websiteId') ?? '';
  const pageId = params.get('pageId') ?? '';
  const action = params.get('action') ?? 'edit';
  if (!isNonblank(websiteId)) return { status: 'invalid', reason: 'missing-website' };
  if (!isNonblank(pageId)) return { status: 'invalid', reason: 'missing-page' };
  if (!isBuilderNavigationAction(action)) return { status: 'invalid', reason: 'unknown-action' };
  return { status: 'valid', target: { websiteId, pageId, action } };
}

export function resolveBuilderNavigationTarget(input: {
  actingUserId: string;
  target: BuilderNavigationTarget;
  websites: readonly Website[];
  routes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
}): BuilderNavigationResolution {
  const website = input.websites.find(item => item.id === input.target.websiteId && item.user_id === input.actingUserId);
  if (!website) return { status: 'unavailable', reason: 'website-unavailable' };
  const page = input.pages.find(item => item.id === input.target.pageId && item.user_id === input.actingUserId);
  if (!page) return { status: 'unavailable', reason: 'page-unavailable' };

  const funnelIds = new Set<string>();
  if (website.homepage_funnel_id?.trim()) funnelIds.add(website.homepage_funnel_id);
  input.routes
    .filter(route => route.website_id === website.id && route.funnel_id?.trim())
    .forEach(route => funnelIds.add(route.funnel_id));
  const ownedFunnelIds = new Set(input.funnels
    .filter(funnel => funnel.user_id === input.actingUserId && funnelIds.has(funnel.id))
    .map(funnel => funnel.id));
  if (!page.funnel_id || !ownedFunnelIds.has(page.funnel_id)) {
    return { status: 'unavailable', reason: 'page-out-of-scope' };
  }
  return { status: 'resolved', website, page, target: { ...input.target } };
}
