import { describe, expect, it } from 'vitest';
import { createBuilderDocument, validateBuilderDocument } from './builder_document';
import { BUILDER_SECTION_REGISTRY } from './builder_section_registry';
import { generateBuilderSetupPlan, isBuilderSetupPlanCurrent } from './builder_template_generator';
import { validBuilderSetupBrief } from './builder_setup_test_helpers';

function document() {
  return createBuilderDocument({ id: 'page-1', user_id: 'user-1', name: 'Home', slug: 'home', status: 'draft', seo_title: '', seo_description: '', seo_keywords: [], created_at: '2026-01-01T00:00:00Z', funnel_id: 'funnel-1' }, []);
}

function ids() { let value = 0; return () => `id-${++value}`; }

describe('Builder template generator', () => {
  it('is deterministic with injected IDs and does not mutate inputs or registry defaults', () => {
    const brief = validBuilderSetupBrief();
    const current = document();
    const before = structuredClone({ brief, current, registry: BUILDER_SECTION_REGISTRY });
    const run = () => generateBuilderSetupPlan({ brief, currentDocument: current, targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'replace', createId: ids() });
    expect(run()).toEqual(run());
    expect({ brief, current, registry: BUILDER_SECTION_REGISTRY }).toEqual(before);
  });

  it.each([
    ['residential-lead-generation', ['hero', 'offer', 'faq', 'form']],
    ['commercial-strata', ['hero', 'offer', 'faq', 'form']],
    ['balanced-services', ['hero', 'offer', 'faq', 'form']],
    ['compact-quote-page', ['hero', 'offer', 'form', 'faq']]
  ] as const)('generates the %s sequence without unconfirmed proof or gallery', (templateId, expected) => {
    const plan = generateBuilderSetupPlan({ brief: { ...validBuilderSetupBrief(), templateId }, currentDocument: document(), targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'replace', createId: ids() });
    expect(plan.generatedDocument.sections.map(section => section.type)).toEqual(expected);
    expect(validateBuilderDocument(plan.generatedDocument)).toEqual([]);
  });

  it('includes only confirmed trust signals and durable selected assets', () => {
    const brief = validBuilderSetupBrief();
    brief.trustSignals.insured = true;
    brief.heroAsset = { id: 'hero-a', websiteId: 'site-1', publicUrl: 'https://cdn.example.com/hero.jpg', altText: 'Clean driveway' };
    brief.galleryAssets = [{ id: 'gallery-a', websiteId: 'site-1', publicUrl: 'https://cdn.example.com/work.jpg', altText: 'Patio project' }];
    const plan = generateBuilderSetupPlan({ brief, currentDocument: document(), targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'replace', createId: ids() });
    expect(plan.generatedDocument.sections.find(section => section.type === 'proof')?.content.title).toBe('Insured');
    expect(plan.generatedDocument.sections.find(section => section.type === 'hero')?.content.background_image).toBe(brief.heroAsset.publicUrl);
    expect(plan.generatedDocument.sections.find(section => section.type === 'gallery')?.content.items).toHaveLength(1);
  });

  it('preserves service order, supports form choices, and emits no trusted routing IDs or fabricated claims', () => {
    const brief = validBuilderSetupBrief();
    brief.services = [{ id: 'patio', label: 'Patio cleaning', custom: true }, { id: 'driveway-cleaning', label: 'Driveway cleaning' }];
    brief.primaryServiceId = 'patio';
    const plan = generateBuilderSetupPlan({ brief, currentDocument: document(), targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'replace', applySeoMetadata: true, createId: ids() });
    const serialized = JSON.stringify(plan);
    const form = plan.generatedDocument.sections.find(section => section.type === 'form')!;
    const serviceField = (form.content.fields as Array<Record<string, unknown>>).find(field => field.name === 'service_type');
    expect(serviceField?.options).toEqual(['Patio cleaning', 'Driveway cleaning']);
    expect(serialized).not.toMatch(/pipeline_id|owner_id|opportunity_id|contact_id|\$\d|#1|top-rated|award-winning/i);
    expect(plan.pageSettingsPatch?.seo_title?.length).toBeLessThanOrEqual(70);
  });

  it('encodes user-provided display copy before it reaches legacy HTML renderers', () => {
    const brief = validBuilderSetupBrief();
    brief.positioningStatement = '<img src=x onerror=alert(1)> Clean & local';
    const plan = generateBuilderSetupPlan({ brief, currentDocument: document(), targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'replace', createId: ids() });
    const heading = plan.generatedDocument.sections.find(section => section.type === 'hero')?.content.heading;
    expect(heading).toBe('&lt;img src=x onerror=alert(1)&gt; Clean &amp; local');
    expect(JSON.stringify(plan.generatedDocument.sections)).not.toContain('<img');
  });

  it('appends after unknown sections, normalizes order, and omits a duplicate visible form', () => {
    const current = document();
    current.sections.push({ id: 'custom', page_id: 'page-1', type: 'custom', order: 7, content: { unknown: true }, styles: {} });
    current.sections.push({ id: 'existing-form', page_id: 'page-1', type: 'form', order: 8, content: { fields: ['name', 'phone'] }, styles: { visible: true } });
    const plan = generateBuilderSetupPlan({ brief: validBuilderSetupBrief(), currentDocument: current, targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'append', createId: ids() });
    expect(plan.generatedDocument.sections.slice(0, 2).map(section => section.id)).toEqual(['custom', 'existing-form']);
    expect(plan.generatedDocument.sections.filter(section => section.type === 'form')).toHaveLength(1);
    expect(plan.generatedDocument.sections.map(section => section.order)).toEqual(plan.generatedDocument.sections.map((_, i) => i));
  });

  it('detects a stale plan after document, page, website, user, or asset changes', () => {
    const current = document();
    const plan = generateBuilderSetupPlan({ brief: validBuilderSetupBrief(), currentDocument: current, targetWebsiteId: 'site-1', actingUserId: 'user-1', mode: 'replace', createId: ids() });
    expect(isBuilderSetupPlanCurrent(plan, { document: current, websiteId: 'site-1', pageId: 'page-1', actingUserId: 'user-1', availableAssetIds: [] })).toBe(true);
    const changed = structuredClone(current); changed.page.name = 'Changed';
    expect(isBuilderSetupPlanCurrent(plan, { document: changed, websiteId: 'site-1', pageId: 'page-1', actingUserId: 'user-1' })).toBe(false);
    expect(isBuilderSetupPlanCurrent(plan, { document: current, websiteId: 'site-2', pageId: 'page-1', actingUserId: 'user-1' })).toBe(false);
  });
});
