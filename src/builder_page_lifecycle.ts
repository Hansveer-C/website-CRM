import type { Page, PageSection, RepoResponse } from './types';
import {
  BUILDER_PAGE_NAME_MAX_LENGTH,
  BUILDER_PAGE_SLUG_MAX_LENGTH,
  normalizeBuilderPageSlug
} from './builder_page_settings';

/**
 * Canonical Page entity representation for the Builder.
 */
export interface BuilderLifecyclePage extends Page {}

/**
 * Operation inputs & outputs for canonical Page lifecycle.
 */
export interface CreatePageInput {
  name: string;
  slug: string;
  funnelId: string;
  id?: string;
  stepOrder?: number;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  schema_markup?: string;
}

export interface CreatePageResult {
  page: Page;
}

export interface DuplicatePageInput {
  sourcePageId: string;
  newPageId?: string;
}

export interface DuplicatePageResult {
  page: Page;
  sections: PageSection[];
}

export interface DeletePageInput {
  pageId: string;
}

export interface DeletePageResult {
  id: string;
}

export interface ReorderPagesInput {
  funnelId: string;
  pageOrders: Array<{ pageId: string; stepOrder: number }>;
}

export interface ReorderPagesResult {
  pages: Array<{ id: string; step_order: number }>;
}

export interface SetHomepageInput {
  websiteId: string;
  pageId: string;
}

export interface SetHomepageResult {
  websiteId: string;
  homepagePageId: string;
  homepageFunnelId: string;
}

export interface SetNavigationInclusionInput {
  websiteId: string;
  pageId: string;
  visible: boolean;
  label?: string;
  order?: number;
}

export interface SetNavigationInclusionResult {
  websiteId: string;
  pageId: string;
  visible: boolean;
}

/**
 * Canonical Page Lifecycle Service contract.
 */
export interface PageLifecycleContract {
  createPage(input: CreatePageInput, actingUserId: string): Promise<RepoResponse<CreatePageResult>>;
  duplicatePage(input: DuplicatePageInput, actingUserId: string): Promise<RepoResponse<DuplicatePageResult>>;
  deletePage(input: DeletePageInput, actingUserId: string): Promise<RepoResponse<DeletePageResult>>;
  reorderPages(input: ReorderPagesInput, actingUserId: string): Promise<RepoResponse<ReorderPagesResult>>;
  setHomepage(input: SetHomepageInput, actingUserId: string): Promise<RepoResponse<SetHomepageResult>>;
  setNavigationInclusion(input: SetNavigationInclusionInput, actingUserId: string): Promise<RepoResponse<SetNavigationInclusionResult>>;
}

/**
 * Generates a deterministic unique duplicate name reserving suffix capacity.
 * Example: 120-char name -> truncated-base + " (Copy)"
 */
export function generateDuplicatePageName(
  sourceName: string,
  existingNames: readonly string[]
): string {
  const baseTrimmed = sourceName.trim() || 'Untitled page';
  const existingSet = new Set(existingNames.map(name => name.trim().toLowerCase()));

  const copyMatch = baseTrimmed.match(/^(.*?)(?:\s+\(Copy(?:\s+(\d+))?\))?$/i);
  const isCopy = copyMatch && copyMatch[0] !== copyMatch[1];
  const rootName = copyMatch && copyMatch[1] ? copyMatch[1].trim() : baseTrimmed;
  const currentCopyNum = copyMatch && copyMatch[2] ? parseInt(copyMatch[2], 10) : (isCopy ? 1 : undefined);

  if (currentCopyNum === undefined) {
    const suffix = ' (Copy)';
    const maxBaseLen = BUILDER_PAGE_NAME_MAX_LENGTH - suffix.length;
    const firstCandidate = `${rootName.slice(0, maxBaseLen)}${suffix}`;
    if (!existingSet.has(firstCandidate.toLowerCase())) {
      return firstCandidate;
    }
  }

  let index = (currentCopyNum ?? 1) + 1;
  while (index < 1000) {
    const suffix = ` (Copy ${index})`;
    const maxBaseLen = BUILDER_PAGE_NAME_MAX_LENGTH - suffix.length;
    const candidate = `${rootName.slice(0, maxBaseLen)}${suffix}`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
    index += 1;
  }

  const fallbackSuffix = ` (Copy ${Date.now()})`;
  const maxBaseLen = BUILDER_PAGE_NAME_MAX_LENGTH - fallbackSuffix.length;
  return `${rootName.slice(0, maxBaseLen)}${fallbackSuffix}`;
}

/**
 * Generates a deterministic unique duplicate slug reserving suffix capacity.
 * Example: 120-char slug -> truncated-base + "-copy"
 */
