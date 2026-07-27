import { describe, expect, it } from 'vitest';
import type { Page } from './types';
import {
  applyBuilderPageSettings,
  getBuilderPageSettingsDiff,
  normalizeBuilderPageSettings,
  normalizeBuilderPageSlug,
  pageToBuilderPageSettings,
  validateBuilderPageSettings
} from './builder_page_settings';

const page: Page & { future_field: { keep: boolean } } = {
  id: 'page-1', user_id: 'owner-1', name: 'Home', slug: 'home', status: 'draft',
  seo_title: 'Pressure Washing', seo_description: 'Exterior cleaning.', seo_keywords: ['cleaning'],
  created_at: '2026-07-26T00:00:00.000Z', funnel_id: 'funnel-1', step_order: 0,
  future_field: { keep: true }
};

describe('Builder Page Settings model', () => {
  it('converts a Page to only the editable settings', () => {
    expect(pageToBuilderPageSettings(page)).toEqual({
      name: 'Home', slug: 'home', seo_title: 'Pressure Washing', seo_description: 'Exterior cleaning.'
    });
    expect(pageToBuilderPageSettings(page)).not.toHaveProperty('id');
    expect(pageToBuilderPageSettings(page)).not.toHaveProperty('user_id');
    expect(pageToBuilderPageSettings(page)).not.toHaveProperty('funnel_id');
  });

  it('applies normalized editable fields without mutating inputs or losing unknown fields', () => {
    const original = structuredClone(page);
    const settings = { name: '  Café & Co.  ', slug: '/House__Wash/', seo_title: '  Local wash  ', seo_description: 'Line one\nline two' };
    const settingsOriginal = structuredClone(settings);
    const result = applyBuilderPageSettings(page, settings);
    expect(result).toMatchObject({ name: 'Café & Co.', slug: 'house-wash', seo_title: 'Local wash', seo_description: 'Line one line two' });
    expect((result as typeof page).future_field).toEqual({ keep: true });
    expect(result.id).toBe('page-1');
    expect(result.user_id).toBe('owner-1');
    expect(result.funnel_id).toBe('funnel-1');
    expect(page).toEqual(original);
    expect(settings).toEqual(settingsOriginal);
  });

  it('rejects blank names and accepts trimmed Unicode names', () => {
    const base = pageToBuilderPageSettings(page);
    expect(validateBuilderPageSettings({ ...base, name: '   ' }).some(issue => issue.field === 'name')).toBe(true);
    expect(validateBuilderPageSettings({ ...base, name: '  Nettoyage Élite — 温哥华  ' })).toEqual([]);
    expect(normalizeBuilderPageSettings({ ...base, name: '  Nettoyage Élite  ' }).name).toBe('Nettoyage Élite');
  });

  it('rejects control characters in editable text fields', () => {
    const base = pageToBuilderPageSettings(page);
    expect(validateBuilderPageSettings({ ...base, name: 'Bad\u0001name' }).some(issue => issue.code === 'control-character')).toBe(true);
    expect(validateBuilderPageSettings({ ...base, seo_title: 'Bad\u0002title' }).some(issue => issue.field === 'seo_title')).toBe(true);
    expect(validateBuilderPageSettings({ ...base, seo_description: 'Bad\u0003description' }).some(issue => issue.field === 'seo_description')).toBe(true);
  });

  it('normalizes slugs deterministically', () => {
    expect(normalizeBuilderPageSlug(' /House__Wash---Vancouver/ ')).toBe('house-wash-vancouver');
    expect(normalizeBuilderPageSlug('Driveway   Cleaning')).toBe('driveway-cleaning');
  });

  it.each([
    'https://example.com', 'page?query=1', 'page#fragment', '../admin', 'foo\\bar', 'café'
  ])('rejects unsafe slug %s', slug => {
    const issues = validateBuilderPageSettings({ ...pageToBuilderPageSettings(page), slug });
    expect(issues.some(issue => issue.field === 'slug')).toBe(true);
  });

  it('requires non-empty slugs and locks the verified homepage slug', () => {
    const base = pageToBuilderPageSettings(page);
    expect(validateBuilderPageSettings({ ...base, slug: '/' }).some(issue => issue.code === 'required')).toBe(true);
    expect(validateBuilderPageSettings({ ...base, slug: 'other' }, { isHomepage: true, originalSlug: 'home' })[0]?.code).toBe('homepage-slug-locked');
  });

  it('detects owner-scoped duplicate slugs supplied by context', () => {
    const issues = validateBuilderPageSettings(
      { ...pageToBuilderPageSettings(page), slug: 'services' },
      { existingSlugs: ['about', 'services'] }
    );
    expect(issues[0]).toMatchObject({ field: 'slug', code: 'duplicate-slug' });
  });

  it('normalizes SEO fields and enforces hard limits', () => {
    const base = pageToBuilderPageSettings(page);
    expect(normalizeBuilderPageSettings({ ...base, seo_title: '  A title  ', seo_description: ' First\r\n second ' })).toMatchObject({ seo_title: 'A title', seo_description: 'First second' });
    expect(validateBuilderPageSettings({ ...base, seo_title: 'a'.repeat(71) }).some(issue => issue.field === 'seo_title')).toBe(true);
    expect(validateBuilderPageSettings({ ...base, seo_description: 'a'.repeat(321) }).some(issue => issue.field === 'seo_description')).toBe(true);
    expect(validateBuilderPageSettings({ ...base, seo_title: '', seo_description: '' })).toEqual([]);
  });

  it('returns empty no-op diffs and allowlisted changed fields only', () => {
    const previous = pageToBuilderPageSettings(page);
    expect(getBuilderPageSettingsDiff(previous, { ...previous })).toEqual({});
    expect(getBuilderPageSettingsDiff(previous, { ...previous, name: 'Services', seo_title: 'SEO' })).toEqual({ name: 'Services', seo_title: 'SEO' });
  });
});
