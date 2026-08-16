import { describe, expect, it } from 'vitest';
import { resolveBuilderFixtureSectionRoute } from './builder_fixture_section_route';

const origin = 'https://fixture.example';

describe('Builder fixture section route resolver', () => {
  it('matches the literal save and revision client routes', () => {
    expect(resolveBuilderFixtureSectionRoute('/api/page-sections?pageId=page%2Fone', 'PUT', origin))
      .toEqual({ kind: 'save', pageId: 'page/one' });
    expect(resolveBuilderFixtureSectionRoute('/api/page-section-save-revision?pageId=page%2Fone', 'GET', origin))
      .toEqual({ kind: 'revision', pageId: 'page/one' });
  });

  it('returns a matched route with no page for missing or blank pageId', () => {
    expect(resolveBuilderFixtureSectionRoute('/api/page-sections', 'PUT', origin))
      .toEqual({ kind: 'save', pageId: null });
    expect(resolveBuilderFixtureSectionRoute('/api/page-section-save-revision?pageId=%20', 'GET', origin))
      .toEqual({ kind: 'revision', pageId: null });
  });

  it('does not intercept wrong methods or unrelated API paths', () => {
    expect(resolveBuilderFixtureSectionRoute('/api/page-sections?pageId=page-1', 'GET', origin)).toBeNull();
    expect(resolveBuilderFixtureSectionRoute('/api/page-section-save-revision?pageId=page-1', 'PUT', origin)).toBeNull();
    expect(resolveBuilderFixtureSectionRoute('/api/pages/page-1/sections', 'PUT', origin)).toBeNull();
  });
});