export function generateDuplicatePageSlug(
  sourceSlug: string,
  existingSlugs: readonly string[]
): string {
  const normalizedSource = normalizeBuilderPageSlug(sourceSlug) || 'page';
  const existingSet = new Set(existingSlugs.map(slug => normalizeBuilderPageSlug(slug)));

  const copyMatch = normalizedSource.match(/^(.*?)(?:-copy(?:-(\d+))?)?$/);
  const isCopy = copyMatch && copyMatch[0] !== copyMatch[1];
  const rootSlug = copyMatch && copyMatch[1] ? copyMatch[1] : normalizedSource;
  const currentCopyNum = copyMatch && copyMatch[2] ? parseInt(copyMatch[2], 10) : (isCopy ? 1 : undefined);

  if (currentCopyNum === undefined) {
    const suffix = '-copy';
    const maxBaseLen = BUILDER_PAGE_SLUG_MAX_LENGTH - suffix.length;
    const firstCandidate = `${rootSlug.slice(0, maxBaseLen)}${suffix}`;
    if (!existingSet.has(firstCandidate)) {
      return firstCandidate;
    }
  }

  let index = (currentCopyNum ?? 1) + 1;
  while (index < 1000) {
    const suffix = `-copy-${index}`;
    const maxBaseLen = BUILDER_PAGE_SLUG_MAX_LENGTH - suffix.length;
    const candidate = `${rootSlug.slice(0, maxBaseLen)}${suffix}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
    index += 1;
  }

  const fallbackSuffix = `-copy-${Date.now()}`;
  const maxBaseLen = BUILDER_PAGE_SLUG_MAX_LENGTH - fallbackSuffix.length;
  return `${rootSlug.slice(0, maxBaseLen)}${fallbackSuffix}`;
}

export interface CreateDuplicatePageDefaultsOptions {
  sourcePage: Page;
  sourceSections: readonly PageSection[];
  existingPages: readonly Page[];
  actingUserId: string;
  newPageId: string;
  name?: string;
  slug?: string;
  destinationFunnelId?: string;
  generateSectionId?: () => string;
  now?: () => string;
}

/**
 * Creates the deterministic defaults for a duplicated page and its deep-copied sections.
 */
export function createDuplicatePageDefaults(
  options: CreateDuplicatePageDefaultsOptions
): { page: Page; sections: PageSection[] } {
  const now = options.now ?? (() => new Date().toISOString());
  const generateSectionId = options.generateSectionId ?? (() => crypto.randomUUID());
  const destinationFunnelId = options.destinationFunnelId ?? options.sourcePage.funnel_id ?? '';

  const userPages = options.existingPages.filter(page => page.user_id === options.actingUserId);
  const existingNames = userPages.map(page => page.name);
  const existingSlugs = userPages.map(page => page.slug);

  const name = options.name?.trim()
    ? options.name.trim().slice(0, BUILDER_PAGE_NAME_MAX_LENGTH)
    : generateDuplicatePageName(options.sourcePage.name, existingNames);
  const slug = options.slug
    ? normalizeBuilderPageSlug(options.slug).slice(0, BUILDER_PAGE_SLUG_MAX_LENGTH)
    : generateDuplicatePageSlug(options.sourcePage.slug, existingSlugs);

  // Determine step order in target funnel
  const funnelPages = userPages.filter(page => page.funnel_id === destinationFunnelId);
  const finiteOrders = funnelPages
    .map(page => page.step_order)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const stepOrder = finiteOrders.length > 0
    ? Math.max(...finiteOrders) + 1
    : funnelPages.length === 0 ? 0 : undefined;

  const duplicatedPage: Page = {
    id: options.newPageId,
    user_id: options.actingUserId,
    name,
    slug,
    status: 'draft', // Duplicates always start as draft
    seo_title: options.sourcePage.seo_title ?? '',
    seo_description: options.sourcePage.seo_description ?? '',
    seo_keywords: Array.isArray(options.sourcePage.seo_keywords)
      ? [...options.sourcePage.seo_keywords]
      : [],
    created_at: now(),
    ...(destinationFunnelId ? { funnel_id: destinationFunnelId } : {}),
    ...(typeof options.sourcePage.step_type === 'string' ? { step_type: options.sourcePage.step_type } : {}),
    ...(typeof options.sourcePage.schema_markup === 'string' ? { schema_markup: options.sourcePage.schema_markup } : {}),
    ...(stepOrder !== undefined ? { step_order: stepOrder } : {})
  };

  // Sort source sections by order
  const sortedSourceSections = [...options.sourceSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Deep clone all sections with fresh collision-resistant IDs (NO funnel_id on PageSection!)
  const duplicatedSections: PageSection[] = sortedSourceSections.map((sourceSection, index) => ({
    id: generateSectionId(),
    page_id: options.newPageId,
    type: sourceSection.type,
    content: structuredClone(sourceSection.content ?? {}),
    styles: structuredClone(sourceSection.styles ?? {}),
    order: index,
    ...(sourceSection.variant !== undefined ? { variant: sourceSection.variant } : {})
  }));

  return {
    page: duplicatedPage,
    sections: duplicatedSections
  };
}

export function isExpectedDuplicatedPage(
  actual: Page,
  expected: Page
): boolean {
  return actual.id === expected.id
    && actual.user_id === expected.user_id
    && actual.name === expected.name
    && actual.slug === expected.slug
    && actual.status === 'draft'
    && actual.funnel_id === expected.funnel_id;
}
