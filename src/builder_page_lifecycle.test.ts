import { describe, expect, it } from 'vitest';
import type { Page, PageSection } from './types';
import {
  createDuplicatePageDefaults,
  generateDuplicatePageName,
  generateDuplicatePageSlug,
  isExpectedDuplicatedPage
} from './builder_page_lifecycle';

describe('generateDuplicatePageName', () => {
  it('generates "Name (Copy)" when no copy exists', () => {
    expect(generateDuplicatePageName('Services', [])).toBe('Services (Copy)');
    expect(generateDuplicatePageName('About Us', ['Home', 'Contact'])).toBe('About Us (Copy)');
  });

  it('increments copy number when "Name (Copy)" already exists', () => {
    expect(generateDuplicatePageName('Services', ['Services', 'Services (Copy)'])).toBe('Services (Copy 2)');
    expect(generateDuplicatePageName('Services', ['Services', 'Services (Copy)', 'Services (Copy 2)'])).toBe('Services (Copy 3)');
  });

  it('handles source names that already end in (Copy) or (Copy N)', () => {
    expect(generateDuplicatePageName('Services (Copy)', ['Services (Copy)'])).toBe('Services (Copy 2)');
    expect(generateDuplicatePageName('Services (Copy 2)', ['Services (Copy 2)', 'Services (Copy 3)'])).toBe('Services (Copy 4)');
  });

  it('handles blank or untitled source name', () => {
    expect(generateDuplicatePageName('', [])).toBe('Untitled page (Copy)');
  });

  it('reserves suffix capacity for max-length 120-char name', () => {
    const longName = 'A'.repeat(120);
    const copy1 = generateDuplicatePageName(longName, []);
    expect(copy1.length).toBe(120);
    expect(copy1).toBe(`${'A'.repeat(113)} (Copy)`);

    const copy2 = generateDuplicatePageName(longName, [copy1]);
    expect(copy2.length).toBe(120);
    expect(copy2).toBe(`${'A'.repeat(111)} (Copy 2)`);
  });
});

describe('generateDuplicatePageSlug', () => {
  it('generates "slug-copy" when no copy exists', () => {
    expect(generateDuplicatePageSlug('services', [])).toBe('services-copy');
    expect(generateDuplicatePageSlug('about-us', ['home', 'contact'])).toBe('about-us-copy');
  });

  it('increments copy number when "slug-copy" already exists', () => {
    expect(generateDuplicatePageSlug('services', ['services', 'services-copy'])).toBe('services-copy-2');
    expect(generateDuplicatePageSlug('services', ['services', 'services-copy', 'services-copy-2'])).toBe('services-copy-3');
  });

  it('handles source slugs that already end in -copy or -copy-N', () => {
    expect(generateDuplicatePageSlug('services-copy', ['services-copy'])).toBe('services-copy-2');
    expect(generateDuplicatePageSlug('services-copy-2', ['services-copy-2', 'services-copy-3'])).toBe('services-copy-4');
  });

  it('normalizes uppercase or untrimmed slugs', () => {
    expect(generateDuplicatePageSlug('/SERVICES///', [])).toBe('services-copy');
  });

  it('reserves suffix capacity for max-length 120-char slug', () => {
    const longSlug = 'b'.repeat(120);
    const copy1 = generateDuplicatePageSlug(longSlug, []);
    expect(copy1.length).toBe(120);
    expect(copy1).toBe(`${'b'.repeat(115)}-copy`);

    const copy2 = generateDuplicatePageSlug(longSlug, [copy1]);
    expect(copy2.length).toBe(120);
    expect(copy2).toBe(`${'b'.repeat(113)}-copy-2`);
  });
});

