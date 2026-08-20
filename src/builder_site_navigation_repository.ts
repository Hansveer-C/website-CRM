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
    expectedDraftRevision?: number,
    menuScope?: NavigationMenuScope
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: boolean; base_revision: number; draft_revision: number }>>;

  revertNavigationDraft(
    websiteId: string,
    expectedDraftRevision?: number,
    menuScope?: NavigationMenuScope
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>>;

  publishNavigation(
    websiteId: string,
    expectedBaseRevision?: number,
    expectedDraftRevision?: number,
    menuScope?: NavigationMenuScope
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: false; live_revision: number; items: SiteNavigationItem[] }>>;
}

// In-Memory Mock Repository for Testing / Offline Development
export class MockBuilderSiteNavigationRepository implements BuilderSiteNavigationRepository {
  private liveStore = new Map<string, SiteNavigationSnapshot>();
  private draftStore = new Map<string, { items: SiteNavigationItem[]; base_revision: number; draft_revision: number; updated_at: string }>();
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
          draft_revision: draft.draft_revision,
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
        draft_revision: 0,
        live_revision: liveRevision,
        updated_at: live?.updated_at ?? new Date().toISOString()
      }
    };
  }

  async stageNavigationDraft(
    websiteId: string,
    items: SiteNavigationItem[],
    expectedBaseRevision?: number,
    expectedDraftRevision?: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: boolean; base_revision: number; draft_revision: number }>> {
    if (!websiteId) {
      return { success: false, error: 'Website ID is required', code: 'INVALID_INPUT' };
    }

    const key = `${websiteId}:${menuScope}`;
    const live = this.liveStore.get(key);
    const draft = this.draftStore.get(key);
    const liveRevision = live?.revision ?? 0;
    const liveItems = live?.items ?? [];

    if (typeof expectedBaseRevision === 'number' && expectedBaseRevision !== liveRevision) {
      return {
        success: false,
        error: 'The navigation configuration was modified elsewhere. Reload and try again.',
        code: 'CONFLICT'
      };
    }

    if (draft) {
      if (typeof expectedDraftRevision !== 'number' || expectedDraftRevision !== draft.draft_revision) {
        return {
          success: false,
          error: 'The navigation draft was modified elsewhere. Reload and try again.',
          code: 'CONFLICT'
        };
      }
    } else {
      if (typeof expectedDraftRevision === 'number' && expectedDraftRevision !== 0) {
        return {
          success: false,
          error: 'The navigation draft was modified elsewhere. Reload and try again.',
          code: 'CONFLICT'
        };
      }
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

    // Check if draft equals live snapshot (only if live snapshot exists)
    if (live && areNavigationSnapshotsEqual(items, liveItems)) {
      this.draftStore.delete(key);
      return {
        success: true,
        data: {
          is_draft: false,
          base_revision: liveRevision,
          draft_revision: 0
        }
      };
    }

    const nextDraftRev = draft ? draft.draft_revision + 1 : 1;

    this.draftStore.set(key, {
      items: [...items],
      base_revision: liveRevision,
      draft_revision: nextDraftRev,
      updated_at: new Date().toISOString()
    });

    return {
      success: true,
      data: {
        is_draft: true,
        base_revision: liveRevision,
        draft_revision: nextDraftRev
      }
    };
  }

  async revertNavigationDraft(
    websiteId: string,
    expectedDraftRevision?: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<EffectiveSiteNavigation>> {
    if (!websiteId) {
      return { success: false, error: 'Website ID is required', code: 'INVALID_INPUT' };
    }

    const key = `${websiteId}:${menuScope}`;
    const draft = this.draftStore.get(key);

    if (draft) {
      if (typeof expectedDraftRevision !== 'number') {
        return {
          success: false,
          error: 'Draft revision token is required when a draft exists. Reload and try again.',
          code: 'CONFLICT'
        };
      }
      if (expectedDraftRevision !== draft.draft_revision) {
        return {
          success: false,
          error: 'The navigation draft was modified elsewhere. Reload and try again.',
          code: 'CONFLICT'
        };
      }
    }

    this.draftStore.delete(key);
    return this.getEffectiveNavigation(websiteId, menuScope);
  }

  async publishNavigation(
    websiteId: string,
    expectedBaseRevision?: number,
    expectedDraftRevision?: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: false; live_revision: number; items: SiteNavigationItem[] }>> {
    if (!websiteId) {
      return { success: false, error: 'Website ID is required', code: 'INVALID_INPUT' };
    }

    const key = `${websiteId}:${menuScope}`;
    const live = this.liveStore.get(key);
    const draft = this.draftStore.get(key);
    const liveRevision = live?.revision ?? 0;

    if (!draft) {
      return {
        success: false,
        error: 'No navigation draft found to publish',
        code: 'NOT_FOUND'
      };
    }

    if (draft.base_revision !== liveRevision) {
      return {
        success: false,
        error: 'The draft is based on a stale navigation revision. Re-stage or discard draft before publishing.',
        code: 'CONFLICT'
      };
    }

    if (typeof expectedBaseRevision === 'number' && expectedBaseRevision !== liveRevision) {
      return {
        success: false,
        error: 'Navigation has been modified live elsewhere. Reload and try again.',
        code: 'CONFLICT'
      };
    }

    if (typeof expectedDraftRevision === 'number' && expectedDraftRevision !== draft.draft_revision) {
      return {
        success: false,
        error: 'Navigation draft has been modified elsewhere. Reload and try again.',
        code: 'CONFLICT'
      };
    }

    const nextLiveRevision = liveRevision + 1;
    const publishedItems = [...draft.items];

    this.liveStore.set(key, {
      website_id: websiteId,
      menu_scope: menuScope,
      items: publishedItems,
      revision: nextLiveRevision,
      updated_at: new Date().toISOString()
    });

    this.draftStore.delete(key);

    return {
      success: true,
      data: {
        is_draft: false,
        live_revision: nextLiveRevision,
        items: publishedItems
      }
    };
  }
}
