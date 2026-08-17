import type { Funnel, Page, PageSection, Website, WebsiteRoute } from './types';

export type BuilderDeletePageStatus = 'idle' | 'confirming' | 'deleting' | 'error';

export interface BuilderDeletePageContext {
  actingUserId: string;
  website?: Website;
  websiteRoutes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
  activePageId?: string;
}

export interface BuilderDeletePagePersistRequest {
  pageId: string;
}

export interface BuilderDeletePagePersistResult {
  success: boolean;
  data?: {
    id: string;
    funnel_id?: string;
  };
  code?: 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'LAST_PAGE' | 'HOMEPAGE_BLOCKED' | 'CONFLICT' | 'UNAVAILABLE' | 'INVALID_RESPONSE' | 'AMBIGUOUS';
  error?: string;
}

export interface BuilderDeletePageOnDeletedMeta {
  shouldNavigate: boolean;
  replacementPageId?: string;
}

export interface BuilderDeletePageControllerOptions {
  getContext: () => BuilderDeletePageContext;
  persist: (request: BuilderDeletePagePersistRequest) => Promise<BuilderDeletePagePersistResult>;
  onDeleted: (deletedPageId: string, meta: BuilderDeletePageOnDeletedMeta) => void | Promise<void>;
}

export class BuilderDeletePageController {
  status: BuilderDeletePageStatus = 'idle';
  deletingPageId: string | null = null;
  confirmingPageId: string | null = null;
  message = '';
  private requestGeneration = 0;
  private readonly getContext: BuilderDeletePageControllerOptions['getContext'];
  private readonly persist: BuilderDeletePageControllerOptions['persist'];
  private readonly onDeleted: BuilderDeletePageControllerOptions['onDeleted'];

  constructor(options: BuilderDeletePageControllerOptions) {
    this.getContext = options.getContext;
    this.persist = options.persist;
    this.onDeleted = options.onDeleted;
  }

  get isDeleting(): boolean {
    return this.status === 'deleting';
  }

  get isConfirming(): boolean {
    return this.status === 'confirming';
  }

  promptDelete(pageId: string): boolean {
    if (this.isDeleting || !pageId.trim()) return false;
    const context = this.getContext();
    const page = context.pages.find(p => p.id === pageId && p.user_id === context.actingUserId);
    if (!page || !context.website || context.website.user_id !== context.actingUserId) {
      this.status = 'error';
      this.message = 'The page could not be found.';
      return false;
    }

    const funnelPages = context.pages.filter(p => p.user_id === context.actingUserId && p.funnel_id === page.funnel_id);
    if (funnelPages.length <= 1) {
      this.status = 'error';
      this.message = 'Cannot delete the only page in this website.';
      return false;
    }

    this.status = 'confirming';
    this.confirmingPageId = pageId;
    this.message = `Are you sure you want to delete "${page.name}"?`;
    return true;
  }

  cancelDelete(): void {
    if (this.isDeleting) return;
    this.status = 'idle';
    this.confirmingPageId = null;
    this.message = '';
  }

  async confirmDelete(): Promise<boolean> {
    if (this.status !== 'confirming' || !this.confirmingPageId) return false;
    const targetId = this.confirmingPageId;
    return this.executeDelete(targetId);
  }

  async delete(pageId: string): Promise<boolean> {
    if (this.isDeleting || !pageId.trim()) return false;
    if (!this.promptDelete(pageId)) return false;
    return this.confirmDelete();
  }

  private async executeDelete(pageId: string): Promise<boolean> {
    const initialContext = this.getContext();
    const targetPage = initialContext.pages.find(
      p => p.id === pageId && p.user_id === initialContext.actingUserId
    );

    if (!targetPage || !initialContext.website || initialContext.website.user_id !== initialContext.actingUserId) {
      this.status = 'error';
      this.confirmingPageId = null;
      this.message = 'The page could not be found.';
      return false;
    }

    const generation = ++this.requestGeneration;
    this.status = 'deleting';
    this.deletingPageId = pageId;
    this.confirmingPageId = null;
    this.message = `Deleting ${targetPage.name}…`;

    let result: BuilderDeletePagePersistResult;
    try {
      result = await this.persist({ pageId });
    } catch {
      result = { success: false, code: 'AMBIGUOUS' };
    }

    if (generation !== this.requestGeneration) return false;

    const currentContext = this.getContext();
    if (
      currentContext.actingUserId !== initialContext.actingUserId
      || currentContext.website?.id !== initialContext.website.id
    ) {
      this.status = 'error';
      this.deletingPageId = null;
      this.message = 'The page could not be deleted. Please try again.';
      return false;
    }

    if (!result.success) {
      this.status = 'error';
      this.deletingPageId = null;
      this.message = result.code === 'LAST_PAGE'
        ? 'Cannot delete the only page in this website.'
        : result.code === 'HOMEPAGE_BLOCKED'
          ? 'Cannot delete the designated homepage.'
          : result.code === 'AMBIGUOUS'
            ? 'The deletion result is uncertain. Please reload to check.'
            : 'The page could not be deleted. Please try again.';
      return false;
    }

    const shouldNavigate = currentContext.activePageId === pageId;
    let replacementPageId: string | undefined;

    if (shouldNavigate) {
      const remainingPages = currentContext.pages.filter(
        p => p.id !== pageId && p.user_id === currentContext.actingUserId && p.funnel_id === targetPage.funnel_id
      );
      replacementPageId = remainingPages[0]?.id;
    }

    this.status = 'idle';
    this.deletingPageId = null;
    this.message = '';

    await this.onDeleted(pageId, { shouldNavigate, replacementPageId });
    return true;
  }

  reset(): void {
    if (this.isDeleting) return;
    this.status = 'idle';
    this.deletingPageId = null;
    this.confirmingPageId = null;
    this.message = '';
  }
}
