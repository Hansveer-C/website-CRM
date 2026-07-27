import type { Funnel, Page, Website, WebsiteRoute } from './types';
import {
  createBuilderNewPageDefaults,
  generateBuilderNewPageSlug,
  getBuilderNewPagePlannedPath,
  getEligibleNewPageDestinations,
  isExpectedCreatedBuilderPage,
  validateBuilderNewPageInput,
  type BuilderNewPageDestination,
  type BuilderNewPageInput,
  type BuilderNewPageValidationIssue
} from './builder_new_page';

export type BuilderNewPageDialogStatus = 'closed' | 'editing' | 'creating' | 'error';

export interface BuilderNewPageContext {
  actingUserId: string;
  website?: Website;
  websiteRoutes: readonly WebsiteRoute[];
  funnels: readonly Funnel[];
  pages: readonly Page[];
  activePageId?: string;
}

export interface BuilderNewPagePersistRequest {
  id: string;
  name: string;
  slug: string;
  destinationKey: string;
}

export interface BuilderNewPagePersistResult {
  success: boolean;
  page?: Page;
  code?: 'CONFLICT' | 'DESTINATION_UNAVAILABLE' | 'UNAUTHORIZED' | 'AMBIGUOUS' | 'INVALID_RESPONSE' | 'UNAVAILABLE';
}

export interface BuilderNewPageControllerOptions {
  getContext: () => BuilderNewPageContext;
  persist: (request: BuilderNewPagePersistRequest) => Promise<BuilderNewPagePersistResult>;
  onCreated: (page: Page) => void | Promise<void>;
  generateId?: () => string;
}

export class BuilderNewPageController {
  status: BuilderNewPageDialogStatus = 'closed';
  input: BuilderNewPageInput = { name: '', slug: '', destinationKey: '' };
  issues: BuilderNewPageValidationIssue[] = [];
  message = '';
  private slugEdited = false;
  private attemptId: string | null = null;
  private requestGeneration = 0;
  private readonly getContext: BuilderNewPageControllerOptions['getContext'];
  private readonly persist: BuilderNewPageControllerOptions['persist'];
  private readonly onCreated: BuilderNewPageControllerOptions['onCreated'];
  private readonly generateId: () => string;

  constructor(options: BuilderNewPageControllerOptions) {
    this.getContext = options.getContext;
    this.persist = options.persist;
    this.onCreated = options.onCreated;
    this.generateId = options.generateId ?? (() => crypto.randomUUID());
  }

  get destinations(): readonly BuilderNewPageDestination[] {
    const context = this.getContext();
    return getEligibleNewPageDestinations({
      website: context.website,
      websiteRoutes: context.websiteRoutes,
      funnels: context.funnels,
      pages: context.pages,
      actingUserId: context.actingUserId
    });
  }

  get plannedPath(): string | null {
    return getBuilderNewPagePlannedPath(
      this.destinations.find(item => item.key === this.input.destinationKey),
      this.input.slug
    );
  }

  get isCreating(): boolean {
    return this.status === 'creating';
  }

  open(): void {
    const context = this.getContext();
    const destinations = this.destinations;
    const currentFunnelId = context.pages.find(page => page.id === context.activePageId)?.funnel_id;
    const preferred = destinations.find(item => item.funnelId === currentFunnelId)
      ?? destinations.find(item => item.isHomepage)
      ?? (destinations.length === 1 ? destinations[0] : undefined);
    this.input = { name: '', slug: '', destinationKey: preferred?.key ?? '' };
    this.slugEdited = false;
    this.attemptId = null;
    this.issues = [];
    this.message = destinations.length ? '' : 'This website does not have an available page destination.';
    this.status = 'editing';
  }

  cancel(): boolean {
    if (this.isCreating) return false;
    this.status = 'closed';
    this.issues = [];
    this.message = '';
    this.attemptId = null;
    return true;
  }

  updateName(value: string): void {
    if (this.isCreating) return;
    this.input = {
      ...this.input,
      name: value,
      ...(!this.slugEdited ? { slug: generateBuilderNewPageSlug(value) } : {})
    };
    this.resetForEdit();
  }

  updateSlug(value: string): void {
    if (this.isCreating) return;
    this.input = { ...this.input, slug: value };
    this.slugEdited = true;
    this.resetForEdit();
  }

  updateDestination(value: string): void {
    if (this.isCreating) return;
    this.input = { ...this.input, destinationKey: value };
    this.resetForEdit();
  }

  validate(): readonly BuilderNewPageValidationIssue[] {
    const context = this.getContext();
    this.issues = validateBuilderNewPageInput(this.input, {
      destinations: this.destinations,
      existingPages: context.pages.filter(page => page.user_id === context.actingUserId)
    });
    return this.issues;
  }

  async create(): Promise<boolean> {
    if (this.isCreating || this.status === 'closed') return false;
    const initialContext = this.getContext();
    const input = { ...this.input };
    const destinations = this.destinations;
    this.issues = validateBuilderNewPageInput(input, {
      destinations,
      existingPages: initialContext.pages.filter(page => page.user_id === initialContext.actingUserId)
    });
    if (this.issues.length) {
      this.status = 'editing';
      return false;
    }
    const destination = destinations.find(item => item.key === input.destinationKey);
    if (!destination || !initialContext.website) return false;
    this.attemptId ??= this.generateId();
    const attemptId = this.attemptId;
    const expected = createBuilderNewPageDefaults({
      input,
      destination,
      actingUserId: initialContext.actingUserId,
      existingPages: initialContext.pages,
      id: attemptId
    });
    const generation = ++this.requestGeneration;
    this.status = 'creating';
    this.message = 'Creating page…';

    let result: BuilderNewPagePersistResult;
    try {
      result = await this.persist({ id: attemptId, ...input });
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
      this.message = 'The page could not be created. Please try again.';
      return false;
    }
    if (!result.success || !result.page) {
      this.status = 'error';
      this.message = result.code === 'AMBIGUOUS'
        ? 'The page result is uncertain. Retry to check the same page request safely.'
        : result.code === 'DESTINATION_UNAVAILABLE'
          ? 'This page destination is no longer available.'
          : 'The page could not be created. Please try again.';
      if (result.code === 'CONFLICT') {
        this.issues = [{ field: 'slug', code: 'duplicate-slug', message: 'Another page in this account already uses this URL.' }];
      }
      return false;
    }
    if (!isExpectedCreatedBuilderPage(result.page, expected)) {
      this.status = 'error';
      this.message = 'The page could not be created. Please try again.';
      return false;
    }
    await this.onCreated(result.page);
    this.status = 'closed';
    this.message = '';
    this.issues = [];
    this.input = { name: '', slug: '', destinationKey: '' };
    this.attemptId = null;
    return true;
  }

  retry(): Promise<boolean> {
    return this.create();
  }

  private resetForEdit(): void {
    this.issues = [];
    this.message = '';
    this.status = 'editing';
    this.attemptId = null;
  }
}
