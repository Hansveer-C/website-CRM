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
  id: string;
  name: string;
  slug: string;
  funnelId: string;
  stepOrder?: number;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
}

export interface CreatePageResult {
  page: Page;
}

export interface DuplicatePageInput {
  sourcePageId: string;
  newPageId: string;
  name?: string;
  slug?: string;
  destinationFunnelId?: string;
  stepOrder?: number;
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
 * Generates a deterministic unique duplicate name given existing page names.
 * Example: "About" -> "About (Copy)", "About (Copy)" -> "About (Copy 2)".
 */
export function generateDuplicatePageName(
  sourceName: string,
  existingNames: readonly string[]
): string {
  const baseTrimmed = sourceName.trim() || 'Untitled page';
  const existingSet = new Set(existingNames.map(name => name.trim().toLowerCase()));

  // Check if sourceName already ends in (Copy) or (Copy N)
  const copyMatch = baseTrimmed.match(/^(.*?)(?:\s+\(Copy(?:\s+(\d+))?\))?$/i);
  const isCopy = copyMatch && copyMatch[0] !== copyMatch[1];
  const rootName = copyMatch && copyMatch[1] ? copyMatch[1].trim() : baseTrimmed;
  const currentCopyNum = copyMatch && copyMatch[2] ? parseInt(copyMatch[2], 10) : (isCopy ? 1 : undefined);

  if (currentCopyNum === undefined) {
    const firstCandidate = `${rootName} (Copy)`;
    if (!existingSet.has(firstCandidate.toLowerCase())) {
      return firstCandidate.slice(0, BUILDER_PAGE_NAME_MAX_LENGTH);
    }
  }

  let index = (currentCopyNum ?? 1) + 1;
  while (index < 1000) {
    const candidate = `${rootName} (Copy ${index})`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate.slice(0, BUILDER_PAGE_NAME_MAX_LENGTH);
    }
    index += 1;
  }

  return `${rootName} (Copy ${Date.now()})`.slice(0, BUILDER_PAGE_NAME_MAX_LENGTH);
}

/**
 * Generates a deterministic unique duplicate slug given existing page slugs.
 * Example: "about" -> "about-copy", "about-copy" -> "about-copy-2".
 */
export function generateDuplicatePageSlug(
  sourceSlug: string,
  existingSlugs: readonly string[]
): string {
  const normalizedSource = normalizeBuilderPageSlug(sourceSlug) || 'page';
  const existingSet = new Set(existingSlugs.map(slug => normalizeBuilderPageSlug(slug)));

  // Check if sourceSlug already ends in -copy or -copy-N
  const copyMatch = normalizedSource.match(/^(.*?)(?:-copy(?:-(\d+))?)?$/);
  const isCopy = copyMatch && copyMatch[0] !== copyMatch[1];
  const rootSlug = copyMatch && copyMatch[1] ? copyMatch[1] : normalizedSource;
  const currentCopyNum = copyMatch && copyMatch[2] ? parseInt(copyMatch[2], 10) : (isCopy ? 1 : undefined);

  if (currentCopyNum === undefined) {
    const firstCandidate = `${rootSlug}-copy`;
    if (!existingSet.has(firstCandidate)) {
      return firstCandidate.slice(0, BUILDER_PAGE_SLUG_MAX_LENGTH);
    }
  }

  let index = (currentCopyNum ?? 1) + 1;
  while (index < 1000) {
    const candidate = `${rootSlug}-copy-${index}`;
    if (!existingSet.has(candidate)) {
      return candidate.slice(0, BUILDER_PAGE_SLUG_MAX_LENGTH);
    }
    index += 1;
  }

  return `${rootSlug}-copy-${Date.now()}`.slice(0, BUILDER_PAGE_SLUG_MAX_LENGTH);
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

  const name = (options.name?.trim() || generateDuplicatePageName(options.sourcePage.name, existingNames))
    .slice(0, BUILDER_PAGE_NAME_MAX_LENGTH);
  const slug = (options.slug ? normalizeBuilderPageSlug(options.slug) : generateDuplicatePageSlug(options.sourcePage.slug, existingSlugs))
    .slice(0, BUILDER_PAGE_SLUG_MAX_LENGTH);

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
    ...(stepOrder !== undefined ? { step_order: stepOrder } : {})
  };

  // Sort source sections by order
  const sortedSourceSections = [...options.sourceSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Deep clone all sections with fresh collision-resistant IDs and normalized 0-based contiguous order
  const duplicatedSections: PageSection[] = sortedSourceSections.map((sourceSection, index) => ({
    id: generateSectionId(),
    page_id: options.newPageId,
    ...(destinationFunnelId ? { funnel_id: destinationFunnelId } : {}),
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
