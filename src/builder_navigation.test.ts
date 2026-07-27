import { describe, expect, it } from 'vitest';
import {
  BUILDER_NAVIGATION_ACTIONS,
  buildBuilderNavigationTarget,
  parseBuilderNavigationTarget,
  resolveBuilderNavigationTarget
} from './builder_navigation';
import type { Funnel, Page, Website, WebsiteRoute } from './types';

const website: Website = { id: 'site / one', user_id: 'u1', name: 'Site', domain: null, subdomain: 'site', homepage_funnel_id: 'f1', created_at: '', updated_at: '' };
const funnel: Funnel = { id: 'f1', user_id: 'u1', name: 'Home', status: 'draft', created_at: '', updated_at: '' };
const page: Page = { id: 'page & one', user_id: 'u1', name: 'Home', slug: 'home', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '', funnel_id: 'f1' };
const route: WebsiteRoute = { id: 'r1', website_id: website.id, path: '/', funnel_id: 'f1', created_at: '' };

describe('builder navigation', () => {
  it.each(BUILDER_NAVIGATION_ACTIONS)('round trips the %s action with encoded IDs', action => {
    const hash = buildBuilderNavigationTarget({ websiteId: website.id, pageId: page.id, action });
    expect(hash).not.toContain('u1');
    expect(parseBuilderNavigationTarget(hash)).toEqual({ status: 'valid', target: { websiteId: website.id, pageId: page.id, action } });
  });

  it('rejects missing IDs, unknown actions, and duplicate required parameters', () => {
    expect(() => buildBuilderNavigationTarget({ websiteId: '', pageId: page.id, action: 'edit' })).toThrow(/website ID/);
    expect(() => buildBuilderNavigationTarget({ websiteId: website.id, pageId: '', action: 'edit' })).toThrow(/page ID/);
    expect(() => buildBuilderNavigationTarget({ websiteId: website.id, pageId: page.id, action: 'bad' as never })).toThrow(/Unknown/);
    expect(parseBuilderNavigationTarget('#/builder?websiteId=a&websiteId=b&pageId=p&action=edit')).toMatchObject({ status: 'invalid' });
  });

  it('requires the exact owned page to belong to the exact website', () => {
    expect(resolveBuilderNavigationTarget({ actingUserId: 'u1', target: { websiteId: website.id, pageId: page.id, action: 'edit' }, websites: [website], routes: [route], funnels: [funnel], pages: [page] }).status).toBe('resolved');
    expect(resolveBuilderNavigationTarget({ actingUserId: 'u2', target: { websiteId: website.id, pageId: page.id, action: 'edit' }, websites: [website], routes: [route], funnels: [funnel], pages: [page] }).status).toBe('unavailable');
    expect(resolveBuilderNavigationTarget({ actingUserId: 'u1', target: { websiteId: website.id, pageId: page.id, action: 'edit' }, websites: [website], routes: [route], funnels: [funnel], pages: [{ ...page, funnel_id: 'other' }] })).toMatchObject({ status: 'unavailable', reason: 'page-out-of-scope' });
  });
});
