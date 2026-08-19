import type { SupabaseClient } from '@supabase/supabase-js';
import type { RouteDraft, EffectiveRoute, RouteOperationResultCode } from './builder_route_lifecycle';
import { normalizeRoutePath } from './builder_route_lifecycle';
import { mockWebsiteRoutes, mockWebsites, mockFunnels } from './db';

export interface RouteOperationResult {
  success: boolean;
  code: RouteOperationResultCode;
  data?: {
    draft?: RouteDraft | null;
    effective_routes?: EffectiveRoute[];
  };
  error?: string;
}

export interface EffectiveRoutesResult {
  success: boolean;
  code: RouteOperationResultCode;
  data?: {
    routes: EffectiveRoute[];
  };
  error?: string;
}

export interface SetRouteDraftInput {
  websiteId: string;
  funnelId: string;
  path: string;
  routeId?: string | null;
  expectedDraftPath?: string | null;
  expectedLivePath?: string | null;
}

export interface DeleteRouteDraftInput {
  websiteId: string;
  routeId?: string | null;
  funnelId?: string | null;
  expectedDraftPath?: string | null;
}

export interface RevertRouteDraftInput {
  websiteId: string;
  routeId?: string | null;
  funnelId?: string | null;
}

// In-memory mock storage for local fallback
export const mockBuilderRouteDrafts: RouteDraft[] = [];

