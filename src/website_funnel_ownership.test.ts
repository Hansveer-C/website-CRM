import { describe, expect, it } from 'vitest';
import { isOwnedWebsiteFunnel } from './website_funnel_ownership';

const website = { id: 'website-a', user_id: 'owner-a' };

describe('website funnel ownership', () => {
  it('identifies an unrouted funnel from its canonical Website ownership', () => {
    expect(isOwnedWebsiteFunnel({ user_id: 'owner-a', website_id: 'website-a' }, website, 'owner-a')).toBe(true);
  });

  it('rejects same-tenant funnels belonging to another Website and foreign tenants', () => {
    expect(isOwnedWebsiteFunnel({ user_id: 'owner-a', website_id: 'website-b' }, website, 'owner-a')).toBe(false);
    expect(isOwnedWebsiteFunnel({ user_id: 'owner-b', website_id: 'website-a' }, website, 'owner-a')).toBe(false);
    expect(isOwnedWebsiteFunnel({ user_id: 'owner-a', website_id: null }, website, 'owner-a')).toBe(false);
  });
});
