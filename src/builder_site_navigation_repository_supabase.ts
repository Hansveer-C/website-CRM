import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BuilderSiteNavigationRepository,
  SiteNavigationRepositoryResult
} from './builder_site_navigation_repository';
import {
  EffectiveSiteNavigation,
  NavigationMenuScope,
  SiteNavigationItem
} from './builder_site_navigation_domain';

export class SupabaseBuilderSiteNavigationRepository implements BuilderSiteNavigationRepository {
  constructor(private clientProvider: () => Promise<SupabaseClient | null>) {}

  private mapError(err: any): { error: string; code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_INPUT' | 'TRANSPORT_ERROR' } {
    const msg = err?.message || String(err);
    const code = err?.code || '';

    if (code === 'PT401' || msg.includes('Authentication required')) {
      return { error: 'Authentication required', code: 'UNAUTHORIZED' };
    }
    if (code === 'PT403' || msg.includes('permission denied')) {
      return { error: 'Permission denied', code: 'FORBIDDEN' };
    }
    if (code === 'PT404' || msg.includes('not found') || msg.includes('not associated')) {
      return { error: msg, code: 'NOT_FOUND' };
    }
    if (code === 'PT409' || msg.includes('modified elsewhere')) {
      return { error: msg, code: 'CONFLICT' };
    }
    if (code === 'PT400' || msg.includes('Invalid') || msg.includes('required') || msg.includes('cannot')) {
      return { error: msg, code: 'INVALID_INPUT' };
    }

    return { error: msg, code: 'TRANSPORT_ERROR' };
  }

  async getEffectiveNavigation(
    websiteId: string,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>> {
    try {
      const client = await this.clientProvider();
      if (!client) {
        return { success: false, error: 'Database client unavailable', code: 'TRANSPORT_ERROR' };
      }

      const { data, error } = await client.rpc('get_builder_effective_site_navigation', {
        p_website_id: websiteId,
        p_menu_scope: menuScope
      });

      if (error) {
        return { success: false, ...this.mapError(error) };
      }

      const rawItems = Array.isArray(data?.items) ? (data.items as SiteNavigationItem[]) : [];

      return {
        success: true,
        data: {
          website_id: data.website_id,
          menu_scope: data.menu_scope,
          items: [],
          raw_items: rawItems,
          is_draft: Boolean(data.is_draft),
          base_revision: Number(data.base_revision ?? 0),
          draft_revision: Number(data.draft_revision ?? 0),
          live_revision: Number(data.live_revision ?? 0),
          updated_at: data.updated_at || new Date().toISOString()
        }
      };
    } catch (err: any) {
      return { success: false, ...this.mapError(err) };
    }
  }

  async stageNavigationDraft(
    websiteId: string,
    items: SiteNavigationItem[],
    expectedBaseRevision?: number,
    expectedDraftRevision?: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: boolean; base_revision: number; draft_revision: number }>> {
    try {
      const client = await this.clientProvider();
      if (!client) {
        return { success: false, error: 'Database client unavailable', code: 'TRANSPORT_ERROR' };
      }

      const { data, error } = await client.rpc('stage_builder_site_navigation_draft', {
        p_website_id: websiteId,
        p_menu_scope: menuScope,
        p_items: items,
        p_expected_base_revision: expectedBaseRevision ?? null,
        p_expected_draft_revision: expectedDraftRevision ?? null
      });

      if (error) {
        return { success: false, ...this.mapError(error) };
      }

      return {
        success: true,
        data: {
          is_draft: Boolean(data?.is_draft),
          base_revision: Number(data?.base_revision ?? 0),
          draft_revision: Number(data?.draft_revision ?? 0)
        }
      };
    } catch (err: any) {
      return { success: false, ...this.mapError(err) };
    }
  }

  async revertNavigationDraft(
    websiteId: string,
    expectedDraftRevision?: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>> {
    try {
      const client = await this.clientProvider();
      if (!client) {
        return { success: false, error: 'Database client unavailable', code: 'TRANSPORT_ERROR' };
      }

      const { data, error } = await client.rpc('revert_builder_site_navigation_draft', {
        p_website_id: websiteId,
        p_menu_scope: menuScope,
        p_expected_draft_revision: expectedDraftRevision ?? null
      });

      if (error) {
        return { success: false, ...this.mapError(error) };
      }

      const rawItems = Array.isArray(data?.items) ? (data.items as SiteNavigationItem[]) : [];

      return {
        success: true,
        data: {
          website_id: data.website_id,
          menu_scope: data.menu_scope,
          items: [],
          raw_items: rawItems,
          is_draft: Boolean(data.is_draft),
          base_revision: Number(data.base_revision ?? 0),
          draft_revision: Number(data.draft_revision ?? 0),
          live_revision: Number(data.live_revision ?? 0),
          updated_at: data.updated_at || new Date().toISOString()
        }
      };
    } catch (err: any) {
      return { success: false, ...this.mapError(err) };
    }
  }

  async publishNavigation(
    websiteId: string,
    expectedBaseRevision?: number,
    expectedDraftRevision?: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: false; live_revision: number; items: SiteNavigationItem[] }>> {
    try {
      const client = await this.clientProvider();
      if (!client) {
        return { success: false, error: 'Database client unavailable', code: 'TRANSPORT_ERROR' };
      }

      const { data, error } = await client.rpc('publish_builder_site_navigation', {
        p_website_id: websiteId,
        p_menu_scope: menuScope,
        p_expected_base_revision: expectedBaseRevision ?? null,
        p_expected_draft_revision: expectedDraftRevision ?? null
      });

      if (error) {
        return { success: false, ...this.mapError(error) };
      }

      const rawItems = Array.isArray(data?.items) ? (data.items as SiteNavigationItem[]) : [];

      return {
        success: true,
        data: {
          is_draft: false,
          live_revision: Number(data?.live_revision ?? 1),
          items: rawItems
        }
      };
    } catch (err: any) {
      return { success: false, ...this.mapError(err) };
    }
  }
}
