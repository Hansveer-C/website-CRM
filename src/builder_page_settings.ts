import type { Page } from './types';

export interface BuilderPageSettings {
  name: string;
  slug: string;
  seo_title: string;
  seo_description: string;
}

export type BuilderPageSettingsField = keyof BuilderPageSettings;

export interface BuilderPageSettingsValidationIssue {
  field: BuilderPageSettingsField;
  code:
    | 'required'
    | 'control-character'
    | 'too-long'
    | 'invalid-slug'
    | 'homepage-slug-locked'
    | 'duplicate-slug';
  message: string;
}

export type BuilderPageSettingsPatch = Partial<BuilderPageSettings>;

export interface BuilderPageSettingsValidationContext {
  isHomepage?: boolean;
  originalSlug?: string;
  existingSlugs?: readonly string[];
}

export const BUILDER_PAGE_NAME_MAX_LENGTH = 120;
export const BUILDER_PAGE_SLUG_MAX_LENGTH = 120;
export const BUILDER_SEO_TITLE_MAX_LENGTH = 70;
export const BUILDER_SEO_DESCRIPTION_MAX_LENGTH = 320;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SLUG_CHARACTERS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBuilderPageSlug(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeSingleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function pageToBuilderPageSettings(page: Page): BuilderPageSettings {
  return {
    name: page.name,
    slug: page.slug,
    seo_title: page.seo_title ?? '',
    seo_description: page.seo_description ?? ''
  };
}

export function normalizeBuilderPageSettings(
  input: BuilderPageSettings
): BuilderPageSettings {
  return {
    name: input.name.trim(),
    slug: normalizeBuilderPageSlug(input.slug),
    seo_title: normalizeSingleLine(input.seo_title),
    seo_description: normalizeSingleLine(input.seo_description)
  };
}

export function validateBuilderPageSettings(
  input: BuilderPageSettings,
  context: BuilderPageSettingsValidationContext = {}
): BuilderPageSettingsValidationIssue[] {
  const issues: BuilderPageSettingsValidationIssue[] = [];
  const normalized = normalizeBuilderPageSettings(input);

  if (!normalized.name) {
    issues.push({ field: 'name', code: 'required', message: 'Page name is required.' });
  } else if (CONTROL_CHARACTERS.test(input.name)) {
    issues.push({ field: 'name', code: 'control-character', message: 'Page name cannot contain control characters.' });
  } else if (normalized.name.length > BUILDER_PAGE_NAME_MAX_LENGTH) {
    issues.push({ field: 'name', code: 'too-long', message: `Page name must be ${BUILDER_PAGE_NAME_MAX_LENGTH} characters or fewer.` });
  }

  const rawSlug = input.slug.trim();
  const unsafeSlug = CONTROL_CHARACTERS.test(rawSlug)
    || rawSlug.includes('://')
    || rawSlug.includes('?')
    || rawSlug.includes('#')
    || rawSlug.includes('\\')
    || rawSlug.split('/').some(segment => segment === '.' || segment === '..');
  if (!normalized.slug) {
    issues.push({ field: 'slug', code: 'required', message: 'URL slug is required.' });
  } else if (unsafeSlug || !SLUG_CHARACTERS.test(normalized.slug)) {
    issues.push({ field: 'slug', code: 'invalid-slug', message: 'Use lowercase letters, numbers, and single hyphens only.' });
  } else if (normalized.slug.length > BUILDER_PAGE_SLUG_MAX_LENGTH) {
    issues.push({ field: 'slug', code: 'too-long', message: `URL slug must be ${BUILDER_PAGE_SLUG_MAX_LENGTH} characters or fewer.` });
  } else if (
    context.isHomepage
    && normalized.slug !== normalizeBuilderPageSlug(context.originalSlug ?? 'home')
  ) {
    issues.push({ field: 'slug', code: 'homepage-slug-locked', message: 'The homepage URL is managed by its root route and cannot be changed here.' });
  } else if ((context.existingSlugs ?? []).some(slug => (
    normalizeBuilderPageSlug(slug) === normalized.slug
  ))) {
    issues.push({ field: 'slug', code: 'duplicate-slug', message: 'Another page already uses this URL.' });
  }

  if (CONTROL_CHARACTERS.test(input.seo_title.replace(/[\r\n]/g, ''))) {
    issues.push({ field: 'seo_title', code: 'control-character', message: 'SEO title cannot contain control characters.' });
  } else if (normalized.seo_title.length > BUILDER_SEO_TITLE_MAX_LENGTH) {
    issues.push({ field: 'seo_title', code: 'too-long', message: `SEO title must be ${BUILDER_SEO_TITLE_MAX_LENGTH} characters or fewer.` });
  }

  if (CONTROL_CHARACTERS.test(input.seo_description.replace(/[\r\n]/g, ''))) {
    issues.push({ field: 'seo_description', code: 'control-character', message: 'Meta description cannot contain control characters.' });
  } else if (normalized.seo_description.length > BUILDER_SEO_DESCRIPTION_MAX_LENGTH) {
    issues.push({ field: 'seo_description', code: 'too-long', message: `Meta description must be ${BUILDER_SEO_DESCRIPTION_MAX_LENGTH} characters or fewer.` });
  }

  return issues;
}

export function applyBuilderPageSettings(
  page: Page,
  settings: BuilderPageSettings
): Page {
  const normalized = normalizeBuilderPageSettings(settings);
  return {
    ...page,
    name: normalized.name,
    slug: normalized.slug,
    seo_title: normalized.seo_title,
    seo_description: normalized.seo_description
  };
}

export function getBuilderPageSettingsDiff(
  previous: BuilderPageSettings,
  next: BuilderPageSettings
): BuilderPageSettingsPatch {
  const normalizedPrevious = normalizeBuilderPageSettings(previous);
  const normalizedNext = normalizeBuilderPageSettings(next);
  const patch: BuilderPageSettingsPatch = {};
  (Object.keys(normalizedNext) as BuilderPageSettingsField[]).forEach(field => {
    if (normalizedPrevious[field] !== normalizedNext[field]) {
      patch[field] = normalizedNext[field];
    }
  });
  return patch;
}