export async function setBuilderRouteDraft(
  input: SetRouteDraftInput,
  actingUserId?: string,
  client?: SupabaseClient
): Promise<RouteOperationResult> {
  const userId = actingUserId?.trim();
  if (!userId) {
    return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
  }

  if (!input.websiteId || !input.funnelId || !input.path) {
    return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' };
  }

  const pathValidation = normalizeRoutePath(input.path);
  if (!pathValidation.valid) {
    return {
      success: false,
      error: pathValidation.error || 'INVALID_PATH',
      code: pathValidation.errorCode || 'INVALID_PATH'
    };
  }

  const normalizedPath = pathValidation.normalizedPath;
  const db = client ?? (typeof window !== 'undefined' ? (window as any).supabaseClient : undefined);
  const usesRemote = !!db;

  if (!usesRemote) {
    const website = mockWebsites.find(w => w.id === input.websiteId && w.user_id === userId);
    if (!website) {
      return { success: false, error: 'Website not found', code: 'NOT_FOUND' };
    }

    const funnel = mockFunnels.find(f => f.id === input.funnelId && f.user_id === userId);
    if (!funnel) {
      return { success: false, error: 'Funnel not found', code: 'NOT_FOUND' };
    }

    // Find existing live route
    const liveRoute = input.routeId
      ? mockWebsiteRoutes.find(r => r.id === input.routeId && r.website_id === input.websiteId)
      : mockWebsiteRoutes.find(r => r.funnel_id === input.funnelId && r.website_id === input.websiteId);

    // Collision check
    const otherLiveCollision = mockWebsiteRoutes.find(r => (
      r.website_id === input.websiteId
      && r.path === normalizedPath
      && r.id !== liveRoute?.id
      && !mockBuilderRouteDrafts.some(d => d.website_id === input.websiteId && d.route_id === r.id && d.action === 'delete')
    ));

    const otherDraftCollision = mockBuilderRouteDrafts.find(d => (
      d.website_id === input.websiteId
      && d.path === normalizedPath
      && d.action === 'upsert'
      && d.funnel_id !== input.funnelId
    ));

    if (otherLiveCollision || otherDraftCollision) {
      return { success: false, error: 'Path is already in use by another page on this website', code: 'COLLISION' };
    }

    const existingDraft = mockBuilderRouteDrafts.find(d => (
      d.website_id === input.websiteId && (
        (input.routeId && d.route_id === input.routeId) ||
        (d.funnel_id === input.funnelId)
      )
    ));

    // Optimistic concurrency check
    const currentDraftPath = existingDraft?.action === 'upsert' ? existingDraft.path : null;
    if (input.expectedDraftPath !== undefined && currentDraftPath !== input.expectedDraftPath) {
      return { success: false, error: 'The route was modified elsewhere. Reload and try again.', code: 'CONFLICT' };
    }

    const currentLivePath = liveRoute ? liveRoute.path : null;
    if (input.expectedLivePath !== undefined && currentLivePath !== input.expectedLivePath) {
      return { success: false, error: 'The live route changed elsewhere. Reload and try again.', code: 'CONFLICT' };
    }

    // Revert check: If path equals existing live path, remove draft
    if (liveRoute && liveRoute.path === normalizedPath) {
      if (existingDraft) {
        const idx = mockBuilderRouteDrafts.indexOf(existingDraft);
        if (idx !== -1) mockBuilderRouteDrafts.splice(idx, 1);
      }
      return {
        success: true,
        code: 'SUCCESS',
        data: { draft: null }
      };
    }

    // Staging draft upsert
    const draft: RouteDraft = {
      id: existingDraft?.id || `d-rt-${Date.now()}`,
      website_id: input.websiteId,
      route_id: liveRoute?.id || null,
      path: normalizedPath,
      funnel_id: input.funnelId,
      action: 'upsert',
      created_at: existingDraft?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingDraft) {
      Object.assign(existingDraft, draft);
    } else {
      mockBuilderRouteDrafts.push(draft);
    }

    return {
      success: true,
      code: 'SUCCESS',
      data: { draft }
    };
  }

  try {
    const rpcResult = await db.rpc('set_builder_route_draft', {
      p_website_id: input.websiteId,
      p_funnel_id: input.funnelId,
      p_path: normalizedPath,
      p_route_id: input.routeId || null,
      p_expected_draft_path: input.expectedDraftPath ?? null,
      p_expected_live_path: input.expectedLivePath ?? null
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      const message = rpcResult.error.message || '';
      if (code === 'PT404') return { success: false, error: message || 'NOT_FOUND', code: 'NOT_FOUND' };
      if (code === 'PT401') return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
      if (code === 'PT403') return { success: false, error: 'FORBIDDEN', code: 'FORBIDDEN' };
      if (code === 'PT409' || message.includes('already in use')) {
        return { success: false, error: message || 'COLLISION', code: message.includes('modified elsewhere') ? 'CONFLICT' : 'COLLISION' };
      }
      if (message.includes('Root route') || message.includes('root route')) {
        return { success: false, error: message, code: 'ROOT_ROUTE_RESERVED' };
      }
      if (message.includes('reserved') || message.includes('Reserved')) {
        return { success: false, error: message, code: 'RESERVED_PATH' };
      }
      if (code === 'PT400') {
        return { success: false, error: message || 'INVALID_PATH', code: 'INVALID_PATH' };
      }
      return { success: false, error: message || 'ROUTE_UPDATE_FAILED', code: 'AMBIGUOUS' };
    }

    const data = rpcResult.data as { draft?: RouteDraft | null };
    return {
      success: true,
      code: 'SUCCESS',
      data: { draft: data?.draft ?? null }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'The route update result is uncertain. Please reload to check.',
      code: 'AMBIGUOUS'
    };
  }
}

export async function deleteBuilderRouteDraft(
  input: DeleteRouteDraftInput,
  actingUserId?: string,
  client?: SupabaseClient
): Promise<RouteOperationResult> {
  const userId = actingUserId?.trim();
  if (!userId) {
    return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
  }

  if (!input.websiteId || (!input.routeId && !input.funnelId)) {
    return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' };
  }

  const db = client ?? (typeof window !== 'undefined' ? (window as any).supabaseClient : undefined);
  const usesRemote = !!db;

  if (!usesRemote) {
    const liveRoute = input.routeId
      ? mockWebsiteRoutes.find(r => r.id === input.routeId && r.website_id === input.websiteId)
      : mockWebsiteRoutes.find(r => r.funnel_id === input.funnelId && r.website_id === input.websiteId);

    if (liveRoute?.path === '/') {
      return { success: false, error: 'Root homepage route cannot be deleted through route management.', code: 'ROOT_ROUTE_RESERVED' };
    }

    const existingDraft = mockBuilderRouteDrafts.find(d => (
      d.website_id === input.websiteId && (
        (input.routeId && d.route_id === input.routeId) ||
        (input.funnelId && d.funnel_id === input.funnelId)
      )
    ));

    if (!liveRoute && existingDraft) {
      // Draft-only route: delete completely
      const idx = mockBuilderRouteDrafts.indexOf(existingDraft);
      if (idx !== -1) mockBuilderRouteDrafts.splice(idx, 1);
      return { success: true, code: 'SUCCESS', data: { draft: null } };
    }

    if (liveRoute) {
      // Stage deletion
      const draft: RouteDraft = {
        id: existingDraft?.id || `d-rt-${Date.now()}`,
        website_id: input.websiteId,
        route_id: liveRoute.id,
        path: liveRoute.path,
        funnel_id: liveRoute.funnel_id,
        action: 'delete',
        created_at: existingDraft?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existingDraft) {
        Object.assign(existingDraft, draft);
      } else {
        mockBuilderRouteDrafts.push(draft);
      }

      return { success: true, code: 'SUCCESS', data: { draft } };
    }

    return { success: false, error: 'Route not found', code: 'NOT_FOUND' };
  }

  try {
    const rpcResult = await db.rpc('delete_builder_route_draft', {
      p_website_id: input.websiteId,
      p_route_id: input.routeId || null,
      p_funnel_id: input.funnelId || null,
      p_expected_draft_path: input.expectedDraftPath ?? null
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      const message = rpcResult.error.message || '';
      if (code === 'PT404') return { success: false, error: message || 'NOT_FOUND', code: 'NOT_FOUND' };
      if (code === 'PT401') return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
      if (code === 'PT403') return { success: false, error: 'FORBIDDEN', code: 'FORBIDDEN' };
      if (code === 'PT409') return { success: false, error: message || 'CONFLICT', code: 'CONFLICT' };
      if (message.includes('Root route') || message.includes('root route') || message.includes('Root homepage')) {
        return { success: false, error: message, code: 'ROOT_ROUTE_RESERVED' };
      }
      return { success: false, error: message || 'ROUTE_DELETE_FAILED', code: 'AMBIGUOUS' };
    }

    const data = rpcResult.data as { draft?: RouteDraft | null };
    return { success: true, code: 'SUCCESS', data: { draft: data?.draft ?? null } };
  } catch (err: any) {
    return { success: false, error: err?.message || 'The route deletion result is uncertain. Please reload to check.', code: 'AMBIGUOUS' };
  }
}

export async function revertBuilderRouteDraft(
  input: RevertRouteDraftInput,
  actingUserId?: string,
  client?: SupabaseClient
): Promise<RouteOperationResult> {
  const userId = actingUserId?.trim();
  if (!userId) {
    return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
  }

  if (!input.websiteId || (!input.routeId && !input.funnelId)) {
    return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' };
  }

  const db = client ?? (typeof window !== 'undefined' ? (window as any).supabaseClient : undefined);
  const usesRemote = !!db;

  if (!usesRemote) {
    const existingDraft = mockBuilderRouteDrafts.find(d => (
      d.website_id === input.websiteId && (
        (input.routeId && d.route_id === input.routeId) ||
        (input.funnelId && d.funnel_id === input.funnelId)
      )
    ));

    if (existingDraft) {
      const idx = mockBuilderRouteDrafts.indexOf(existingDraft);
      if (idx !== -1) mockBuilderRouteDrafts.splice(idx, 1);
    }

    return { success: true, code: 'SUCCESS', data: { draft: null } };
  }

  try {
    const rpcResult = await db.rpc('revert_builder_route_draft', {
      p_website_id: input.websiteId,
      p_route_id: input.routeId || null,
      p_funnel_id: input.funnelId || null
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      const message = rpcResult.error.message || '';
      if (code === 'PT404') return { success: false, error: message || 'NOT_FOUND', code: 'NOT_FOUND' };
      if (code === 'PT401') return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
      if (code === 'PT403') return { success: false, error: 'FORBIDDEN', code: 'FORBIDDEN' };
      return { success: false, error: message || 'ROUTE_REVERT_FAILED', code: 'AMBIGUOUS' };
    }

    return { success: true, code: 'SUCCESS', data: { draft: null } };
  } catch (err: any) {
    return { success: false, error: err?.message || 'The route revert result is uncertain. Please reload to check.', code: 'AMBIGUOUS' };
  }
}

export async function getBuilderEffectiveRoutes(
  websiteId: string,
  actingUserId?: string,
  client?: SupabaseClient
): Promise<EffectiveRoutesResult> {
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
    const liveRoutes = mockWebsiteRoutes.filter(r => r.website_id === websiteId);
    const drafts = mockBuilderRouteDrafts.filter(d => d.website_id === websiteId);

    const effective: EffectiveRoute[] = [];

    for (const live of liveRoutes) {
      const draft = drafts.find(d => d.route_id === live.id || d.funnel_id === live.funnel_id);
      if (draft?.action === 'delete') {
        effective.push({
          id: live.id,
          website_id: websiteId,
          path: live.path,
          funnel_id: live.funnel_id,
          live_path: live.path,
          draft_path: null,
          draft_id: draft.id,
          is_draft_override: false,
          is_staged_delete: true,
          is_new_draft: false
        });
      } else if (draft?.action === 'upsert') {
        effective.push({
          id: live.id,
          website_id: websiteId,
          path: draft.path,
          funnel_id: live.funnel_id,
          live_path: live.path,
          draft_path: draft.path,
          draft_id: draft.id,
          is_draft_override: true,
          is_staged_delete: false,
          is_new_draft: false
        });
      } else {
        effective.push({
          id: live.id,
          website_id: websiteId,
          path: live.path,
          funnel_id: live.funnel_id,
          live_path: live.path,
          draft_path: null,
          draft_id: null,
          is_draft_override: false,
          is_staged_delete: false,
          is_new_draft: false
        });
      }
    }

    for (const draft of drafts.filter(d => !d.route_id && d.action === 'upsert')) {
      effective.push({
        id: draft.id,
        website_id: websiteId,
        path: draft.path,
        funnel_id: draft.funnel_id,
        live_path: null,
        draft_path: draft.path,
        draft_id: draft.id,
        is_draft_override: true,
        is_staged_delete: false,
        is_new_draft: true
      });
    }

    return {
      success: true,
      code: 'SUCCESS',
      data: { routes: effective }
    };
  }

  try {
    const rpcResult = await db.rpc('get_builder_effective_routes', {
      p_website_id: websiteId
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      const message = rpcResult.error.message || '';
      if (code === 'PT404') return { success: false, error: message || 'NOT_FOUND', code: 'NOT_FOUND' };
      if (code === 'PT401') return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
      return { success: false, error: message || 'FETCH_ROUTES_FAILED', code: 'AMBIGUOUS' };
    }

    const data = rpcResult.data as { routes?: EffectiveRoute[] };
    return {
      success: true,
      code: 'SUCCESS',
      data: { routes: data?.routes ?? [] }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to fetch effective routes',
      code: 'AMBIGUOUS'
    };
  }
}

export interface PublishRoutesInput {
  websiteId: string;
  expectedDraftCount?: number;
  expectedDraftIds?: string[];
}

export interface RoutePublishResult {
  success: boolean;
  code: RouteOperationResultCode;
  data?: {
    published_count: number;
  };
  error?: string;
}

export const mockWebsiteRouteRedirects: Array<{
  id: string;
  website_id: string;
  from_path: string;
  to_path: string;
  created_at: string;
  updated_at: string;
}> = [];

export async function publishBuilderRoutes(
  input: PublishRoutesInput,
  actingUserId?: string,
  client?: SupabaseClient
): Promise<RoutePublishResult> {
  const userId = actingUserId?.trim();
  if (!userId) {
    return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
  }

  if (!input.websiteId) {
    return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' };
  }

  const db = client ?? (typeof window !== 'undefined' ? (window as any).supabaseClient : undefined);
  const usesRemote = !!db;

  if (!usesRemote) {
    const website = mockWebsites.find(w => w.id === input.websiteId && w.user_id === userId);
    if (!website) {
      return { success: false, error: 'Website not found', code: 'NOT_FOUND' };
    }

    const drafts = mockBuilderRouteDrafts.filter(d => d.website_id === input.websiteId);
    if (drafts.length === 0) {
      return { success: true, code: 'SUCCESS', data: { published_count: 0 } };
    }

    if (input.expectedDraftCount !== undefined && drafts.length !== input.expectedDraftCount) {
      return { success: false, error: 'The route drafts were modified elsewhere. Reload and try again.', code: 'CONFLICT' };
    }

    if (input.expectedDraftIds !== undefined) {
      const currentIds = drafts.map(d => d.id).sort();
      const expectedIds = [...input.expectedDraftIds].sort();
      if (JSON.stringify(currentIds) !== JSON.stringify(expectedIds)) {
        return { success: false, error: 'The route drafts were modified elsewhere. Reload and try again.', code: 'CONFLICT' };
      }
    }

    // Pre-validate all drafts
    for (const draft of drafts) {
      const funnel = mockFunnels.find(f => f.id === draft.funnel_id && f.user_id === userId);
      if (!funnel) {
        return { success: false, error: 'Funnel not found for draft route', code: 'NOT_FOUND' };
      }

      if (draft.path === '/') {
        return { success: false, error: 'Root homepage route cannot be published through route management.', code: 'ROOT_ROUTE_RESERVED' };
      }

      if (draft.action === 'upsert') {
        const otherLiveCollision = mockWebsiteRoutes.find(r => (
          r.website_id === input.websiteId
          && r.path === draft.path
          && r.id !== draft.route_id
          && !drafts.some(otherD => otherD.route_id === r.id && (otherD.action === 'delete' || otherD.path !== draft.path))
        ));

        if (otherLiveCollision) {
          return { success: false, error: `Path ${draft.path} is already in use by another live page on this website`, code: 'COLLISION' };
        }
      }
    }

    // Apply deletes
    for (const draft of drafts.filter(d => d.action === 'delete')) {
      if (draft.route_id) {
        const idx = mockWebsiteRoutes.findIndex(r => r.id === draft.route_id && r.website_id === input.websiteId);
        if (idx !== -1) mockWebsiteRoutes.splice(idx, 1);
      }
    }

    // Apply renames
    for (const draft of drafts.filter(d => d.action === 'upsert' && d.route_id)) {
      const liveRoute = mockWebsiteRoutes.find(r => r.id === draft.route_id && r.website_id === input.websiteId);
      if (liveRoute && liveRoute.path !== draft.path) {
        const oldPath = liveRoute.path;

        // Remove any existing redirect with from_path = draft.path
        const existingRedirectIdx = mockWebsiteRouteRedirects.findIndex(rd => rd.website_id === input.websiteId && rd.from_path === draft.path);
        if (existingRedirectIdx !== -1) mockWebsiteRouteRedirects.splice(existingRedirectIdx, 1);

        // Add/update redirect
        const redirectIdx = mockWebsiteRouteRedirects.findIndex(rd => rd.website_id === input.websiteId && rd.from_path === oldPath);
        if (redirectIdx !== -1) {
          mockWebsiteRouteRedirects[redirectIdx].to_path = draft.path;
          mockWebsiteRouteRedirects[redirectIdx].updated_at = new Date().toISOString();
        } else {
          mockWebsiteRouteRedirects.push({
            id: `rd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            website_id: input.websiteId,
            from_path: oldPath,
            to_path: draft.path,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        // Collapse sequential redirect chains
        for (const rd of mockWebsiteRouteRedirects.filter(rd => rd.website_id === input.websiteId && rd.to_path === oldPath && rd.from_path !== draft.path)) {
          rd.to_path = draft.path;
          rd.updated_at = new Date().toISOString();
        }

        liveRoute.path = draft.path;
        liveRoute.funnel_id = draft.funnel_id;
      }
    }

    // Apply creates
    for (const draft of drafts.filter(d => d.action === 'upsert' && !d.route_id)) {
      const existingRedirectIdx = mockWebsiteRouteRedirects.findIndex(rd => rd.website_id === input.websiteId && rd.from_path === draft.path);
      if (existingRedirectIdx !== -1) mockWebsiteRouteRedirects.splice(existingRedirectIdx, 1);

      mockWebsiteRoutes.push({
        id: `r-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        website_id: input.websiteId,
        path: draft.path,
        funnel_id: draft.funnel_id,
        created_at: new Date().toISOString()
      });
    }

    // Clear drafts
    const draftIdsToRemove = new Set(drafts.map(d => d.id));
    for (let i = mockBuilderRouteDrafts.length - 1; i >= 0; i--) {
      if (draftIdsToRemove.has(mockBuilderRouteDrafts[i].id)) {
        mockBuilderRouteDrafts.splice(i, 1);
      }
    }

    return {
      success: true,
      code: 'SUCCESS',
      data: { published_count: drafts.length }
    };
  }

  try {
    const rpcResult = await db.rpc('publish_builder_routes', {
      p_website_id: input.websiteId,
      p_expected_draft_count: input.expectedDraftCount ?? null,
      p_expected_draft_ids: input.expectedDraftIds ?? null
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      const message = rpcResult.error.message || '';
      if (code === 'PT404') return { success: false, error: message || 'NOT_FOUND', code: 'NOT_FOUND' };
      if (code === 'PT401') return { success: false, error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' };
      if (code === 'PT409' || message.includes('already in use')) {
        return { success: false, error: message || 'CONFLICT', code: message.includes('already in use') ? 'COLLISION' : 'CONFLICT' };
      }
      if (message.includes('not published yet')) {
        return { success: false, error: message, code: 'UNPUBLISHED_DESTINATION' };
      }
      if (message.includes('Root route') || message.includes('Root homepage')) {
        return { success: false, error: message, code: 'ROOT_ROUTE_RESERVED' };
      }
      if (code === 'PT400') {
        return { success: false, error: message || 'INVALID_INPUT', code: 'INVALID_INPUT' };
      }
      return { success: false, error: message || 'ROUTE_PUBLISH_FAILED', code: 'AMBIGUOUS' };
    }

    const data = rpcResult.data as { published_count?: number };
    return {
      success: true,
      code: 'SUCCESS',
      data: { published_count: data?.published_count ?? 0 }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'The route publication result is uncertain. Please reload to check.',
      code: 'AMBIGUOUS'
    };
  }
}
