import type { WebsiteGenerationData } from './website_generation_contract';
import {
  ProtectedAsyncOperationGuard,
  type ProtectedAsyncOperationToken
} from './website_dashboard_hydration_guard';

export interface WebsiteGenerationAuthorityToken {
  userId: string;
  idempotencyKey: string;
  operation: ProtectedAsyncOperationToken;
  navigation: ProtectedAsyncOperationToken;
}

export type WebsiteGenerationCommitResult = 'committed' | 'invalid' | 'stale';

export function isAuthorizedWebsiteGenerationGraph(
  data: WebsiteGenerationData,
  initiatingUserId: string,
  idempotencyKey: string
): boolean {
  if (!initiatingUserId || data.idempotency_key !== idempotencyKey) return false;
  if (data.website.user_id !== initiatingUserId
    || data.settings.user_id !== initiatingUserId
    || data.funnel.user_id !== initiatingUserId
    || data.page.user_id !== initiatingUserId) return false;
  if (data.settings.website_id !== data.website.id
    || data.route.website_id !== data.website.id
    || data.route.funnel_id !== data.funnel.id
    || data.page.funnel_id !== data.funnel.id
    || (data.website.homepage_funnel_id !== null && data.website.homepage_funnel_id !== data.funnel.id)) return false;

  const sectionIds = new Set<string>();
  const sectionOrders = new Set<number>();
  for (const section of data.sections) {
    if (section.page_id !== data.page.id
      || sectionIds.has(section.id)
      || sectionOrders.has(section.order)) return false;
    sectionIds.add(section.id);
    sectionOrders.add(section.order);
  }
  return data.sections.every((_, index) => sectionOrders.has(index));
}

export class WebsiteGenerationAuthority {
  constructor(private readonly guard: ProtectedAsyncOperationGuard) {}

  begin(userIdInput: string, idempotencyKey: string): WebsiteGenerationAuthorityToken | null {
    const userId = userIdInput.trim();
    if (!userId) return null;
    const navigation = this.guard.captureCurrent('application-navigation', userId);
    if (!navigation) return null;
    return {
      userId,
      idempotencyKey,
      operation: this.guard.begin('website-generation', userId),
      navigation
    };
  }

  commitGraph(
    token: WebsiteGenerationAuthorityToken,
    currentUserId: string,
    data: WebsiteGenerationData,
    commit: () => void
  ): WebsiteGenerationCommitResult {
    if (!isAuthorizedWebsiteGenerationGraph(data, token.userId, token.idempotencyKey)) return 'invalid';
    return this.guard.commitIfCurrent(token.operation, currentUserId, commit) ? 'committed' : 'stale';
  }

  isViewCurrent(token: WebsiteGenerationAuthorityToken, currentUserId: string): boolean {
    return this.guard.isCurrent(token.operation, currentUserId)
      && this.guard.isCurrent(token.navigation, currentUserId);
  }

  isOperationCurrent(token: WebsiteGenerationAuthorityToken, currentUserId: string): boolean {
    return this.guard.isCurrent(token.operation, currentUserId);
  }
}
