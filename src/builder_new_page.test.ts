import { describe, expect, it } from 'vitest';
import type { Funnel, Page, Website, WebsiteRoute } from './types';
import {
  BUILDER_NEW_PAGE_RESERVED_SLUGS,
  createBuilderNewPageDefaults,
  generateBuilderNewPageSlug,
  getBuilderNewPagePlannedPath,
  getEligibleNewPageDestinations,
  validateBuilderNewPageInput
} from './builder_new_page';

const website: Website = {
  id: 'website-1', user_id: 'owner-1', name: 'Site', domain: null, subdomain: 'site',
  homepage_funnel_id: 'funnel-home', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
};
const funnels: Funnel[] = [
  { id: 'funnel-home', user_id: 'owner-1', name: 'Home', status: 'draft', created_at: '', updated_at: '' },
  { id: 'funnel-services', user_id: 'owner-1', name: 'Services', status: 'draft', created_at: '', updated_at: '' },
  { id: 'foreign-funnel', user_id: 'owner-2', name: 'Foreign', status: 'draft', created_at: '', updated_at: '' }
];
const routes: WebsiteRoute[] = [
  { id: 'route-root', website_id: 'website-1', path: '/', funnel_id: 'funnel-home', created_at: '' },
  { id: 'route-driveway', website_id: 'website-1', path: '/driveway', funnel_id: 'funnel-home', created_at: '' },
  { id: 'route-services', website_id: 'website-1', path: '/services', funnel_id: 'funnel-services', created_at: '' },
  { id: 'route-foreign-site', website_id: 'website-2', path: '/other', funnel_id: 'funnel-services', created_at: '' },
  { id: 'route-foreign-owner', website_id: 'website-1', path: '/foreign', funnel_id: 'foreign-funnel', created_at: '' }
];
const existingPage: Page = {
  id: 'page-home', user_id: 'owner-1', name: 'Home', slug: 'home', status: 'published',
  seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: 'funnel-home', step_order: 1
};

function destinations(overrides: Partial<Parameters<typeof getEligibleNewPageDestinations>[0]> = {}) {
  return getEligibleNewPageDestinations({
    website, websiteRoutes: routes, funnels, pages: [existingPage], actingUserId: 'owner-1', ...overrides
  });
}

describe('getEligibleNewPageDestinations', () => {
  it('resolves homepage and matching route funnels in deterministic order', () => {
    const result = destinations();
    expect(result.map(item => item.funnelId)).toEqual(['funnel-home', 'funnel-services']);
    expect(result[0]).toMatchObject({ isHomepage: true, routePath: '/', routeId: 'route-root' });
    expect(result[0].routePaths.map(route => route.path)).toEqual(['/', '/driveway']);
  });

  it('deduplicates a homepage funnel also present in routes', () => {
    expect(destinations().filter(item => item.funnelId === 'funnel-home')).toHaveLength(1);
  });

  it('excludes other websites, other owners, null and missing funnels', () => {
    const extra = [
      ...routes,
      { id: 'null', website_id: 'website-1', path: '/null', funnel_id: '', created_at: '' },
      { id: 'missing', website_id: 'website-1', path: '/missing', funnel_id: 'missing', created_at: '' }
    ];
    expect(destinations({ websiteRoutes: extra }).flatMap(item => item.routePaths).map(item => item.routeId))
      .toEqual(['route-root', 'route-driveway', 'route-services']);
  });

  it('rejects all destinations when the website owner differs', () => {
    expect(destinations({ actingUserId: 'owner-2' })).toEqual([]);
  });

  it('does not establish association from owner equality alone', () => {
    expect(destinations({ websiteRoutes: [], website: { ...website, homepage_funnel_id: null } })).toEqual([]);
  });

  it('excludes a destination that has no non-home route available for a new slug', () => {
    expect(destinations({ websiteRoutes: [routes[0]] })).toEqual([]);
  });

  it('does not mutate any resolver input', () => {
    const snapshot = structuredClone({ website, routes, funnels });
    destinations();
    expect({ website, routes, funnels }).toEqual(snapshot);
  });
});

