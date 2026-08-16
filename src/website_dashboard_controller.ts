import type { Funnel, Page, Website, WebsiteRoute } from './types';
import {
  createWebsiteDashboardModel,
  resolveActiveWebsite,
  type ActiveWebsiteResolution,
  type WebsiteDashboardModel,
  type WebsiteDashboardSummaryInput
} from './website_dashboard_model';

export interface WebsiteDashboardCoreData {
  websites: readonly Website[];
  routes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
}

export interface WebsiteDashboardLoadRequest {
  actingUserId: string;
  explicitWebsiteId?: string | null;
  explicitPageId?: string | null;
  previousWebsiteId?: string | null;
}

export interface WebsiteDashboardDependencies {
  loadCore(request: WebsiteDashboardLoadRequest): Promise<WebsiteDashboardCoreData>;
  loadSummary?(input: {
    actingUserId: string;
    website: Website;
    model: WebsiteDashboardModel;
  }): Promise<WebsiteDashboardSummaryInput>;
}

export type WebsiteDashboardControllerState =
  | { status: 'idle' }
  | { status: 'loading'; request: WebsiteDashboardLoadRequest }
  | { status: 'selection-required' | 'empty' | 'unavailable'; resolution: ActiveWebsiteResolution }
  | { status: 'error'; reason: 'repository-failure' }
  | { status: 'ready' | 'partial'; model: WebsiteDashboardModel; websites: readonly Website[]; warning?: string };

export class WebsiteDashboardController {
  state: WebsiteDashboardControllerState = { status: 'idle' };
  private generation = 0;
  private pendingKey: string | null = null;
  private pending: Promise<WebsiteDashboardControllerState> | null = null;

  constructor(private readonly dependencies: WebsiteDashboardDependencies) {}

  load(request: WebsiteDashboardLoadRequest): Promise<WebsiteDashboardControllerState> {
    const key = JSON.stringify([
      request.actingUserId,
      request.explicitWebsiteId ?? null,
      request.explicitPageId ?? null,
      request.previousWebsiteId ?? null
    ]);
    if (this.pending && this.pendingKey === key) return this.pending;
    const generation = ++this.generation;
    this.pendingKey = key;
    this.state = { status: 'loading', request: { ...request } };
    this.pending = this.performLoad({ ...request }, generation).finally(() => {
      if (this.generation === generation) {
        this.pending = null;
        this.pendingKey = null;
      }
    });
    return this.pending;
  }

  invalidate(): void {
    this.generation += 1;
    this.pending = null;
    this.pendingKey = null;
    this.state = { status: 'idle' };
  }

  private async performLoad(request: WebsiteDashboardLoadRequest, generation: number): Promise<WebsiteDashboardControllerState> {
    try {
      const core = await this.dependencies.loadCore(request);
      if (generation !== this.generation) return this.state;
      const resolution = resolveActiveWebsite({
        actingUserId: request.actingUserId,
        websites: core.websites,
        explicitWebsiteId: request.explicitWebsiteId,
        previousWebsiteId: request.previousWebsiteId
      });
      if (resolution.status !== 'resolved') {
        this.state = { status: resolution.status, resolution };
        return this.state;
      }
      let model = createWebsiteDashboardModel({
        actingUserId: request.actingUserId,
        website: resolution.website,
        routes: core.routes,
        funnels: core.funnels,
        pages: core.pages,
        explicitPageId: request.explicitPageId
      });
      if (!this.dependencies.loadSummary) {
        this.state = { status: 'ready', model, websites: resolution.ownedWebsites };
        return this.state;
      }
      try {
        const summary = await this.dependencies.loadSummary({
          actingUserId: request.actingUserId,
          website: resolution.website,
          model
        });
        if (generation !== this.generation) return this.state;
        model = createWebsiteDashboardModel({
          actingUserId: request.actingUserId,
          website: resolution.website,
          routes: core.routes,
          funnels: core.funnels,
          pages: core.pages,
          explicitPageId: request.explicitPageId,
          summary
        });
        this.state = { status: 'ready', model, websites: resolution.ownedWebsites };
      } catch {
        if (generation !== this.generation) return this.state;
        model = createWebsiteDashboardModel({
          actingUserId: request.actingUserId,
          website: resolution.website,
          routes: core.routes,
          funnels: core.funnels,
          pages: core.pages,
          explicitPageId: request.explicitPageId,
          summary: { publicationState: 'unavailable' }
        });
        this.state = { status: 'partial', model, websites: resolution.ownedWebsites, warning: 'Some website information could not be loaded.' };
      }
      return this.state;
    } catch {
      if (generation !== this.generation) return this.state;
      this.state = { status: 'error', reason: 'repository-failure' };
      return this.state;
    }
  }
}
