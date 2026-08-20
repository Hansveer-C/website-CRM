import {
  EffectiveSiteNavigation,
  NavigationMenuScope,
  ResolvedNavigationItem,
  SiteNavigationItem,
  resolveEffectiveNavigation,
  validateAndNormalizeNavigationItems
} from './builder_site_navigation_domain';
import {
  BuilderSiteNavigationRepository
} from './builder_site_navigation_repository';
import type { EffectiveRoute } from './builder_route_lifecycle';

export type SiteNavigationUiState =
  | { status: 'uninitialized' }
  | { status: 'loading'; websiteId: string }
  | {
      status: 'ready';
      websiteId: string;
      menuScope: NavigationMenuScope;
      items: ResolvedNavigationItem[];
      rawItems: SiteNavigationItem[];
      isDraft: boolean;
      baseRevision: number;
      draftRevision: number;
      liveRevision: number;
      isSaving: boolean;
      errorMessage: string | null;
    }
  | { status: 'error'; websiteId: string; error: string; code: string };

export class BuilderSiteNavigationController {
  private state: SiteNavigationUiState = { status: 'uninitialized' };
  private requestGeneration = 0;
  private listeners: Array<(state: SiteNavigationUiState) => void> = [];

  constructor(private repo: BuilderSiteNavigationRepository) {}

  public getState(): SiteNavigationUiState {
    return this.state;
  }

  public subscribe(listener: (state: SiteNavigationUiState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public async hydrate(
    websiteId: string,
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    },
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<void> {
    if (!websiteId) {
      this.state = { status: 'uninitialized' };
      this.notify();
      return;
    }

    const currentGeneration = ++this.requestGeneration;
    this.state = { status: 'loading', websiteId };
    this.notify();

    const res = await this.repo.getEffectiveNavigation(websiteId, menuScope);

    // Cancel out-of-order responses if user switched websites
    if (this.requestGeneration !== currentGeneration) {
      return;
    }

    if (!res.success) {
      this.state = {
        status: 'error',
        websiteId,
        error: res.error,
        code: res.code
      };
      this.notify();
      return;
    }

    const resolved = resolveEffectiveNavigation(res.data.raw_items, context);

    this.state = {
      status: 'ready',
      websiteId,
      menuScope,
      items: resolved,
      rawItems: res.data.raw_items,
      isDraft: res.data.is_draft,
      baseRevision: res.data.base_revision,
      draftRevision: res.data.draft_revision,
      liveRevision: res.data.live_revision,
      isSaving: false,
      errorMessage: null
    };
    this.notify();
  }

  public async stageDraft(
    proposedItems: SiteNavigationItem[],
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (this.state.status !== 'ready') {
      return { success: false, error: 'Controller not in ready state' };
    }

    const { websiteId, menuScope, baseRevision, draftRevision, liveRevision } = this.state;

    // Validate and normalize contiguous positions in TypeScript domain before sending
    const norm = validateAndNormalizeNavigationItems(proposedItems);
    if (!norm.valid) {
      this.state = {
        ...this.state,
        errorMessage: norm.error ?? null
      };
      this.notify();
      return { success: false, error: norm.error ?? 'Validation failed' };
    }

    this.state = {
      ...this.state,
      isSaving: true,
      errorMessage: null
    };
    this.notify();

    const res = await this.repo.stageNavigationDraft(
      websiteId,
      norm.items,
      baseRevision,
      draftRevision,
      menuScope
    );

    if (!res.success) {
      if (this.state.status === 'ready' && this.state.websiteId === websiteId) {
        this.state = {
          ...this.state,
          isSaving: false,
          errorMessage: res.error
        };
        this.notify();
      }
      return { success: false, error: res.error };
    }

    const resolved = resolveEffectiveNavigation(norm.items, context);

    if (this.state.status === 'ready' && this.state.websiteId === websiteId) {
      this.state = {
        ...this.state,
        items: resolved,
        rawItems: norm.items,
        isDraft: res.data.is_draft,
        baseRevision: res.data.base_revision,
        draftRevision: res.data.draft_revision,
        liveRevision,
        isSaving: false,
        errorMessage: null
      };
      this.notify();
    }

    return { success: true };
  }

  public async revertDraft(
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (this.state.status !== 'ready') {
      return { success: false, error: 'Controller not in ready state' };
    }

    const { websiteId, menuScope, draftRevision } = this.state;

    this.state = {
      ...this.state,
      isSaving: true,
      errorMessage: null
    };
    this.notify();

    const res = await this.repo.revertNavigationDraft(websiteId, draftRevision, menuScope);

    if (!res.success) {
      if (this.state.status === 'ready' && this.state.websiteId === websiteId) {
        this.state = {
          ...this.state,
          isSaving: false,
          errorMessage: res.error
        };
        this.notify();
      }
      return { success: false, error: res.error };
    }

    const resolved = resolveEffectiveNavigation(res.data.raw_items, context);

    if (this.state.status === 'ready' && this.state.websiteId === websiteId) {
      this.state = {
        ...this.state,
        items: resolved,
        rawItems: res.data.raw_items,
        isDraft: res.data.is_draft,
        baseRevision: res.data.base_revision,
        draftRevision: res.data.draft_revision,
        liveRevision: res.data.live_revision,
        isSaving: false,
        errorMessage: null
      };
      this.notify();
    }

    return { success: true };
  }
}
