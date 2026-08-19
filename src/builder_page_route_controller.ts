import type { Page, Website } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getBuilderEffectiveRoutes,
  setBuilderRouteDraft,
  deleteBuilderRouteDraft,
  revertBuilderRouteDraft
} from './builder_route_repository';
import type { EffectiveRoute } from './builder_route_lifecycle';
import {
  BuilderRoutePublicationController,
  type RoutePublicationState
} from './builder_route_publication_controller';
import {
  createPageRouteViewModel,
  mapRouteErrorCodeToMessage,
  validatePageRouteInput,
  type PageRouteViewModel
} from './builder_page_route_model';

export interface BuilderPageRouteState {
  websiteId: string | null;
  effectiveRoutes: readonly EffectiveRoute[];
  isLoading: boolean;
  loadError: string | null;

  isEditing: boolean;
  editingPageId: string | null;
  editingInputPath: string;
  normalizedEditingPath: string;
  editingValidationIssue: string | null;
  isStaging: boolean;
  stagingError: string | null;

  isConfirmingDelete: boolean;
  deletingPageId: string | null;

  isConfirmingPublish: boolean;
  publicationState: RoutePublicationState;
}

export interface BuilderPageRouteControllerOptions {
  actingUserId?: string;
  client?: SupabaseClient;
  publicationController?: BuilderRoutePublicationController;
}

export class BuilderPageRouteController {
  private state: BuilderPageRouteState = {
    websiteId: null,
    effectiveRoutes: [],
    isLoading: false,
    loadError: null,

    isEditing: false,
    editingPageId: null,
    editingInputPath: '',
    normalizedEditingPath: '',
    editingValidationIssue: null,
    isStaging: false,
    stagingError: null,

    isConfirmingDelete: false,
    deletingPageId: null,

    isConfirmingPublish: false,
    publicationState: {
      status: 'idle',
      publishedCount: 0,
      code: null,
      errorMessage: null,
      lastPublishedAt: null
    }
  };

  private listeners = new Set<(state: BuilderPageRouteState) => void>();
  private requestGeneration = 0;
  private actingUserId?: string;
  private client?: SupabaseClient;
  readonly publicationController: BuilderRoutePublicationController;

  constructor(options: BuilderPageRouteControllerOptions = {}) {
    this.actingUserId = options.actingUserId;
    this.client = options.client;
    this.publicationController = options.publicationController ?? new BuilderRoutePublicationController();

    this.publicationController.subscribe(pubState => {
      this.setState({ publicationState: pubState });
    });
  }

  setClient(client?: SupabaseClient): void {
    this.client = client;
  }

  setActingUserId(userId?: string): void {
    this.actingUserId = userId;
  }

  getState(): BuilderPageRouteState {
    return { ...this.state };
  }

