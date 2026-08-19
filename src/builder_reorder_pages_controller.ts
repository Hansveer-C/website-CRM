import type { Page } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBuilderNavigationTarget } from './builder_navigation';
import { PagesRepo } from './pages_repo_supabase';

export interface BuilderReorderPagesContext {
  actingUserId?: string;
  websiteId?: string;
  pages: readonly Page[];
  client?: SupabaseClient;
  onPagesReordered?: (pages: Page[]) => void;
  onConflict?: () => void;
}

/**
 * Overlay the supplied controller context with browser identity/navigation authority.
 * This is deliberately resolved for every controller context read so stale async
 * completion safety does not depend on the caller reconstructing the controller.
 */
export function resolveBuilderReorderLiveContext(
  context: BuilderReorderPagesContext
): BuilderReorderPagesContext {
  if (typeof window === 'undefined') return context;

  let actingUserId = context.actingUserId;
  let websiteId = context.websiteId;

  if (Object.prototype.hasOwnProperty.call(window, 'currentUser')) {
    actingUserId = typeof window.currentUser === 'string'
      ? window.currentUser.trim()
      : undefined;
  }

  const parsedNavigation = parseBuilderNavigationTarget(window.location?.hash ?? '');
  if (parsedNavigation.status === 'valid') {
    websiteId = parsedNavigation.target.websiteId;
  }

  return {
    ...context,
    actingUserId,
    websiteId
  };
}

export type BuilderReorderStatus = 'idle' | 'reordering' | 'error' | 'success';

export class BuilderReorderPagesController {
  private _status: BuilderReorderStatus = 'idle';
  private _error?: string;
  private _reorderingPageId?: string;
  private _reorderingDirection?: 'up' | 'down';
  private _activeRequestId = 0;

  constructor(private readonly getContext: () => BuilderReorderPagesContext) {}

  private getLiveContext(): BuilderReorderPagesContext {
    return resolveBuilderReorderLiveContext(this.getContext());
  }

  get status(): BuilderReorderStatus {
    return this._status;
  }

  get isReordering(): boolean {
    return this._status === 'reordering';
  }

  get error(): string | undefined {
    return this._error;
  }

  get reorderingPageId(): string | undefined {
    return this._reorderingPageId;
  }

  get reorderingDirection(): 'up' | 'down' | undefined {
    return this._reorderingDirection;
  }

  clearError(): void {
    if (this._status === 'error') {
      this._status = 'idle';
      this._error = undefined;
    }
  }

  async movePageUp(pageId: string): Promise<boolean> {
    return this._movePage(pageId, 'up');
  }

  async movePageDown(pageId: string): Promise<boolean> {
    return this._movePage(pageId, 'down');
  }

  private async _movePage(pageId: string, direction: 'up' | 'down'): Promise<boolean> {
    if (this.isReordering) {
      return false;
    }

    const context = this.getLiveContext();
    const { actingUserId, websiteId, pages, client, onPagesReordered, onConflict } = context;

    if (!actingUserId) {
      this._status = 'error';
      this._error = 'Authentication required';
      return false;
    }

    const targetPage = pages.find(p => p.id === pageId);
    if (!targetPage || !targetPage.funnel_id) {
      this._status = 'error';
      this._error = 'Page not found';
      return false;
    }

    const funnelId = targetPage.funnel_id;
    const funnelPages = pages
      .filter(p => p.user_id === targetPage.user_id && p.funnel_id === funnelId)
      .slice()
      .sort((a, b) => {
        const orderA = typeof a.step_order === 'number' && Number.isFinite(a.step_order) ? a.step_order : Number.POSITIVE_INFINITY;
        const orderB = typeof b.step_order === 'number' && Number.isFinite(b.step_order) ? b.step_order : Number.POSITIVE_INFINITY;
        if (orderA !== orderB) return orderA - orderB;
        const createdComp = (a.created_at || '').localeCompare(b.created_at || '');
        if (createdComp !== 0) return createdComp;
        return a.id.localeCompare(b.id);
      });

    const currentIndex = funnelPages.findIndex(p => p.id === pageId);
    if (currentIndex === -1) {
      this._status = 'error';
      this._error = 'Page not found in destination';
      return false;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= funnelPages.length) {
      // First page cannot move up, last page cannot move down (no-op)
      return false;
    }

    const expectedPageIds = funnelPages.map(p => p.id);
    const reorderedFunnelPages = [...funnelPages];
    const [moved] = reorderedFunnelPages.splice(currentIndex, 1);
    reorderedFunnelPages.splice(targetIndex, 0, moved);
    const orderedPageIds = reorderedFunnelPages.map(p => p.id);

    const requestId = ++this._activeRequestId;
    this._status = 'reordering';
    this._error = undefined;
    this._reorderingPageId = pageId;
    this._reorderingDirection = direction;

    try {
      const result = await PagesRepo.reorderPages(
        funnelId,
        orderedPageIds,
        expectedPageIds,
        actingUserId,
        client
      );

      // Stale async guard: re-resolve live user/Website authority at completion.
      const currentContext = this.getLiveContext();
      if (
        requestId !== this._activeRequestId ||
        currentContext.actingUserId !== actingUserId ||
        currentContext.websiteId !== websiteId
      ) {
        return false;
      }

      if (!result.success) {
        this._status = 'error';
        if (result.code === 'CONFLICT') {
          this._error = 'The page order changed elsewhere. Reload and try again.';
          if (onConflict) onConflict();
        } else if (result.code === 'AMBIGUOUS') {
          this._error = 'The reorder result is uncertain. Please reload to check.';
        } else {
          this._error = result.error || 'Failed to reorder pages';
        }
        return false;
      }

      this._status = 'success';
      this._error = undefined;
      if (result.data?.pages && onPagesReordered) {
        onPagesReordered(result.data.pages);
      }
      return true;
    } catch {
      const currentContext = this.getLiveContext();
      if (
        requestId !== this._activeRequestId ||
        currentContext.actingUserId !== actingUserId ||
        currentContext.websiteId !== websiteId
      ) {
        return false;
      }
      this._status = 'error';
      this._error = 'The reorder result is uncertain. Please reload to check.';
      return false;
    } finally {
      if (this._activeRequestId === requestId) {
        this._reorderingPageId = undefined;
        this._reorderingDirection = undefined;
      }
    }
  }
}
