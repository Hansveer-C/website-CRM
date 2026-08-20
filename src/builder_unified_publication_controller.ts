import type {
  WebsitePublishPlan,
  WebsitePublishResult
} from './builder_unified_publication';
import type {
  BuilderUnifiedPublicationRepository,
  UnifiedPublicationErrorCode
} from './builder_unified_publication_repository';

export type UnifiedPublishStatus =
  | 'idle'
  | 'loading_plan'
  | 'ready'
  | 'blocked'
  | 'no_changes'
  | 'publishing'
  | 'success'
  | 'conflict'
  | 'error';

export interface UnifiedPublishState {
  status: UnifiedPublishStatus;
  websiteId: string | null;
  plan: WebsitePublishPlan | null;
  result: WebsitePublishResult | null;
  errorMessage: string | null;
  errorCode: UnifiedPublicationErrorCode | null;
  isOpen: boolean;
}

export type UnifiedPublishListener = (state: UnifiedPublishState) => void;

export class BuilderUnifiedPublicationController {
  private state: UnifiedPublishState = {
    status: 'idle',
    websiteId: null,
    plan: null,
    result: null,
    errorMessage: null,
    errorCode: null,
    isOpen: false
  };

  private listeners: Set<UnifiedPublishListener> = new Set();
  private inFlightPublish = false;

  constructor(private repo: BuilderUnifiedPublicationRepository) {}

  getState(): UnifiedPublishState {
    return { ...this.state };
  }

  subscribe(listener: UnifiedPublishListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((l) => l(snapshot));
  }

  openModal(websiteId: string): void {
    this.state = {
      ...this.state,
      isOpen: true,
      websiteId,
      status: 'loading_plan',
      errorMessage: null,
      errorCode: null,
      result: null
    };
    this.notify();
    void this.loadPlan(websiteId);
  }

  closeModal(): void {
    this.state = {
      ...this.state,
      isOpen: false,
      status: 'idle',
      errorMessage: null,
      errorCode: null
    };
    this.notify();
  }

  async loadPlan(websiteId: string): Promise<void> {
    this.state.status = 'loading_plan';
    this.state.websiteId = websiteId;
    this.state.errorMessage = null;
    this.state.errorCode = null;
    this.notify();

    const res = await this.repo.getPublishPlan(websiteId);

    // Cross-website async safety check
    if (this.state.websiteId !== websiteId) {
      return;
    }

    if (!res.success) {
      if (res.code === 'CONFLICT') {
        this.state = {
          ...this.state,
          status: 'conflict',
          errorMessage: res.error,
          errorCode: res.code
        };
      } else {
        this.state = {
          ...this.state,
          status: 'error',
          errorMessage: res.error,
          errorCode: res.code
        };
      }
      this.notify();
      return;
    }

    const plan = res.data;
    if (!plan.has_pending_changes) {
      this.state = {
        ...this.state,
        status: 'no_changes',
        plan,
        errorMessage: null,
        errorCode: null
      };
    } else if (plan.blockers.length > 0 || !plan.is_publishable) {
      this.state = {
        ...this.state,
        status: 'blocked',
        plan,
        errorMessage: null,
        errorCode: null
      };
    } else {
      this.state = {
        ...this.state,
        status: 'ready',
        plan,
        errorMessage: null,
        errorCode: null
      };
    }
    this.notify();
  }

  async publish(): Promise<WebsitePublishResult | null> {
    if (this.inFlightPublish) {
      return null;
    }

    if (!this.state.websiteId || !this.state.plan) {
      this.state = {
        ...this.state,
        status: 'error',
        errorMessage: 'Cannot publish without an active website plan',
        errorCode: 'INVALID_INPUT'
      };
      this.notify();
      return null;
    }

    if (this.state.status === 'blocked' || !this.state.plan.is_publishable) {
      return null;
    }

    const targetWebsiteId = this.state.websiteId;
    const expectedState = this.state.plan.expected_state;

    this.inFlightPublish = true;
    this.state = {
      ...this.state,
      status: 'publishing',
      errorMessage: null,
      errorCode: null
    };
    this.notify();

    try {
      const res = await this.repo.publishWebsite(targetWebsiteId, expectedState);

      // Cross-website async safety check
      if (this.state.websiteId !== targetWebsiteId) {
        return null;
      }

      if (!res.success) {
        if (res.code === 'CONFLICT') {
          this.state = {
            ...this.state,
            status: 'conflict',
            errorMessage: res.error,
            errorCode: res.code
          };
        } else {
          this.state = {
            ...this.state,
            status: 'error',
            errorMessage: res.error,
            errorCode: res.code
          };
        }
        this.notify();
        return null;
      }

      const result = res.data;
      this.state = {
        ...this.state,
        status: 'success',
        result,
        errorMessage: null,
        errorCode: null
      };
      this.notify();
      return result;
    } finally {
      this.inFlightPublish = false;
    }
  }
}
