import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBuilderDocument, builderDocumentToPageSections } from './builder_document';
import { validatePageSectionSaveRequest } from './page_section_save_contract';
import type { Page, PageSection } from './types';

const generatorSource = readFileSync(new URL('./website_generator_service.ts', import.meta.url), 'utf8');
const page: Page = {
  id: 'legacy-page', user_id: 'user-1', name: 'Legacy', slug: 'legacy', status: 'draft',
  seo_title: '', seo_description: '', seo_keywords: [], schema_markup: '',
  created_at: '2026-08-16T00:00:00.000Z', funnel_id: 'funnel-1', step_type: 'landing', step_order: 0
};

function generatedSectionShape(methodName: string): Array<{ type: string; order: number }> {
  const start = generatorSource.indexOf(`async ${methodName}(`);
  const end = generatorSource.indexOf('for (const s of sections)', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return [...generatorSource.slice(start, end).matchAll(/type:\s*'([^']+)',\s*\r?\n\s*order:\s*(\d+)/g)]
    .map(match => ({ type: match[1], order: Number(match[2]) }));
}

describe('actual legacy generator Builder compatibility', () => {
  it.each(['createHomepageSections', 'createServiceSpecificSections', 'createContactSections', 'createSeoSpecificSections'])(
    'normalizes and validates the real one-based %s fixture shape without loss',
    methodName => {
      const generated = generatedSectionShape(methodName);
      const sections: PageSection[] = generated.map(({ type, order }) => ({
        id: `${methodName}-${type}`,
        page_id: page.id,
        funnel_id: page.funnel_id,
        type,
        order,
        content: { legacyType: type, nested: { order, retained: true } },
        styles: { legacyStyle: { type }, visible: true }
      }));
      const document = createBuilderDocument(page, sections);
      const persisted = builderDocumentToPageSections(document);

      expect(generated.map(item => item.order)).toEqual(generated.map((_, index) => index + 1));
      expect(persisted.map(section => section.order)).toEqual(generated.map((_, index) => index));
      expect(persisted.map(section => section.id)).toEqual(sections.map(section => section.id));
      expect(persisted.map(section => section.content)).toEqual(sections.map(section => section.content));
      expect(persisted.map(section => section.styles)).toEqual(sections.map(section => section.styles));
      expect(validatePageSectionSaveRequest({ generation: 1, expected_revision: 0, sections: persisted }, page.id).success).toBe(true);
    }
  );

  it('covers all six real non-canonical legacy types', () => {
    const types = [
      ...generatedSectionShape('createHomepageSections'),
      ...generatedSectionShape('createServiceSpecificSections'),
      ...generatedSectionShape('createContactSections'),
      ...generatedSectionShape('createSeoSpecificSections')
    ].map(section => section.type);
    expect(new Set(types)).toEqual(new Set([
      'hero', 'proof', 'offer', 'form', 'faq',
      'services', 'benefits', 'before_after', 'cta', 'contact_info', 'map'
    ]));
  });
});
