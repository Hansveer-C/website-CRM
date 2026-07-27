import { describe, expect, it } from 'vitest';
import {
  getBuilderSetupContrastRatio,
  isDurableBuilderSetupAssetUrl,
  normalizeBuilderSetupBrief,
  parseBuilderSetupBrief,
  sanitizeBuilderSetupBrief,
  validateBuilderSetupBrief,
  type BuilderSetupBriefV1
} from './builder_setup_brief';
import { validBuilderSetupBrief } from './builder_setup_test_helpers';

describe('Builder setup brief', () => {
  it('parses and normalizes a valid v1 brief without mutation', () => {
    const source = validBuilderSetupBrief();
    const before = structuredClone(source);
    const parsed = parseBuilderSetupBrief(source, { activePageId: 'page-1', activeWebsiteId: 'site-1' });
    expect(source).toEqual(before);
    expect(parsed?.publicEmail).toBe('Hello@example.com');
    expect(parsed?.primaryColor).toBe('#2563eb');
  });

  it('rejects unknown schema versions and malformed stored values', () => {
    expect(parseBuilderSetupBrief({ ...validBuilderSetupBrief(), schemaVersion: 2 })).toBeNull();
    expect(parseBuilderSetupBrief({ schemaVersion: 1 })).toBeNull();
  });

  it.each([
    ['businessName', '', 'required'],
    ['businessName', 'Bad\u0000Name', 'control-character'],
    ['positioningStatement', 'x'.repeat(221), 'too-long']
  ] as const)('validates %s', (field, value, code) => {
    const brief = { ...validBuilderSetupBrief(), [field]: value };
    expect(validateBuilderSetupBrief(brief).some(issue => issue.code === code)).toBe(true);
  });

  it('accepts Unicode names and normalizes whitespace and service area', () => {
    const normalized = normalizeBuilderSetupBrief({ ...validBuilderSetupBrief(), businessName: '  Éclat 清洗  ', serviceArea: '  Tri-Cities   and Burnaby ' });
    expect(normalized.businessName).toBe('Éclat 清洗');
    expect(normalized.serviceArea).toBe('Tri-Cities and Burnaby');
  });

  it.each([
    ['publicPhone', 'abc', 'invalid-phone'],
    ['publicEmail', 'bad@address', 'invalid-email'],
    ['customerType', 'other', 'invalid-option'],
    ['primaryGoal', 'buy-now', 'invalid-option'],
    ['stylePreset', 'neon', 'invalid-option']
  ] as const)('rejects invalid %s values', (field, value, code) => {
    expect(validateBuilderSetupBrief({ ...validBuilderSetupBrief(), [field]: value } as BuilderSetupBriefV1).some(issue => issue.code === code)).toBe(true);
  });

  it('requires one through twelve unique services and a selected primary service', () => {
    expect(validateBuilderSetupBrief({ ...validBuilderSetupBrief(), services: [] }).some(issue => issue.code === 'required')).toBe(true);
    expect(validateBuilderSetupBrief({ ...validBuilderSetupBrief(), services: Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, label: `Service ${i}` })) }).some(issue => issue.code === 'too-many')).toBe(true);
    expect(validateBuilderSetupBrief({ ...validBuilderSetupBrief(), services: [{ id: 'a', label: ' Wash ' }, { id: 'b', label: 'wash' }], primaryServiceId: 'a' }).some(issue => issue.code === 'duplicate-service')).toBe(true);
    expect(validateBuilderSetupBrief({ ...validBuilderSetupBrief(), primaryServiceId: 'missing' }).some(issue => issue.code === 'not-selected')).toBe(true);
  });

  it('defaults every unconfirmed trust signal to false', () => {
    const normalized = normalizeBuilderSetupBrief({ ...validBuilderSetupBrief(), trustSignals: { insured: true } as BuilderSetupBriefV1['trustSignals'] });
    expect(normalized.trustSignals.insured).toBe(true);
    expect(normalized.trustSignals.workplaceCoverage).toBe(false);
  });

  it.each([
    [{ yearsInBusiness: 0 }, 'invalid-years'],
    [{ reviewRating: 6, reviewCount: 3 }, 'invalid-rating'],
    [{ reviewRating: 4.8, reviewCount: 0 }, 'invalid-review-count'],
    [{ customTrustStatement: 'x'.repeat(141) }, 'too-long']
  ])('validates trust evidence', (patch, code) => {
    expect(validateBuilderSetupBrief({ ...validBuilderSetupBrief(), ...patch }).some(issue => issue.code === code)).toBe(true);
  });

  it('normalizes colors and detects indistinguishable combinations', () => {
    const brief = normalizeBuilderSetupBrief(validBuilderSetupBrief());
    expect(brief.primaryColor).toBe('#2563eb');
    expect(getBuilderSetupContrastRatio('#000000', '#ffffff')).toBeGreaterThan(20);
    expect(validateBuilderSetupBrief({ ...brief, primaryColor: '#111111', accentColor: '#121212' }).some(issue => issue.code === 'insufficient-distinction')).toBe(true);
  });

  it('accepts durable HTTPS URLs and rejects temporary or signed URLs', () => {
    expect(isDurableBuilderSetupAssetUrl('https://example.com/image.jpg')).toBe(true);
    expect(isDurableBuilderSetupAssetUrl('blob:local')).toBe(false);
    expect(isDurableBuilderSetupAssetUrl('https://example.com/image.jpg?token=secret')).toBe(false);
    expect(isDurableBuilderSetupAssetUrl("https://example.com/image'.jpg")).toBe(false);
    expect(isDurableBuilderSetupAssetUrl('https://user:secret@example.com/image.jpg')).toBe(false);
  });

  it('enforces asset scope, durability, alt text, and gallery limit', () => {
    const asset = { id: 'asset-1', websiteId: 'site-2', publicUrl: 'blob:local', altText: 'x'.repeat(201) };
    const issues = validateBuilderSetupBrief({ ...validBuilderSetupBrief(), heroAsset: asset, galleryAssets: Array(7).fill(asset) }, { activeWebsiteId: 'site-1' });
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['foreign-asset', 'temporary-asset-url', 'invalid-alt-text', 'too-many-gallery-assets']));
  });

  it('sanitized build brief exposes only its explicit allowlist', () => {
    const source = { ...validBuilderSetupBrief(), user_id: 'private', token: 'secret' } as BuilderSetupBriefV1;
    const sanitized = sanitizeBuilderSetupBrief(source);
    expect(sanitized).not.toHaveProperty('user_id');
    expect(sanitized).not.toHaveProperty('token');
  });
});
