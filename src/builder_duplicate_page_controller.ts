import type { Funnel, Page, PageSection, Website, WebsiteRoute } from './types';

export type BuilderDuplicatePageStatus = 'idle' | 'duplicating' | 'error';

export interface BuilderDuplicatePageContext {
  actingUserId: string;
  website?: Website;
  websiteRoutes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
  activePageId?: string;
}

export interface BuilderDuplicatePagePersistRequest {
  sourcePageId: string;
  newPageId: string;
  name?: string;
  slug?: string;
  destinationFunnelId?: string;
}

export interface BuilderDuplicatePagePersistResult {
  success: boolean;
  data?: {
    page: Page;
    sections: PageSection[];
  };
  code?: 'NOT_FOUND' | 'CONFLICT' | 'UNAUTHORIZED' | 'AMBIGUOUS' | 'INVALID_RESPONSE' | 'UNAVAILABLE';
  error?: string;
}

export interface BuilderDuplicatePageOnDuplicatedMeta {
  shouldNavigate: boolean;
}

export interface BuilderDuplicatePageControllerOptions {
  getContext: () => BuilderDuplicatePageContext;
  persist: (request: BuilderDuplicatePagePersistRequest) => Promise<BuilderDuplicatePagePersistResult>;
  onDuplicated: (page: Page, sections: PageSection[], meta: BuilderDuplicatePageOnDuplicatedMeta) => void | Promise<void>;
  generateId?: () => string;
}

export class BuilderDuplicatePageController {
  status: BuilderDuplicatePageStatus = 'idle';
  duplicatingPageId: string | null = null;
  message = '';
  private requestGeneration = 0;
  private readonly getContext: BuilderDuplicatePageControllerOptions['getContext'];
  private readonly persist: BuilderDuplicatePageControllerOptions['persist'];
  private readonly onDuplicated: BuilderDuplicatePageControllerOptions['onDuplicated'];
  private readonly generateId: () => string;

  constructor(options: BuilderDuplicatePageControllerOptions) {
    this.getContext = options.getContext;
    this.persist = options.persist;
    this.onDuplicated = options.onDuplicated;
    this.generateId = options.generateId ?? (() => crypto.randomUUID());
  }

  get isDuplicating(): boolean {
    return this.status === 'duplicating';
  }

  async duplicate(sourcePageId: string): Promise<boolean> {
    if (this.isDuplicating || !sourcePageId.trim()) return false;

    const initialContext = this.getContext();
    const sourcePage = initialContext.pages.find(
      page => page.id === sourcePageId && page.user_id === initialContext.actingUserId
    );

    if (!sourcePage || !initialContext.website || initialContext.website.user_id !== initialContext.actingUserId) {
      this.status = 'error';
      this.message = 'The source page could not be found.';
      return false;
    }

    const newPageId = this.generateId();
    const generation = ++this.requestGeneration;
    this.status = 'duplicating';
    this.duplicatingPageId = sourcePageId;
    this.message = `Duplicating ${sourcePage.name}…`;

    let result: BuilderDuplicatePagePersistResult;
    try {
      result = await this.persist({
        sourcePageId,
        newPageId
      });
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
      this.duplicatingPageId = null;
      this.message = 'The page could not be duplicated. Please try again.';
      return false;
    }

    if (!result.success || !result.data?.page) {
      this.status = 'error';
      this.duplicatingPageId = null;
      this.message = result.code === 'CONFLICT'
        ? 'A page with that name or URL already exists.'
        : result.code === 'AMBIGUOUS'
          ? 'The duplication result is uncertain. Please reload to check.'
          : 'The page could not be duplicated. Please try again.';
      return false;
    }

    const createdPage = result.data.page;
    if (
      createdPage.id !== newPageId
      || createdPage.user_id !== initialContext.actingUserId
      || createdPage.status !== 'draft'
    ) {
      this.status = 'error';
      this.duplicatingPageId = null;
      this.message = 'The page could not be duplicated. Please try again.';
      return false;
    }

    const shouldNavigate = currentContext.activePageId === initialContext.activePageId;

    this.status = 'idle';
    this.duplicatingPageId = null;
    this.message = '';

    await this.onDuplicated(createdPage, result.data.sections ?? [], { shouldNavigate });
    return true;
  }

  reset(): void {
    if (this.isDuplicating) return;
    this.status = 'idle';
    this.duplicatingPageId = null;
    this.message = '';
  }
}
