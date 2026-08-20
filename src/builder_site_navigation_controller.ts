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

export interface SiteNavigationReadyState {
  status: 'ready';
  websiteId: string;
  menuScope: NavigationMenuScope;
  items: ResolvedNavigationItem[];
  rawItems: SiteNavigationItem[];
  liveItems: SiteNavigationItem[];
  isDraft: boolean;
  baseRevision: number;
  draftRevision: number;
  liveRevision: number;
  isSaving: boolean;
  isConflict: boolean;
  errorMessage: string | null;
}

export type SiteNavigationUiState =
  | { status: 'uninitialized' }
  | { status: 'loading'; websiteId: string; menuScope: NavigationMenuScope }
  | SiteNavigationReadyState
  | { status: 'error'; websiteId: string; menuScope: NavigationMenuScope; error: string; code: string };

export class BuilderSiteNavigationController {
  private state: SiteNavigationUiState = { status: 'uninitialized' };
  private activeWebsiteId = '';
  private activeMenuScope: NavigationMenuScope = 'primary';
  private requestGeneration = 0;
  private scopeCache = new Map<string, SiteNavigationReadyState>();
  private listeners: Array<(state: SiteNavigationUiState) => void> = [];

  constructor(private repo: BuilderSiteNavigationRepository) {}

  public getState(): SiteNavigationUiState {
    return this.state;
  }

  public getActiveWebsiteId(): string {
    return this.activeWebsiteId;
  }

  public getActiveMenuScope(): NavigationMenuScope {
    return this.activeMenuScope;
  }

  public getCachedScopeState(websiteId: string, menuScope: NavigationMenuScope): SiteNavigationReadyState | undefined {
    return this.scopeCache.get(`${websiteId}:${menuScope}`);
  }

  public invalidateScopeCache(websiteId: string, menuScope: NavigationMenuScope) {
    this.scopeCache.delete(`${websiteId}:${menuScope}`);
  }

  public getScopeSummary(websiteId: string): { primaryHasDraft: boolean; footerHasDraft: boolean; draftCount: number } {
    const primary = this.scopeCache.get(`${websiteId}:primary`);
    const footer = this.scopeCache.get(`${websiteId}:footer`);
    const primaryHasDraft = Boolean(primary?.isDraft);
    const footerHasDraft = Boolean(footer?.isDraft);
    const draftCount = (primaryHasDraft ? 1 : 0) + (footerHasDraft ? 1 : 0);
    return { primaryHasDraft, footerHasDraft, draftCount };
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
      this.activeWebsiteId = '';
      this.state = { status: 'uninitialized' };
      this.notify();
      return;
    }

    this.activeWebsiteId = websiteId;
    this.activeMenuScope = menuScope;
    const currentGeneration = ++this.requestGeneration;
    const opWebsiteId = websiteId;
    const opMenuScope = menuScope;

    this.state = { status: 'loading', websiteId, menuScope };
    this.notify();

    const res = await this.repo.getEffectiveNavigation(websiteId, menuScope);

    // Cancel out-of-order responses if user switched websites, scopes, or triggered a new request
    if (
      this.requestGeneration !== currentGeneration ||
      this.activeWebsiteId !== opWebsiteId ||
      this.activeMenuScope !== opMenuScope
    ) {
      return;
    }

    if (!res.success) {
      this.state = {
        status: 'error',
        websiteId,
        menuScope,
        error: res.error,
        code: res.code
      };
      this.notify();
      return;
    }

    // Fail-closed live baseline loading
    let liveItems: SiteNavigationItem[] = [];
    if (res.data.is_draft) {
      if (res.data.live_revision > 0) {
        const liveRes = await this.repo.getLiveNavigation(websiteId, menuScope);
        if (
          this.requestGeneration !== currentGeneration ||
          this.activeWebsiteId !== opWebsiteId ||
          this.activeMenuScope !== opMenuScope
        ) {
          return;
        }

        if (!liveRes.success) {
          this.state = {
            status: 'error',
            websiteId,
            menuScope,
            error: `Failed to load live navigation baseline: ${liveRes.error}`,
            code: liveRes.code
          };
          this.notify();
          return;
        }

        if (!liveRes.data) {
          this.state = {
            status: 'error',
            websiteId,
            menuScope,
            error: 'Live navigation snapshot consistency error: missing live record while live revision > 0.',
            code: 'CONSISTENCY_ERROR'
          };
          this.notify();
          return;
        }

        if (liveRes.data.revision !== res.data.live_revision) {
          this.state = {
            status: 'error',
            websiteId,
            menuScope,
            error: 'Live navigation revision mismatch. Please reload the latest navigation.',
            code: 'CONFLICT'
          };
          this.notify();
          return;
        }

        liveItems = liveRes.data.items;
      } else {
        liveItems = [];
      }
    } else {
      liveItems = res.data.raw_items;
    }

    if (
      this.requestGeneration !== currentGeneration ||
      this.activeWebsiteId !== opWebsiteId ||
      this.activeMenuScope !== opMenuScope
    ) {
      return;
    }

    const resolved = resolveEffectiveNavigation(res.data.raw_items, context);

    const readyState: SiteNavigationReadyState = {
      status: 'ready',
      websiteId,
      menuScope,
      items: resolved,
      rawItems: res.data.raw_items,
      liveItems,
      isDraft: res.data.is_draft,
      baseRevision: res.data.base_revision,
      draftRevision: res.data.draft_revision,
      liveRevision: res.data.live_revision,
      isSaving: false,
      isConflict: false,
      errorMessage: null
    };

