import type { Website } from './types';
import { mockFunnels, mockPages, mockWebsiteRoutes, mockWebsites } from './db';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SetHomepageResultCode =
  | 'SUCCESS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'AMBIGUOUS'
  | 'UNAVAILABLE';

export interface SetHomepageResult {
  success: boolean;
  code: SetHomepageResultCode;
  data?: {
    website: Website;
  };
  error?: string;
}

export async function setBuilderHomepage(
  websiteId: string,
  funnelId: string,
  expectedDraftHomepageFunnelId: string | null | undefined,
  actingUserId?: string,
  client?: SupabaseClient
): Promise<SetHomepageResult> {
  const userId = actingUserId?.trim();
  if (!userId) {
    return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
  }

  if (!websiteId || !funnelId) {
    return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' };
  }

  const db = client ?? (typeof window !== 'undefined' ? (window as any).supabaseClient : undefined);
  const usesRemote = !!db;

  if (!usesRemote) {
    const website = mockWebsites.find(w => w.id === websiteId && w.user_id === userId);
    if (!website) {
      return { success: false, error: 'NOT_FOUND', code: 'NOT_FOUND' };
    }

    const funnel = mockFunnels.find(f => f.id === funnelId && f.user_id === userId);
    if (!funnel) {
      return { success: false, error: 'NOT_FOUND', code: 'NOT_FOUND' };
    }

    const isAssociated = website.homepage_funnel_id === funnelId
      || website.draft_homepage_funnel_id === funnelId
      || mockWebsiteRoutes.some(r => r.website_id === websiteId && r.funnel_id === funnelId);
    if (!isAssociated) {
      return { success: false, error: 'Funnel is not an associated destination for this website', code: 'INVALID_INPUT' };
    }

    const currentDraft = website.draft_homepage_funnel_id ?? null;
    const expectedDraft = expectedDraftHomepageFunnelId ?? null;
    if (currentDraft !== expectedDraft) {
      return { success: false, error: 'The draft homepage changed elsewhere. Reload and try again.', code: 'CONFLICT' };
    }

    // If setting to currently live homepage, clear the draft override
    if (funnelId === website.homepage_funnel_id) {
      website.draft_homepage_funnel_id = null;
    } else {
      website.draft_homepage_funnel_id = funnelId;
    }
    website.updated_at = new Date().toISOString();

    return {
      success: true,
      code: 'SUCCESS',
      data: { website: { ...website } }
    };
  }

  try {
    const rpcResult = await db.rpc('set_builder_draft_homepage', {
      p_website_id: websiteId,
      p_funnel_id: funnelId,
      p_expected_draft_homepage_funnel_id: expectedDraftHomepageFunnelId ?? null
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      const message = rpcResult.error.message;
      if (code === 'PT404') {
        return { success: false, error: message || 'NOT_FOUND', code: 'NOT_FOUND' };
      }
      if (code === 'PT401') {
        return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
      }
      if (code === 'PT403') {
        return { success: false, error: 'FORBIDDEN', code: 'FORBIDDEN' };
      }
      if (code === 'PT409' || message?.includes('changed elsewhere')) {
        return { success: false, error: 'The draft homepage changed elsewhere. Reload and try again.', code: 'CONFLICT' };
      }
      if (code === 'PT400') {
        return { success: false, error: message ?? 'INVALID_INPUT', code: 'INVALID_INPUT' };
      }
      return { success: false, error: message ?? 'HOMEPAGE_UPDATE_FAILED', code: code ?? 'AMBIGUOUS' };
    }

    const data = rpcResult.data as { website?: Record<string, unknown> };
    if (!data?.website) {
      return { success: false, error: 'The homepage update result is uncertain. Please reload to check.', code: 'AMBIGUOUS' };
    }

    const website: Website = {
      id: String(data.website.id),
      user_id: String(data.website.user_id),
      name: String(data.website.name),
      domain: typeof data.website.domain === 'string' ? data.website.domain : null,
      subdomain: String(data.website.subdomain || ''),
      homepage_funnel_id: typeof data.website.homepage_funnel_id === 'string' ? data.website.homepage_funnel_id : null,
      draft_homepage_funnel_id: typeof data.website.draft_homepage_funnel_id === 'string' ? data.website.draft_homepage_funnel_id : null,
      created_at: String(data.website.created_at || ''),
      updated_at: String(data.website.updated_at || '')
    };

    return {
      success: true,
      code: 'SUCCESS',
      data: { website }
    };
  } catch {
    return {
      success: false,
      error: 'The homepage update result is uncertain. Please reload to check.',
      code: 'AMBIGUOUS'
    };
  }
}

export async function publishBuilderHomepage(
  websiteId: string,
  expectedDraftHomepageFunnelId?: string | null,
  expectedHomepageFunnelId?: string | null,
  actingUserId?: string,
  client?: SupabaseClient
): Promise<SetHomepageResult> {
  const userId = actingUserId?.trim();
  if (!userId) {
    return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
  }

  if (!websiteId) {
    return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' };
  }

  const db = client ?? (typeof window !== 'undefined' ? (window as any).supabaseClient : undefined);
  const usesRemote = !!db;

  if (!usesRemote) {
    const website = mockWebsites.find(w => w.id === websiteId && w.user_id === userId);
    if (!website) {
      return { success: false, error: 'NOT_FOUND', code: 'NOT_FOUND' };
    }

    const currentDraft = website.draft_homepage_funnel_id ?? null;
    const currentLive = website.homepage_funnel_id ?? null;

    if (expectedDraftHomepageFunnelId !== undefined && currentDraft !== expectedDraftHomepageFunnelId) {
      return { success: false, error: 'The draft homepage changed elsewhere. Reload and try again.', code: 'CONFLICT' };
    }
    if (expectedHomepageFunnelId !== undefined && currentLive !== expectedHomepageFunnelId) {
      return { success: false, error: 'The live homepage changed elsewhere. Reload and try again.', code: 'CONFLICT' };
    }

    if (!currentDraft || currentDraft === currentLive) {
      return { success: true, code: 'SUCCESS', data: { website: { ...website } } };
    }

    // Verify destination root page is published
    const draftPages = mockPages.filter(p => p.funnel_id === currentDraft && p.user_id === userId);
    const sortedPages = [...draftPages].sort((a, b) => {
      const aHome = a.slug?.trim().toLowerCase() === 'home' || a.name?.trim().toLowerCase() === 'home';
      const bHome = b.slug?.trim().toLowerCase() === 'home' || b.name?.trim().toLowerCase() === 'home';
      if (aHome && !bHome) return -1;
      if (!aHome && bHome) return 1;
      return (a.step_order ?? 0) - (b.step_order ?? 0);
    });
    const targetPage = sortedPages[0];
    if (!targetPage) {
      return { success: false, error: 'No pages exist in the selected homepage destination', code: 'INVALID_INPUT' };
    }
    if (targetPage.status !== 'published') {
      return { success: false, error: 'The selected homepage is not published yet. Publish that page before making it live.', code: 'INVALID_INPUT' };
    }

    // Promote
    website.homepage_funnel_id = currentDraft;
    website.draft_homepage_funnel_id = null;
    website.updated_at = new Date().toISOString();

    const rootRoute = mockWebsiteRoutes.find(r => r.website_id === websiteId && r.path === '/');
    if (rootRoute) {
      rootRoute.funnel_id = currentDraft;
    } else {
      mockWebsiteRoutes.push({
        id: `r-${Date.now()}`,
        website_id: websiteId,
        path: '/',
        funnel_id: currentDraft,
        created_at: new Date().toISOString()
      });
    }

    return {
      success: true,
      code: 'SUCCESS',
      data: { website: { ...website } }
    };
  }

  try {
    const rpcResult = await db.rpc('publish_builder_homepage', {
      p_website_id: websiteId,
      p_expected_draft_homepage_funnel_id: expectedDraftHomepageFunnelId ?? null,
      p_expected_homepage_funnel_id: expectedHomepageFunnelId ?? null
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      const message = rpcResult.error.message;
      if (code === 'PT404') {
        return { success: false, error: message || 'NOT_FOUND', code: 'NOT_FOUND' };
      }
      if (code === 'PT401') {
        return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
      }
      if (code === 'PT409' || message?.includes('changed elsewhere')) {
        return { success: false, error: message || 'CONFLICT', code: 'CONFLICT' };
      }
      if (code === 'PT400') {
        return { success: false, error: message ?? 'INVALID_INPUT', code: 'INVALID_INPUT' };
      }
      return { success: false, error: message ?? 'HOMEPAGE_PUBLISH_FAILED', code: code ?? 'AMBIGUOUS' };
    }

    const data = rpcResult.data as { website?: Record<string, unknown> };
    if (!data?.website) {
      return { success: false, error: 'The homepage publication result is uncertain. Please reload to check.', code: 'AMBIGUOUS' };
    }

    const website: Website = {
      id: String(data.website.id),
      user_id: String(data.website.user_id),
      name: String(data.website.name),
      domain: typeof data.website.domain === 'string' ? data.website.domain : null,
      subdomain: String(data.website.subdomain || ''),
      homepage_funnel_id: typeof data.website.homepage_funnel_id === 'string' ? data.website.homepage_funnel_id : null,
      draft_homepage_funnel_id: typeof data.website.draft_homepage_funnel_id === 'string' ? data.website.draft_homepage_funnel_id : null,
      created_at: String(data.website.created_at || ''),
      updated_at: String(data.website.updated_at || '')
    };

    return {
      success: true,
      code: 'SUCCESS',
      data: { website }
    };
  } catch {
    return {
      success: false,
      error: 'The homepage publication result is uncertain. Please reload to check.',
      code: 'AMBIGUOUS'
    };
  }
}
