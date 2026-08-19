import type { Website } from './types';
import { mockFunnels, mockWebsiteRoutes, mockWebsites } from './db';
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
  expectedHomepageFunnelId: string | null | undefined,
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
      || mockWebsiteRoutes.some(r => r.website_id === websiteId && r.funnel_id === funnelId);
    if (!isAssociated) {
      return { success: false, error: 'Funnel is not an associated destination for this website', code: 'INVALID_INPUT' };
    }

    const currentHome = website.homepage_funnel_id ?? null;
    const expectedHome = expectedHomepageFunnelId ?? null;
    if (currentHome !== expectedHome) {
      return { success: false, error: 'The homepage changed elsewhere. Reload and try again.', code: 'CONFLICT' };
    }

    website.homepage_funnel_id = funnelId;
    website.updated_at = new Date().toISOString();

    const rootRoute = mockWebsiteRoutes.find(r => r.website_id === websiteId && r.path === '/');
    if (rootRoute) {
      rootRoute.funnel_id = funnelId;
    } else {
      mockWebsiteRoutes.push({
        id: `r-${Date.now()}`,
        website_id: websiteId,
        path: '/',
        funnel_id: funnelId,
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
    const rpcResult = await db.rpc('set_builder_homepage', {
      p_website_id: websiteId,
      p_funnel_id: funnelId,
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
      if (code === 'PT403') {
        return { success: false, error: 'FORBIDDEN', code: 'FORBIDDEN' };
      }
      if (code === 'PT409' || message?.includes('changed elsewhere')) {
        return { success: false, error: 'The homepage changed elsewhere. Reload and try again.', code: 'CONFLICT' };
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
