import { describe, expect, it, vi } from 'vitest';
import type { Page } from './types';
import { resolveSiteRenderPage } from './site_render_page_resolution';

const page = (id: string, funnelId: string, marker: string): Page => ({
  id,
  user_id: 'user-1',
  funnel_id: funnelId,
  name: marker,
  slug: 'home',
  status: 'draft',
  seo_title: marker,
  seo_description: '',
  seo_keywords: [],
  created_at: ''
});

describe('site render page resolution', () => {
  it.each([
    ['Website A', page('page-a', 'funnel-a', 'WEBSITE_A_PAGE'), 'funnel-a'],
    ['Website B', page('page-b', 'funnel-b', 'WEBSITE_B_PAGE'), 'funnel-b']
  ])('renders the authoritative same-slug Page for %s without generic resolution', (_label, authoritativePage, funnelId) => {
    const generic = vi.fn(() => page('wrong-page', 'funnel-a', 'WEBSITE_A_PAGE'));
    const resolved = resolveSiteRenderPage({
      funnelId,
      authoritativePage,
      preview: true,
      resolvePreviewPage: generic,
      resolvePreviewFunnelFallback: generic,
      resolvePublicPage: generic
    });
    expect(resolved).toBe(authoritativePage);
    expect(resolved?.name).toBe(authoritativePage.name);
    expect(generic).not.toHaveBeenCalled();
  });

  it('fails closed when the authoritative Page belongs to another Funnel', () => {
    const generic = vi.fn(() => page('wrong-page', 'funnel-b', 'WEBSITE_B_PAGE'));
    expect(resolveSiteRenderPage({
      funnelId: 'funnel-b',
      authoritativePage: page('page-a', 'funnel-a', 'WEBSITE_A_PAGE'),
      preview: true,
      resolvePreviewPage: generic,
      resolvePreviewFunnelFallback: generic,
      resolvePublicPage: generic
    })).toBeNull();
    expect(generic).not.toHaveBeenCalled();
  });

  it('preserves existing single-Website preview and public resolution behavior without an override', () => {
    const previewPage = page('page-a', 'funnel-a', 'WEBSITE_A_PAGE');
    expect(resolveSiteRenderPage({
      funnelId: 'funnel-a', preview: true,
      resolvePreviewPage: () => previewPage,
      resolvePreviewFunnelFallback: () => null,
      resolvePublicPage: () => null
    })).toBe(previewPage);
    expect(resolveSiteRenderPage({
      funnelId: 'funnel-a', preview: false,
      resolvePreviewPage: () => null,
      resolvePreviewFunnelFallback: () => null,
      resolvePublicPage: () => previewPage
    })).toBe(previewPage);
  });
});
