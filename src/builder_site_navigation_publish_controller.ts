import {
  BuilderSiteNavigationRepository,
  SiteNavigationRepositoryResult
} from './builder_site_navigation_repository';
import {
  NavigationMenuScope,
  SiteNavigationItem
} from './builder_site_navigation_domain';

export type NavigationPublishStatus = 'idle' | 'publishing' | 'published' | 'error';

export interface NavigationPublishState {
  status: NavigationPublishStatus;
  error: string | null;
  conflictDetected: boolean;
  lastPublishedRevision: number | null;
  publishedItems: SiteNavigationItem[] | null;
}

export class BuilderSiteNavigationPublishController {
  private state: NavigationPublishState = {
    status: 'idle',
    error: null,
    conflictDetected: false,
    lastPublishedRevision: null,
    publishedItems: null
  };

  private listeners: Array<(state: NavigationPublishState) => void> = [];

  constructor(private repo: BuilderSiteNavigationRepository) {}

  public getState(): NavigationPublishState {
    return { ...this.state };
  }

  public subscribe(listener: (state: NavigationPublishState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const current = this.getState();
    for (const listener of this.listeners) {
      listener(current);
    }
  }

  public reset() {
    this.state = {
      status: 'idle',
      error: null,
      conflictDetected: false,
      lastPublishedRevision: null,
      publishedItems: null
    };
    this.notify();
  }

  public async publish(
    websiteId: string,
    expectedBaseRevision: number,
    expectedDraftRevision: number,
    menuScope: NavigationMenuScope = 'primary'
  ): Promise<SiteNavigationRepositoryResult<{ is_draft: false; live_revision: number; items: SiteNavigationItem[] }>> {
    if (this.state.status === 'publishing') {
      return {
        success: false,
        error: 'A navigation publication is already in progress',
        code: 'INVALID_INPUT'
      };
    }

    this.state = {
      ...this.state,
      status: 'publishing',
      error: null,
      conflictDetected: false
    };
    this.notify();

    try {
      const res = await this.repo.publishNavigation(
        websiteId,
        expectedBaseRevision,
        expectedDraftRevision,
        menuScope
      );

      if (!res.success) {
        const isConflict = res.code === 'CONFLICT';
        this.state = {
          ...this.state,
          status: 'error',
          error: res.error,
          conflictDetected: isConflict
        };
        this.notify();
        return res;
      }

      this.state = {
        status: 'published',
        error: null,
        conflictDetected: false,
        lastPublishedRevision: res.data.live_revision,
        publishedItems: [...res.data.items]
      };
      this.notify();

      return res;
    } catch (err: any) {
      const msg = err?.message || String(err);
      this.state = {
        ...this.state,
        status: 'error',
        error: msg,
        conflictDetected: false
      };
      this.notify();
      return { success: false, error: msg, code: 'TRANSPORT_ERROR' };
    }
  }
}
