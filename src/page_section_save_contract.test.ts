import { describe, expect, it } from 'vitest';
import { isPageSectionSaveResponse, validatePageSectionSaveRequest } from './page_section_save_contract';

const pageId = 'page-1';
const section = (overrides: Record<string, unknown> = {}) => ({
  id: 'hero-1', page_id: pageId, type: 'hero', content: { heading: 'Safe' }, order: 0, styles: {}, ...overrides
});
const request = (sections: unknown[] = [section()], overrides: Record<string, unknown> = {}) => ({ generation: 1, expected_revision: null, sections, ...overrides });

describe('page section save contract', () => {
  it('accepts a complete registered document', () => expect(validatePageSectionSaveRequest(request(), pageId).success).toBe(true));
  it('accepts an empty replacement document', () => expect(validatePageSectionSaveRequest(request([]), pageId).success).toBe(true));
  it('rejects a non-object request', () => expect(validatePageSectionSaveRequest([], pageId).success).toBe(false));
  it('rejects unknown request fields', () => expect(validatePageSectionSaveRequest(request(undefined, { user_id: 'attacker' }), pageId).success).toBe(false));
  it.each([0, -1, 1.5, Number.NaN])('rejects invalid generation %s', generation => expect(validatePageSectionSaveRequest(request(undefined, { generation }), pageId).success).toBe(false));
  it('rejects invalid expected revisions', () => expect(validatePageSectionSaveRequest(request(undefined, { expected_revision: -1 }), pageId).success).toBe(false));
  it('rejects a page mismatch', () => expect(validatePageSectionSaveRequest(request([section({ page_id: 'other' })]), pageId).success).toBe(false));
  it('rejects an unknown section type', () => expect(validatePageSectionSaveRequest(request([section({ type: 'script' })]), pageId).success).toBe(false));
  it('rejects duplicate section IDs', () => expect(validatePageSectionSaveRequest(request([section(), section({ order: 1 })]), pageId).success).toBe(false));
  it('rejects duplicate order values', () => expect(validatePageSectionSaveRequest(request([section(), section({ id: 'offer-1', type: 'offer' })]), pageId).success).toBe(false));
  it('rejects non-contiguous order values', () => expect(validatePageSectionSaveRequest(request([section({ order: 2 })]), pageId).success).toBe(false));
  it('rejects non-object content', () => expect(validatePageSectionSaveRequest(request([section({ content: [] })]), pageId).success).toBe(false));
  it('rejects unsupported section fields', () => expect(validatePageSectionSaveRequest(request([section({ user_id: 'attacker' })]), pageId).success).toBe(false));
  it('recognizes a durable success envelope', () => expect(isPageSectionSaveResponse({ success: true, data: { page_id: pageId, saved_count: 1, generation: 1, revision: 2, document_hash: 'hash', request_id: 'req' } })).toBe(true));
  it('recognizes a structured failure envelope', () => expect(isPageSectionSaveResponse({ success: false, error: { code: 'CONFLICT', message: 'Conflict', request_id: 'req', status: 409 } })).toBe(true));
  it('rejects malformed server results', () => expect(isPageSectionSaveResponse({ success: true, data: { page_id: pageId } })).toBe(false));
});
