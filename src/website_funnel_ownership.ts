import type { Funnel, Website } from './types';

/** Canonical application-side ownership predicate for website funnels. */
export function isOwnedWebsiteFunnel(
  funnel: Pick<Funnel, 'user_id' | 'website_id'> | undefined,
  website: Pick<Website, 'id' | 'user_id'> | undefined,
  actingUserId: string
): boolean {
  return !!funnel && !!website
    && website.user_id === actingUserId
    && funnel.user_id === actingUserId
    && funnel.website_id === website.id;
}