describe('New Page validation and defaults', () => {
  const destination = destinations()[0];
  const context = { destinations: destinations(), existingPages: [existingPage] };

  it('generates deterministic ASCII slugs and preserves reasonable transliterations', () => {
    expect(generateBuilderNewPageSlug('  Café & Deck Cleaning  ')).toBe('cafe-deck-cleaning');
    expect(generateBuilderNewPageSlug('東京')).toBe('');
  });

  it('plans only exact existing route paths', () => {
    expect(getBuilderNewPagePlannedPath(destination, 'driveway')).toBe('/driveway');
    expect(getBuilderNewPagePlannedPath(destination, 'patio')).toBeNull();
    expect(getBuilderNewPagePlannedPath(destination, 'home')).toBeNull();
  });

  it('accepts Unicode names with a valid explicitly routable slug', () => {
    expect(validateBuilderNewPageInput({ name: 'Lavage extérieur', slug: 'driveway', destinationKey: destination.key }, context)).toEqual([]);
  });

  it('rejects blank and control-character names', () => {
    expect(validateBuilderNewPageInput({ name: ' ', slug: 'driveway', destinationKey: destination.key }, context).some(issue => issue.field === 'name')).toBe(true);
    expect(validateBuilderNewPageInput({ name: 'Bad\u0001', slug: 'driveway', destinationKey: destination.key }, context).some(issue => issue.code === 'control-character')).toBe(true);
  });

  it('enforces the name hard limit', () => {
    expect(validateBuilderNewPageInput({ name: 'x'.repeat(121), slug: 'driveway', destinationKey: destination.key }, context).some(issue => issue.code === 'too-long')).toBe(true);
  });

  it.each(['https://bad', 'bad?x=1', 'bad#part', 'bad\\path', '../bad', 'café', ''])(
    'rejects unsafe slug %j', slug => {
      expect(validateBuilderNewPageInput({ name: 'Page', slug, destinationKey: destination.key }, context).some(issue => issue.field === 'slug')).toBe(true);
    }
  );

  it('normalizes leading slashes and repeated separators', () => {
    expect(validateBuilderNewPageInput({ name: 'Page', slug: '/driveway///', destinationKey: destination.key }, context)).toEqual([]);
    expect(generateBuilderNewPageSlug('Driveway___Cleaning')).toBe('driveway-cleaning');
  });

  it.each([...BUILDER_NEW_PAGE_RESERVED_SLUGS, 'home'])(
    'rejects reserved slug %s', slug => {
      const reservedDestination = { ...destination, routePaths: [...destination.routePaths, { routeId: slug, path: `/${slug}` }] };
      const issues = validateBuilderNewPageInput(
        { name: 'Page', slug, destinationKey: destination.key },
        { destinations: [reservedDestination], existingPages: [] }
      );
      expect(issues.some(issue => issue.code === 'reserved-slug')).toBe(true);
    }
  );

  it('rejects owner-wide duplicate slugs', () => {
    expect(validateBuilderNewPageInput({ name: 'Page', slug: 'home', destinationKey: destination.key }, context)
      .some(issue => issue.code === 'duplicate-slug')).toBe(true);
  });

  it('rejects stale and unroutable destinations', () => {
    expect(validateBuilderNewPageInput({ name: 'Page', slug: 'driveway', destinationKey: 'missing' }, context)
      .some(issue => issue.code === 'invalid-destination')).toBe(true);
    expect(validateBuilderNewPageInput({ name: 'Page', slug: 'patio', destinationKey: destination.key }, context)
      .some(issue => issue.code === 'unroutable-slug')).toBe(true);
  });

  it('creates a draft empty-page record without protected caller fields', () => {
    const page = createBuilderNewPageDefaults({
      input: { name: ' Driveway ', slug: '/DRIVEWAY/', destinationKey: destination.key },
      destination,
      actingUserId: 'owner-1', existingPages: [existingPage], id: 'fixed-id', now: () => 'now'
    });
    expect(page).toEqual({
      id: 'fixed-id', user_id: 'owner-1', name: 'Driveway', slug: 'driveway', status: 'draft',
      seo_title: '', seo_description: '', seo_keywords: [], created_at: 'now', funnel_id: 'funnel-home', step_order: 2
    });
    expect(page).not.toHaveProperty('step_type');
  });

  it('does not assign a finite order ahead of existing unordered fallback pages', () => {
    const unordered = { ...existingPage, step_order: undefined };
    const page = createBuilderNewPageDefaults({
      input: { name: 'Driveway', slug: 'driveway', destinationKey: destination.key }, destination,
      actingUserId: 'owner-1', existingPages: [unordered], id: 'id', now: () => 'now'
    });
    expect(page.step_order).toBeUndefined();
  });
});
