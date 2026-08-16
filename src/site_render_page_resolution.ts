import type { Page } from './types';

export interface SiteRenderPageResolutionInput {
  funnelId: string;
  authoritativePage?: Page;
  edgePage?: Page;
  preview: boolean;
  resolvePreviewPage(): Page | null;
  resolvePublicPage(): Page | null;
  resolvePreviewFunnelFallback(): Page | null;
}

/** An authenticated, ownership-checked Page is authoritative and must never be re-resolved by slug. */
export function resolveSiteRenderPage(input: SiteRenderPageResolutionInput): Page | null {
  if (input.authoritativePage) {
    return input.authoritativePage.funnel_id === input.funnelId ? input.authoritativePage : null;
  }
  if (input.edgePage) return input.edgePage;
  if (input.preview) return input.resolvePreviewPage() || input.resolvePreviewFunnelFallback();
  return input.resolvePublicPage();
}
