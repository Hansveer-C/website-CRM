import type { Funnel, Website, WebsiteRoute } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBuilderNavigationTarget } from './builder_navigation';
import { setBuilderHomepage } from './builder_homepage_repository';

export interface BuilderSetHomepageContext {
  actingUserId?: string;
  website?: Website | null;
  funnels?: readonly Funnel[];
  websiteRoutes?: readonly WebsiteRoute[];
  client?: SupabaseClient;
  onHomepageSet?: (website: Website) => void;
  onConflict?: () => void;
}

/**
 * Overlay the supplied controller context with live browser identity/navigation authority.
 * This ensures stale async completions never mutate state across website or user switches.
 */
export function resolveBuilderHomepageLiveContext(
  context: BuilderSetHomepageContext
): BuilderSetHomepageContext {
  if (typeof window === 'undefined') return context;

  let actingUserId = context.actingUserId;
  let website = context.website;

  if (Object.prototype.hasOwnProperty.call(window, 'currentUser')) {
    actingUserId = typeof (window as any).currentUser === 'string'
      ? (window as any).currentUser.trim()
      : undefined;
  }

  const parsedNavigation = parseBuilderNavigationTarget(window.location?.hash ?? '');
  if (parsedNavigation.status === 'valid' && website && parsedNavigation.target.websiteId !== website.id) {
    // If navigation navigated away from the website
    website = null;
  }

  return {
    ...context,
    actingUserId,
    website
  };
}

export type BuilderSetHomepageStatus = 'idle' | 'updating' | 'error' | 'success';

export class BuilderSetHomepageController {
  private _status: BuilderSetHomepageStatus = 'idle';
  private _error?: string;
  private _updatingFunnelId?: string;
  private _activeRequestId = 0;

  constructor(private readonly getContext: () => BuilderSetHomepageContext) {}

  private getLiveContext(): BuilderSetHomepageContext {
    return resolveBuilderHomepageLiveContext(this.getContext());
  }

  get status(): BuilderSetHomepageStatus {
    return this._status;
  }

  get isUpdating(): boolean {
    return this._status === 'updating';
  }

  get error(): string | undefined {
    return this._error;
  }

  get updatingFunnelId(): string | undefined {
    return this._updatingFunnelId;
  }

  clearError(): void {
    if (this._status === 'error') {
      this._status = 'idle';
      this._error = undefined;
    }
  }

  async setHomepage(funnelId: string): Promise<boolean> {
    if (this.isUpdating) {
      return false;
    }

    const context = this.getLiveContext();
    const actingUserId = context.actingUserId?.trim();
    const website = context.website;
    const websiteId = website?.id;
    const client = context.client;
    const onHomepageSet = context.onHomepageSet;
    const onConflict = context.onConflict;

    if (!actingUserId || !website || !websiteId) {
      this._status = 'error';
      this._error = 'Website not found';
      return false;
    }

    if (!funnelId || funnelId.trim() === '') {
      this._status = 'error';
      this._error = 'Invalid destination';
      return false;
    }

    // If this funnel is already the current homepage, it is a no-op success
    const currentHomepage = website.homepage_funnel_id ?? null;
    if (currentHomepage === funnelId) {
      this._status = 'idle';
      this._error = undefined;
      return true;
    }

    const expectedHomepageFunnelId = currentHomepage;
    const requestId = ++this._activeRequestId;
    this._status = 'updating';
    this._error = undefined;
    this._updatingFunnelId = funnelId;

    try {
      const result = await setBuilderHomepage(
        websiteId,
        funnelId,
        expectedHomepageFunnelId,
        actingUserId,
        client
      );

      // Stale async guard: re-resolve live authority
      const currentContext = this.getLiveContext();
      if (
        requestId !== this._activeRequestId ||
        currentContext.actingUserId !== actingUserId ||
        currentContext.website?.id !== websiteId
      ) {
        return false;
      }

      this._updatingFunnelId = undefined;

      if (!result.success || !result.data) {
        this._status = 'error';
        if (result.code === 'CONFLICT') {
          this._error = 'The homepage changed elsewhere. Reload and try again.';
          if (onConflict) onConflict();
        } else if (result.code === 'AMBIGUOUS') {
          this._error = 'The homepage update result is uncertain. Please reload to check.';
        } else {
          this._error = result.error || 'Failed to update homepage';
        }
        return false;
      }

      this._status = 'success';
      this._error = undefined;
      if (onHomepageSet) {
        onHomepageSet(result.data.website);
      }
      return true;
    } catch {
      const currentContext = this.getLiveContext();
      if (
        requestId !== this._activeRequestId ||
        currentContext.actingUserId !== actingUserId ||
        currentContext.website?.id !== websiteId
      ) {
        return false;
      }

      this._updatingFunnelId = undefined;
      this._status = 'error';
      this._error = 'The homepage update result is uncertain. Please reload to check.';
      return false;
    }
  }
}
