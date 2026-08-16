import { describe, expect, it } from 'vitest';
import type { Website } from './types';
import {
  buildWebsiteManagementRoute,
  buildWebsiteSettingsRoute,
  parseWebsiteManagementRoute,
  parseWebsiteSettingsRoute,
  resolveWebsiteSettingsSelection,
  type WebsiteManagementView
} from './website_settings_selection';

const website = (id: string, userId: string, name = id): Website => ({ id, user_id: userId, name } as Website);
const sites = [website('site-a', 'user-a', 'Website A'), website('site-b', 'user-a', 'Website B'), website('site-x', 'user-b', 'Foreign Website')];

describe('Website Settings explicit Website selection', () => {
  it('requires a selector for a bare multi-Website route', () => {
    const result = resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: sites, route: parseWebsiteSettingsRoute('#/website-settings') });
    expect(result.status).toBe('selection-required');
    expect(result.ownedWebsites.map(item => item.id)).toEqual(['site-a', 'site-b']);
  });

  it('resolves Website A and records a refresh-safe deep link', () => {
    const hash = buildWebsiteSettingsRoute('site-a');
    expect(hash).toBe('#/website-settings?websiteId=site-a');
    const result = resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: sites, route: parseWebsiteSettingsRoute(hash) });
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') expect(result.website.name).toBe('Website A');
  });

  it('switches deterministically between same-user Websites without carrying settings identity', () => {
    const first = resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: sites, route: parseWebsiteSettingsRoute(buildWebsiteSettingsRoute('site-a')) });
    const second = resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: sites, route: parseWebsiteSettingsRoute(buildWebsiteSettingsRoute('site-b')) });
    expect(first.status === 'resolved' && first.website.id).toBe('site-a');
    expect(second.status === 'resolved' && second.website.id).toBe('site-b');
  });

  it.each([
    '#/website-settings?websiteId=',
    '#/website-settings?websiteId=site/a',
    '#/website-settings?websiteId=site-a&websiteId=site-b'
  ])('fails closed for malformed route %s', hash => {
    expect(resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: sites, route: parseWebsiteSettingsRoute(hash) }).status).toBe('invalid');
  });

  it('fails closed for nonexistent and foreign Website IDs', () => {
    for (const id of ['missing', 'site-x']) {
      expect(resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: sites, route: { status: 'valid', websiteId: id } }).status).toBe('invalid');
    }
  });

  it('automatically resolves a sole owned Website and preserves zero-Website onboarding', () => {
    expect(resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: [sites[0]], route: { status: 'none' } }).status).toBe('resolved');
    expect(resolveWebsiteSettingsSelection({ actingUserId: 'user-c', websites: sites, route: { status: 'none' } }).status).toBe('empty');
  });

  it('does not inherit another account selection after an account switch', () => {
    const previousRoute = parseWebsiteSettingsRoute(buildWebsiteSettingsRoute('site-a'));
    expect(resolveWebsiteSettingsSelection({ actingUserId: 'user-b', websites: sites, route: previousRoute }).status).toBe('invalid');
  });
});

describe('Website management explicit Website selection', () => {
  const views: WebsiteManagementView[] = ['funnels', 'website-navigation', 'website-structure', 'seo-pages'];

  it.each(views)('requires a selector for a bare multi-Website %s route', view => {
    const route = parseWebsiteManagementRoute(`#/${view}`, view);
    expect(resolveWebsiteSettingsSelection({ actingUserId: 'user-a', websites: sites, route }).status).toBe('selection-required');
  });

  it.each(views)('builds and resolves a refresh-safe %s deep link', view => {
    const hash = buildWebsiteManagementRoute(view, 'site-b');
    expect(hash).toBe(`#/${view}?websiteId=site-b`);
    const result = resolveWebsiteSettingsSelection({
      actingUserId: 'user-a',
      websites: sites,
      route: parseWebsiteManagementRoute(hash, view)
    });
    expect(result.status === 'resolved' && result.website.id).toBe('site-b');
  });

  it.each(views)('fails closed for foreign, missing, malformed, and duplicate IDs on %s', view => {
    for (const hash of [
      `#/${view}?websiteId=site-x`,
      `#/${view}?websiteId=missing`,
      `#/${view}?websiteId=site/a`,
      `#/${view}?websiteId=site-a&websiteId=site-b`
    ]) {
      const result = resolveWebsiteSettingsSelection({
        actingUserId: 'user-a',
        websites: sites,
        route: parseWebsiteManagementRoute(hash, view)
      });
      expect(result.status).toBe('invalid');
    }
  });
});