describe('createDuplicatePageDefaults', () => {
  const sourcePage: Page = {
    id: 'source-page-id',
    user_id: 'owner-1',
    name: 'Driveway Cleaning',
    slug: 'driveway-cleaning',
    status: 'published',
    seo_title: 'Driveway Cleaning in Seattle',
    seo_description: 'Top rated driveway washing.',
    seo_keywords: ['driveway', 'pressure washing'],
    schema_markup: '<script type="application/ld+json">{}</script>',
    created_at: '2026-01-01T00:00:00.000Z',
    funnel_id: 'funnel-1',
    step_type: 'landing',
    step_order: 1
  };

  const sourceSections: PageSection[] = [
    {
      id: 'sec-hero',
      page_id: 'source-page-id',
      type: 'hero',
      content: { heading: 'Clean Driveways', sub: 'Best in town' },
      styles: { background: '#ffffff', visible: true },
      order: 0,
      variant: 'split'
    },
    {
      id: 'sec-services',
      page_id: 'source-page-id',
      type: 'services', // legacy type
      content: { items: ['Wash', 'Seal'] },
      styles: { padding: '20px' },
      order: 1
    }
  ];

  it('duplicates page with fresh ID, draft status, and preserved metadata including schema_markup', () => {
    const result = createDuplicatePageDefaults({
      sourcePage,
      sourceSections,
      existingPages: [sourcePage],
      actingUserId: 'owner-1',
      newPageId: 'new-page-uuid',
      now: () => '2026-08-16T12:00:00.000Z'
    });

    expect(result.page).toEqual({
      id: 'new-page-uuid',
      user_id: 'owner-1',
      name: 'Driveway Cleaning (Copy)',
      slug: 'driveway-cleaning-copy',
      status: 'draft', // Never published
      seo_title: 'Driveway Cleaning in Seattle',
      seo_description: 'Top rated driveway washing.',
      seo_keywords: ['driveway', 'pressure washing'],
      schema_markup: '<script type="application/ld+json">{}</script>',
      created_at: '2026-08-16T12:00:00.000Z',
      funnel_id: 'funnel-1',
      step_type: 'landing',
      step_order: 2 // Next step order in funnel
    });
  });

  it('deep clones every section with new unique IDs and preserves relative order/content/styles without funnel_id', () => {
    let generatedIdCount = 0;
    const generateSectionId = () => `new-sec-${++generatedIdCount}`;

    const result = createDuplicatePageDefaults({
      sourcePage,
      sourceSections,
      existingPages: [sourcePage],
      actingUserId: 'owner-1',
      newPageId: 'new-page-uuid',
      generateSectionId
    });

    expect(result.sections).toHaveLength(2);

    expect(result.sections[0]).toEqual({
      id: 'new-sec-1',
      page_id: 'new-page-uuid',
      type: 'hero',
      content: { heading: 'Clean Driveways', sub: 'Best in town' },
      styles: { background: '#ffffff', visible: true },
      order: 0,
      variant: 'split'
    });

    expect(result.sections[1]).toEqual({
      id: 'new-sec-2',
      page_id: 'new-page-uuid',
      type: 'services',
      content: { items: ['Wash', 'Seal'] },
      styles: { padding: '20px' },
      order: 1
    });

    // Verify source section IDs are NEVER reused
    expect(result.sections[0].id).not.toBe(sourceSections[0].id);
    expect(result.sections[1].id).not.toBe(sourceSections[1].id);

    // Verify deep clone (modifying source doesn't mutate copy)
    (sourceSections[0].content as any).heading = 'Mutated';
    expect(result.sections[0].content.heading).toBe('Clean Driveways');
  });

  it('accepts explicit custom name and slug overrides', () => {
    const result = createDuplicatePageDefaults({
      sourcePage,
      sourceSections: [],
      existingPages: [sourcePage],
      actingUserId: 'owner-1',
      newPageId: 'new-page-uuid',
      name: 'Custom Clone',
      slug: 'custom-clone'
    });

    expect(result.page.name).toBe('Custom Clone');
    expect(result.page.slug).toBe('custom-clone');
  });

  it('verifies isExpectedDuplicatedPage contract', () => {
    const expected = createDuplicatePageDefaults({
      sourcePage,
      sourceSections: [],
      existingPages: [sourcePage],
      actingUserId: 'owner-1',
      newPageId: 'new-page-uuid'
    }).page;

    expect(isExpectedDuplicatedPage({ ...expected }, expected)).toBe(true);
    expect(isExpectedDuplicatedPage({ ...expected, status: 'published' }, expected)).toBe(false);
    expect(isExpectedDuplicatedPage({ ...expected, id: 'wrong-id' }, expected)).toBe(false);
    expect(isExpectedDuplicatedPage({ ...expected, user_id: 'wrong-user' }, expected)).toBe(false);
    expect(isExpectedDuplicatedPage({ ...expected, funnel_id: 'other-funnel' }, expected)).toBe(false);
  });
});
