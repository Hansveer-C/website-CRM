import type { PageSection } from './types';

export const PAGE_SECTION_SAVE_CANONICAL_TYPES = ['hero', 'proof', 'offer', 'gallery', 'form', 'faq'] as const;
export const PAGE_SECTION_SAVE_LEGACY_TYPES = ['services', 'benefits', 'before_after', 'cta', 'contact_info', 'map'] as const;
export const PAGE_SECTION_SAVE_TYPES = [
  ...PAGE_SECTION_SAVE_CANONICAL_TYPES,
  ...PAGE_SECTION_SAVE_LEGACY_TYPES
] as const;
export const PAGE_SECTION_SAVE_MAX_SECTIONS = 100;
export const PAGE_SECTION_SAVE_MAX_JSON_BYTES = 256_000;

export type PageSectionSaveErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_INPUT'
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'PAGE_NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'CONFIGURATION_ERROR'
  | 'SUPABASE_UNAVAILABLE'
  | 'TRANSACTION_FAILED'
  | 'NETWORK_FAILURE'
  | 'MALFORMED_RESPONSE';

export interface PageSectionSaveRequest {
  generation: number;
  expected_revision: number | null;
  sections: PageSection[];
}

export interface PageSectionSaveData {
  page_id: string;
  saved_count: number;
  generation: number;
  revision: number;
  document_hash: string;
  request_id: string;
}

export type PageSectionSaveResponse =
  | { success: true; data: PageSectionSaveData }
  | {
      success: false;
      error: {
        code: PageSectionSaveErrorCode;
        message: string;
        request_id: string;
        status: number;
        fields?: Record<string, string>;
      };
    };

export type PageSectionSaveValidation =
  | { success: true; data: PageSectionSaveRequest }
  | { success: false; fields: Record<string, string> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function jsonSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function validatePageSectionSaveRequest(
  value: unknown,
  pageId: string
): PageSectionSaveValidation {
  const fields: Record<string, string> = {};
  if (!isPlainObject(value)) return { success: false, fields: { request: 'Request body must be an object.' } };
  const allowedRequestKeys = new Set(['generation', 'expected_revision', 'sections']);
  if (Object.keys(value).some(key => !allowedRequestKeys.has(key))) fields.request = 'Request contains unsupported fields.';

  if (!Number.isSafeInteger(value.generation) || (value.generation as number) < 1) {
    fields.generation = 'Generation must be a positive integer.';
  }
  if (value.expected_revision !== null && (!Number.isSafeInteger(value.expected_revision) || (value.expected_revision as number) < 0)) {
    fields.expected_revision = 'Expected revision must be null or a non-negative integer.';
  }
  if (!Array.isArray(value.sections)) {
    fields.sections = 'Sections must be an array.';
    return { success: false, fields };
  }
  if (value.sections.length > PAGE_SECTION_SAVE_MAX_SECTIONS) fields.sections = `At most ${PAGE_SECTION_SAVE_MAX_SECTIONS} sections may be saved.`;

  const ids = new Set<string>();
  const orders = new Set<number>();
  value.sections.forEach((candidate, index) => {
    const path = `sections[${index}]`;
    if (!isPlainObject(candidate)) {
      fields[path] = 'Section must be an object.';
      return;
    }
    const allowedKeys = new Set(['id', 'page_id', 'funnel_id', 'type', 'content', 'order', 'styles', 'variant']);
    if (Object.keys(candidate).some(key => !allowedKeys.has(key))) fields[path] = 'Section contains unsupported fields.';
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!id || id.length > 128) fields[`${path}.id`] = 'Section ID must be between 1 and 128 characters.';
    else if (ids.has(id)) fields[`${path}.id`] = 'Section ID must be unique.';
    else ids.add(id);
    if (candidate.page_id !== pageId) fields[`${path}.page_id`] = 'Section must belong to the requested page.';
    if (typeof candidate.type !== 'string' || !(PAGE_SECTION_SAVE_TYPES as readonly string[]).includes(candidate.type)) {
      fields[`${path}.type`] = 'Section type is not registered.';
    }
    const order = candidate.order;
    if (!Number.isSafeInteger(order) || (order as number) < 0) fields[`${path}.order`] = 'Order must be a non-negative integer.';
    else if (orders.has(order as number)) fields[`${path}.order`] = 'Order must be unique.';
    else orders.add(order as number);
    if (!isPlainObject(candidate.content) || jsonSize(candidate.content) > PAGE_SECTION_SAVE_MAX_JSON_BYTES) fields[`${path}.content`] = 'Content must be an object within the size limit.';
    if (!isPlainObject(candidate.styles) || jsonSize(candidate.styles) > PAGE_SECTION_SAVE_MAX_JSON_BYTES) fields[`${path}.styles`] = 'Styles must be an object within the size limit.';
    if (candidate.variant !== undefined && (typeof candidate.variant !== 'string' || candidate.variant.length > 80)) fields[`${path}.variant`] = 'Variant must be a string of at most 80 characters.';
    if (candidate.funnel_id !== undefined && (typeof candidate.funnel_id !== 'string' || candidate.funnel_id.length > 128)) fields[`${path}.funnel_id`] = 'Funnel ID is invalid.';
  });
  for (let index = 0; index < value.sections.length; index += 1) {
    if (!orders.has(index)) fields.sections = 'Section order must be contiguous from zero.';
  }
  return Object.keys(fields).length > 0
    ? { success: false, fields }
    : { success: true, data: value as unknown as PageSectionSaveRequest };
}

export function isPageSectionSaveResponse(value: unknown): value is PageSectionSaveResponse {
  if (!isPlainObject(value) || typeof value.success !== 'boolean') return false;
  if (value.success) {
    const data = value.data;
    return isPlainObject(data)
      && typeof data.page_id === 'string'
      && Number.isSafeInteger(data.saved_count)
      && Number.isSafeInteger(data.generation)
      && Number.isSafeInteger(data.revision)
      && typeof data.document_hash === 'string'
      && typeof data.request_id === 'string';
  }
  const error = value.error;
  return isPlainObject(error)
    && typeof error.code === 'string'
    && typeof error.message === 'string'
    && typeof error.request_id === 'string'
    && Number.isInteger(error.status);
}
