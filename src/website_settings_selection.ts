import type { Website } from './types';

export type WebsiteSettingsRouteSelection =
  | { status: 'none' }
  | { status: 'valid'; websiteId: string }
  | { status: 'invalid' };

export type WebsiteSettingsSelection =
  | { status: 'empty'; ownedWebsites: Website[] }
  | { status: 'selection-required'; ownedWebsites: Website[] }
  | { status: 'invalid'; ownedWebsites: Website[] }
  | { status: 'resolved'; ownedWebsites: Website[]; website: Website };

const SETTINGS_ROUTE = '#/website-settings';
const WEBSITE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,200}$/;

export type WebsiteManagementView =
  | 'website-settings'
  | 'funnels'
  | 'website-navigation'
  | 'website-structure'
  | 'seo-pages';

export function parseWebsiteManagementRoute(hash: string, view: WebsiteManagementView): WebsiteSettingsRouteSelection {
  const [route, query = ''] = hash.split('?', 2);
  if (route !== `#/${view}`) return { status: 'none' };
  const params = new URLSearchParams(query);
  const websiteIds = params.getAll('websiteId');
  if (websiteIds.length === 0) return { status: 'none' };
  if (websiteIds.length !== 1) return { status: 'invalid' };
  const websiteId = websiteIds[0].trim();
  if (!WEBSITE_ID_PATTERN.test(websiteId)) return { status: 'invalid' };
  return { status: 'valid', websiteId };
}

export function buildWebsiteManagementRoute(view: WebsiteManagementView, websiteId: string): string {
  return `#/${view}?websiteId=${encodeURIComponent(websiteId)}`;
}

export function parseWebsiteSettingsRoute(hash: string): WebsiteSettingsRouteSelection {
  return parseWebsiteManagementRoute(hash, 'website-settings');
}

export function buildWebsiteSettingsRoute(websiteId: string): string {
  return `${SETTINGS_ROUTE}?websiteId=${encodeURIComponent(websiteId)}`;
}

export function resolveWebsiteSettingsSelection(input: {
  actingUserId: string;
  websites: readonly Website[];
  route: WebsiteSettingsRouteSelection;
}): WebsiteSettingsSelection {
  const ownedWebsites = input.websites.filter(website => website.user_id === input.actingUserId);
  if (ownedWebsites.length === 0) return { status: 'empty', ownedWebsites };
  if (input.route.status === 'invalid') return { status: 'invalid', ownedWebsites };
  if (input.route.status === 'valid') {
    const explicitWebsiteId = input.route.websiteId;
    const website = ownedWebsites.find(candidate => candidate.id === explicitWebsiteId);
    return website
      ? { status: 'resolved', ownedWebsites, website }
      : { status: 'invalid', ownedWebsites };
  }
  if (ownedWebsites.length === 1) return { status: 'resolved', ownedWebsites, website: ownedWebsites[0] };
  return { status: 'selection-required', ownedWebsites };
}