  subscribe(listener: (state: BuilderPageRouteState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(next: Partial<BuilderPageRouteState>): void {
    this.state = { ...this.state, ...next };
    const current = this.getState();
    this.listeners.forEach(fn => fn(current));
  }

  async hydrate(websiteId: string): Promise<boolean> {
    if (!websiteId) return false;
    const generation = ++this.requestGeneration;
    this.setState({
      websiteId,
      isLoading: true,
      loadError: null
    });

    try {
      const result = await getBuilderEffectiveRoutes(websiteId, this.actingUserId, this.client);
      if (generation !== this.requestGeneration) return false;

      if (!result.success || !result.data || !Array.isArray(result.data.routes)) {
        this.setState({
          isLoading: false,
          loadError: result.error || 'Failed to load website routes'
        });
        return false;
      }

      this.setState({
        effectiveRoutes: result.data.routes,
        isLoading: false,
        loadError: null
      });
      return true;
    } catch (err: any) {
      if (generation !== this.requestGeneration) return false;
      this.setState({
        isLoading: false,
        loadError: err?.message || 'Failed to load website routes'
      });
      return false;
    }
  }

  getPageRoute(
    page: Page,
    website: Website,
    options: { isHomepage?: boolean; isLiveHomepage?: boolean; isDraftHomepage?: boolean } = {}
  ): PageRouteViewModel {
    return createPageRouteViewModel({
      page,
      website,
      effectiveRoutes: this.state.effectiveRoutes,
      isHomepage: options.isHomepage,
      isLiveHomepage: options.isLiveHomepage,
      isDraftHomepage: options.isDraftHomepage
    });
  }

  getPendingDrafts(): EffectiveRoute[] {
    return this.state.effectiveRoutes.filter(
      r => r.is_draft_override || r.is_staged_delete || r.is_new_draft
    );
  }

  getPendingDraftCount(): number {
    return this.getPendingDrafts().length;
  }

  openEditor(page: Page, website: Website, isHomepage = false): boolean {
    if (isHomepage) return false;
    const currentRoute = this.getPageRoute(page, website, { isHomepage });
    const initialPath = currentRoute.effectivePath === '/' ? '' : currentRoute.effectivePath;

    this.setState({
      isEditing: true,
      editingPageId: page.id,
      editingInputPath: initialPath,
      normalizedEditingPath: initialPath,
      editingValidationIssue: null,
      stagingError: null
    });
    return true;
  }

  updateEditorInput(rawPath: string, website: Website): void {
    const otherPaths = this.state.effectiveRoutes
      .filter(r => r.website_id === website.id)
      .map(r => r.path);

    const validation = validatePageRouteInput(rawPath, otherPaths);
    this.setState({
      editingInputPath: rawPath,
      normalizedEditingPath: validation.normalizedPath,
      editingValidationIssue: validation.valid ? null : validation.error ?? 'Invalid URL path'
    });
  }

  closeEditor(): void {
    this.setState({
      isEditing: false,
      editingPageId: null,
      editingInputPath: '',
      normalizedEditingPath: '',
      editingValidationIssue: null,
      stagingError: null
    });
  }

  async saveEditorRoute(page: Page, website: Website): Promise<boolean> {
    if (!this.state.isEditing || this.state.editingPageId !== page.id) return false;
    if (this.state.isStaging) return false;

    const otherPaths = this.state.effectiveRoutes
      .filter(r => r.website_id === website.id)
      .map(r => r.path);

    const route = this.getPageRoute(page, website);
    const validation = validatePageRouteInput(this.state.editingInputPath, otherPaths, route.currentLivePath);

    if (!validation.valid) {
      this.setState({
        editingValidationIssue: validation.error ?? 'Invalid URL path'
      });
      return false;
    }

    const targetPath = validation.normalizedPath;
    this.setState({ isStaging: true, stagingError: null });

    try {
      const result = await setBuilderRouteDraft(
        {
          websiteId: website.id,
          funnelId: page.funnel_id ?? '',
          path: targetPath,
          routeId: route.liveRouteId ?? undefined
        },
        this.actingUserId,
        this.client
      );

      if (!result.success) {
        this.setState({
          isStaging: false,
          stagingError: mapRouteErrorCodeToMessage(result.code, result.error)
        });
        return false;
      }

      await this.hydrate(website.id);
      this.closeEditor();
      return true;
    } catch (err: any) {
      this.setState({
        isStaging: false,
        stagingError: err?.message || 'Failed to save URL draft'
      });
      return false;
    }
  }

  promptDeleteRoute(pageId: string): void {
    this.setState({
      isConfirmingDelete: true,
      deletingPageId: pageId
    });
  }

  cancelDeleteRoute(): void {
    this.setState({
      isConfirmingDelete: false,
      deletingPageId: null
    });
  }

  async confirmDeleteRoute(page: Page, website: Website): Promise<boolean> {
    const route = this.getPageRoute(page, website);
    if (!route.liveRouteId) return false;

    this.setState({ isStaging: true, stagingError: null });
    try {
      const result = await deleteBuilderRouteDraft(
        {
          websiteId: website.id,
          routeId: route.liveRouteId
        },
        this.actingUserId,
        this.client
      );

      if (!result.success) {
        this.setState({
          isStaging: false,
          stagingError: mapRouteErrorCodeToMessage(result.code, result.error)
        });
        return false;
      }

      await this.hydrate(website.id);
      this.cancelDeleteRoute();
      this.setState({ isStaging: false });
      return true;
    } catch (err: any) {
      this.setState({
        isStaging: false,
        stagingError: err?.message || 'Failed to stage route removal'
      });
      return false;
    }
  }

  async revertRoute(page: Page, website: Website): Promise<boolean> {
    const route = this.getPageRoute(page, website);
    this.setState({ isStaging: true, stagingError: null });

    try {
      const result = await revertBuilderRouteDraft(
        {
          websiteId: website.id,
          routeId: route.liveRouteId ?? undefined,
          funnelId: page.funnel_id ?? undefined
        },
        this.actingUserId,
        this.client
      );

      if (!result.success) {
        this.setState({
          isStaging: false,
          stagingError: mapRouteErrorCodeToMessage(result.code, result.error)
        });
        return false;
      }

      await this.hydrate(website.id);
      this.setState({ isStaging: false });
      return true;
    } catch (err: any) {
      this.setState({
        isStaging: false,
        stagingError: err?.message || 'Failed to revert route draft'
      });
      return false;
    }
  }

  openPublishModal(): void {
    this.publicationController.reset();
    this.setState({ isConfirmingPublish: true });
  }

  closePublishModal(): void {
    this.setState({ isConfirmingPublish: false });
  }

  async publishPendingRoutes(websiteId: string): Promise<boolean> {
    const pendingDrafts = this.getPendingDrafts();
    if (pendingDrafts.length === 0) {
      this.closePublishModal();
      return true;
    }

    const expectedDraftCount = pendingDrafts.length;
    const expectedDraftIds = pendingDrafts
      .map(d => d.draft_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const result = await this.publicationController.publish(websiteId, {
      actingUserId: this.actingUserId,
      expectedDraftCount,
      expectedDraftIds: expectedDraftIds.length === expectedDraftCount ? expectedDraftIds : undefined,
      client: this.client
    });

    if (result.status === 'success') {
      await this.hydrate(websiteId);
      this.closePublishModal();
      return true;
    }

    return false;
  }
}
