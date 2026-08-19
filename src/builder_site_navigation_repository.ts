import {
  EffectiveSiteNavigation,
  NavigationMenuScope,
  SiteNavigationItem,
  SiteNavigationSnapshot,
  areNavigationSnapshotsEqual
} from './builder_site_navigation_domain';

export type SiteNavigationRepositoryResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_INPUT' | 'TRANSPORT_ERROR' };

export interface BuilderSiteNavigationRepository {
  getEffectiveNavigation(
    websiteId: string,
    menuScope?: NavigationMenuScope
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>>;

  stageNavigationDraft(
    websiteId: string,
    items: SiteNavigationItem[],
    expectedBaseRevision?: number,
    menuScope?: NavigationMenuScope
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: boolean; base_revision: number }>>;

  revertNavigationDraft(
    websiteId: string,
    menuScope?: NavigationMenuScope
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>>;
}

// In-Memory Mock Repository for Testing / Offline Development
export class MockBuilderSiteNavigationRepository implements BuilderSiteNavigationRepository {
  private liveStore = new Map<string, SiteNavigationSnapshot>();
  private draftStore = new Map<string, { items: SiteNavigationItem[]; base_revision: number; updated_at: string }>();
  private validFunnelIds = new Set<string>();

  public registerFunnel(funnelId: string) {
    this.validFunnelIds.add(funnelId);
  }

  public setLiveSnapshot(websiteId: string, items: SiteNavigationItem[], revision = 1, scope: NavigationMenuScope = 'primary') {
    const key = `${websiteId}:${scope}`;
    this.liveStore.set(key, {
      website_id: websiteId,
      menu_scope: scope,
      items: [...items],
      revision,
      updated_at: new Date().toISOString()
    });
  }

  async getEffectiveNavigation(
    websiteId: string,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>> {
    if (!websiteId) {
      return { success: false, error: 'Website ID is required', code: 'INVALID_INPUT' };
    }

    const key = `${websiteId}:${menuScope}`;
    const live = this.liveStore.get(key);
    const draft = this.draftStore.get(key);

    const liveRevision = live?.revision ?? 0;
    const liveItems = live?.items ?? [];

    if (draft) {
      return {
        success: true,
        data: {
          website_id: websiteId,
          menu_scope: menuScope,
          items: [],
          raw_items: [...draft.items],
          is_draft: true,
          base_revision: draft.base_revision,
          live_revision: liveRevision,
          updated_at: draft.updated_at
        }
      };
    }

    return {
      success: true,
      data: {
        website_id: websiteId,
        menu_scope: menuScope,
        items: [],
        raw_items: [...liveItems],
        is_draft: false,
        base_revision: liveRevision,
        live_revision: liveRevision,
        updated_at: live?.updated_at ?? new Date().toISOString()
      }
    };
  }

  async stageNavigationDraft(
    websiteId: string,
    items: SiteNavigationItem[],
    expectedBaseRevision?: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: boolean; base_revision: number }>> {
    if (!websiteId) {
      return { success: false, error: 'Website ID is required', code: 'INVALID_INPUT' };
    }

    const key = `${websiteId}:${menuScope}`;
    const live = this.liveStore.get(key);
    const liveRevision = live?.revision ?? 0;
    const liveItems = live?.items ?? [];

    if (typeof expectedBaseRevision === 'number' && expectedBaseRevision !== liveRevision) {
      return {
        success: false,
        error: 'The navigation configuration was modified elsewhere. Reload and try again.',
        code: 'CONFLICT'
      };
    }

    // Validate internal items target valid funnels
    for (const item of items) {
      if (item.target_kind === 'internal') {
        if (this.validFunnelIds.size > 0 && !this.validFunnelIds.has(item.target_value)) {
          return {
            success: false,
            error: `Internal destination '${item.target_value}' not found or invalid`,
            code: 'NOT_FOUND'
          };
        }
      }
    }

    // Check if draft equals live snapshot
    if (areNavigationSnapshotsEqual(items, liveItems)) {
      this.draftStore.delete(key);
      return {
        success: true,
        data: {
          is_draft: false,
          base_revision: liveRevision
        }
      };
    }

    this.draftStore.set(key, {
      items: [...items],
      base_revision: liveRevision,
      updated_at: new Date().toISOString()
    });

    return {
      success: true,
      data: {
        is_draft: true,
        base_revision: liveRevision
      }
    };
  }

  async revertNavigationDraft(
    websiteId: string,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>> {
    if (!websiteId) {
      return { success: false, error: 'Website ID is required', code: 'INVALID_INPUT' };
    }

    const key = `${websiteId}:${menuScope}`;
    this.draftStore.delete(key);
    return this.getEffectiveNavigation(websiteId, menuScope);
  }
}
