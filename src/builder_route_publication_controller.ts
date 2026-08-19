/**
 * Builder Route Publication Controller (Phase 1B / Task 5B)
 *
 * Responsibilities:
 * - Coordinates atomic promotion of staged route drafts to live website routes
 * - Manages publish operation lifecycle (idle, publishing, success, error, conflict)
 * - Safe against stale operations and unhandled transport rejections
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RouteOperationResultCode } from './builder_route_lifecycle';
import { publishBuilderRoutes } from './builder_route_repository';

export interface RoutePublicationState {
  status: 'idle' | 'publishing' | 'success' | 'error' | 'conflict';
  publishedCount: number;
  code: RouteOperationResultCode | null;
  errorMessage: string | null;
  lastPublishedAt: string | null;
}

export interface PublishRouteOptions {
  actingUserId?: string;
  expectedDraftCount?: number;
  expectedDraftIds?: string[];
  client?: SupabaseClient;
}

export class BuilderRoutePublicationController {
  private state: RoutePublicationState = {
    status: 'idle',
    publishedCount: 0,
    code: null,
    errorMessage: null,
    lastPublishedAt: null
  };

  private listeners = new Set<(state: RoutePublicationState) => void>();
  private activeOperationId = 0;

  getState(): RoutePublicationState {
    return { ...this.state };
  }

  subscribe(listener: (state: RoutePublicationState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(next: Partial<RoutePublicationState>): void {
    this.state = { ...this.state, ...next };
    const current = this.getState();
    this.listeners.forEach(fn => fn(current));
  }

  reset(): void {
    this.setState({
      status: 'idle',
      publishedCount: 0,
      code: null,
      errorMessage: null
    });
  }

  async publish(websiteId: string, options: PublishRouteOptions = {}): Promise<RoutePublicationState> {
    const opId = ++this.activeOperationId;
    this.setState({
      status: 'publishing',
      code: null,
      errorMessage: null
    });

    try {
      const result = await publishBuilderRoutes(
        {
          websiteId,
          expectedDraftCount: options.expectedDraftCount,
          expectedDraftIds: options.expectedDraftIds
        },
        options.actingUserId,
        options.client
      );

      // Protect against race from newer operation
      if (opId !== this.activeOperationId) {
        return this.getState();
      }

      if (result.success) {
        this.setState({
          status: 'success',
          publishedCount: result.data?.published_count ?? 0,
          code: result.code,
          errorMessage: null,
          lastPublishedAt: new Date().toISOString()
        });
      } else {
        const isConflict = result.code === 'CONFLICT' || result.code === 'COLLISION';
        this.setState({
          status: isConflict ? 'conflict' : 'error',
          code: result.code,
          errorMessage: result.error ?? 'Failed to publish route drafts.'
        });
      }
    } catch (err: any) {
      if (opId !== this.activeOperationId) {
        return this.getState();
      }
      this.setState({
        status: 'error',
        code: 'AMBIGUOUS',
        errorMessage: err?.message || 'An unexpected error occurred while publishing routes.'
      });
    }

    return this.getState();
  }
}