    this.scopeCache.set(`${websiteId}:${menuScope}`, readyState);
    this.state = readyState;
    this.notify();
  }

  public async stageDraft(
    proposedItems: SiteNavigationItem[],
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<{ success: boolean; error?: string; code?: string }> {
    if (this.state.status !== 'ready') {
      return { success: false, error: 'Controller not in ready state' };
    }

    const { websiteId, menuScope, baseRevision, draftRevision, liveRevision, liveItems } = this.state;
    const currentGeneration = ++this.requestGeneration;
    const opWebsiteId = websiteId;
    const opMenuScope = menuScope;

    // Validate and normalize contiguous positions in TypeScript domain before sending
    const norm = validateAndNormalizeNavigationItems(proposedItems);
    if (!norm.valid) {
      this.state = {
        ...this.state,
        isSaving: false,
        errorMessage: norm.error ?? null
      };
      this.notify();
      return { success: false, error: norm.error ?? 'Validation failed' };
    }

    this.state = {
      ...this.state,
      isSaving: true,
      isConflict: false,
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

    const isCurrent =
      this.requestGeneration === currentGeneration &&
      this.activeWebsiteId === opWebsiteId &&
      this.activeMenuScope === opMenuScope;

    if (!res.success) {
      const isConflict = res.code === 'CONFLICT';
      if (isCurrent && this.state.status === 'ready') {
        this.state = {
          ...this.state,
          isSaving: false,
          isConflict,
          errorMessage: res.error
        };
        this.notify();
      }
      return { success: false, error: res.error, code: res.code };
    }

    const resolved = resolveEffectiveNavigation(norm.items, context);

    const updatedReadyState: SiteNavigationReadyState = {
      status: 'ready',
      websiteId: opWebsiteId,
      menuScope: opMenuScope,
      items: resolved,
      rawItems: norm.items,
      liveItems,
      isDraft: res.data.is_draft,
      baseRevision: res.data.base_revision,
      draftRevision: res.data.draft_revision,
      liveRevision,
      isSaving: false,
      isConflict: false,
      errorMessage: null
    };

    this.scopeCache.set(`${opWebsiteId}:${opMenuScope}`, updatedReadyState);

    if (isCurrent && this.state.status === 'ready') {
      this.state = updatedReadyState;
      this.notify();
    }

    return { success: true };
  }

  public async revertDraft(
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<{ success: boolean; error?: string; code?: string }> {
    if (this.state.status !== 'ready') {
      return { success: false, error: 'Controller not in ready state' };
    }

    const { websiteId, menuScope, draftRevision } = this.state;
    const currentGeneration = ++this.requestGeneration;
    const opWebsiteId = websiteId;
    const opMenuScope = menuScope;

    this.state = {
      ...this.state,
      isSaving: true,
      isConflict: false,
      errorMessage: null
    };
    this.notify();

    const res = await this.repo.revertNavigationDraft(websiteId, draftRevision, menuScope);

    const isCurrent =
      this.requestGeneration === currentGeneration &&
      this.activeWebsiteId === opWebsiteId &&
      this.activeMenuScope === opMenuScope;

    if (!res.success) {
      const isConflict = res.code === 'CONFLICT';
      if (isCurrent && this.state.status === 'ready') {
        this.state = {
          ...this.state,
          isSaving: false,
          isConflict,
          errorMessage: res.error
        };
        this.notify();
      }
      return { success: false, error: res.error, code: res.code };
    }

    const resolved = resolveEffectiveNavigation(res.data.raw_items, context);

    const updatedReadyState: SiteNavigationReadyState = {
      status: 'ready',
      websiteId: opWebsiteId,
      menuScope: opMenuScope,
      items: resolved,
      rawItems: res.data.raw_items,
      liveItems: res.data.raw_items,
      isDraft: res.data.is_draft,
      baseRevision: res.data.base_revision,
      draftRevision: res.data.draft_revision,
      liveRevision: res.data.live_revision,
      isSaving: false,
      isConflict: false,
      errorMessage: null
    };

    this.scopeCache.set(`${opWebsiteId}:${opMenuScope}`, updatedReadyState);

    if (isCurrent && this.state.status === 'ready') {
      this.state = updatedReadyState;
      this.notify();
    }

    return { success: true };
  }

  /**
   * Safe post-publish refresh that refreshes the published scope without switching active menu scope or website.
   */
  public async refreshScopeAfterPublish(
    websiteId: string,
    menuScope: NavigationMenuScope,
    publishedItems: SiteNavigationItem[],
    liveRevision: number,
    context: {
      effectiveRoutes: readonly EffectiveRoute[];
      homepageFunnelId?: string | null;
    }
  ): Promise<void> {
    const resolved = resolveEffectiveNavigation(publishedItems, context);

    const updatedReadyState: SiteNavigationReadyState = {
      status: 'ready',
      websiteId,
      menuScope,
      items: resolved,
      rawItems: publishedItems,
      liveItems: publishedItems,
      isDraft: false,
      baseRevision: liveRevision,
      draftRevision: 0,
      liveRevision,
      isSaving: false,
      isConflict: false,
      errorMessage: null
    };

    this.scopeCache.set(`${websiteId}:${menuScope}`, updatedReadyState);

    // Only update visible active state if user is STILL viewing this exact website and scope
    if (this.activeWebsiteId === websiteId && this.activeMenuScope === menuScope && this.state.status === 'ready') {
      this.state = updatedReadyState;
      this.notify();
    }
  }
}
