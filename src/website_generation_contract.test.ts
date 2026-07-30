import { describe, expect, it } from 'vitest';
import {
  isValidWebsiteGenerationIdempotencyKey,
  isWebsiteGenerationResponse,
  validateWebsiteGenerationInput
} from './website_generation_contract';

const valid = { business_name: ' Acme   Wash ', phone_number: ' (555) 123-4567 ', city: ' Austin,  TX ', services: ['House Washing'] };

describe('website generation contract', () => {
  it('normalizes whitespace', () => expect(validateWebsiteGenerationInput(valid)).toEqual({ success: true, data: { business_name: 'Acme Wash', phone_number: '(555) 123-4567', city: 'Austin, TX', services: ['House Washing'] } }));
  it('rejects non-objects', () => expect(validateWebsiteGenerationInput(null).success).toBe(false));
  it('rejects arrays', () => expect(validateWebsiteGenerationInput([]).success).toBe(false));
  it('rejects unknown fields', () => expect(validateWebsiteGenerationInput({ ...valid, admin: true })).toMatchObject({ success: false, fields: { request: expect.stringContaining('admin') } }));
  it('requires a business name', () => expect(validateWebsiteGenerationInput({ ...valid, business_name: ' ' }).success).toBe(false));
  it('limits business names', () => expect(validateWebsiteGenerationInput({ ...valid, business_name: 'x'.repeat(121) }).success).toBe(false));
  it('requires a phone', () => expect(validateWebsiteGenerationInput({ ...valid, phone_number: '' }).success).toBe(false));
  it('rejects invalid phone characters', () => expect(validateWebsiteGenerationInput({ ...valid, phone_number: 'call-me-now' }).success).toBe(false));
  it('requires a city', () => expect(validateWebsiteGenerationInput({ ...valid, city: '' }).success).toBe(false));
  it('limits cities', () => expect(validateWebsiteGenerationInput({ ...valid, city: 'x'.repeat(121) }).success).toBe(false));
  it('requires a services array', () => expect(validateWebsiteGenerationInput({ ...valid, services: 'Wash' }).success).toBe(false));
  it('requires a service', () => expect(validateWebsiteGenerationInput({ ...valid, services: [] }).success).toBe(false));
  it('limits service count', () => expect(validateWebsiteGenerationInput({ ...valid, services: Array.from({ length: 13 }, (_, i) => `S${i}`) }).success).toBe(false));
  it('rejects duplicate normalized services', () => expect(validateWebsiteGenerationInput({ ...valid, services: ['Wash', ' Wash '] }).success).toBe(false));
  it('rejects non-string services', () => expect(validateWebsiteGenerationInput({ ...valid, services: ['Wash', 1] }).success).toBe(false));
  it('limits service length', () => expect(validateWebsiteGenerationInput({ ...valid, services: ['x'.repeat(81)] }).success).toBe(false));
  it('accepts a strong idempotency key', () => expect(isValidWebsiteGenerationIdempotencyKey('website-create:1234567890')).toBe(true));
  it('rejects a short idempotency key', () => expect(isValidWebsiteGenerationIdempotencyKey('short')).toBe(false));
  it('rejects unsafe idempotency characters', () => expect(isValidWebsiteGenerationIdempotencyKey('website create key 123')).toBe(false));
  it('recognizes a typed success envelope', () => expect(isWebsiteGenerationResponse(successEnvelope())).toBe(true));
  it('rejects a success envelope without graph rows', () => expect(isWebsiteGenerationResponse({ success: true, data: {} })).toBe(false));
  it('recognizes a typed error envelope', () => expect(isWebsiteGenerationResponse({ success: false, error: { code: 'INVALID_INPUT', message: 'Bad' } })).toBe(true));
});

export function successEnvelope() {
  return { success: true, data: {
    website: { id: 'w', user_id: 'u', name: 'Acme', domain: null, subdomain: 'acme-u', homepage_funnel_id: 'f', created_at: 'now', updated_at: 'now' },
    settings: { id: 's', user_id: 'u', website_id: 'w', business_name: 'Acme', phone: '5551234567', email: '', logo_url: '', primary_color: '#2563eb', auto_lead_sms_enabled: true, auto_lead_sms_template: '', missed_call_sms_enabled: true, missed_call_sms_template: '', created_at: 'now' },
    route: { id: 'r', website_id: 'w', path: '/', funnel_id: 'f', created_at: 'now' },
    funnel: { id: 'f', user_id: 'u', name: 'Home', status: 'draft', created_at: 'now', updated_at: 'now' },
    page: { id: 'p', user_id: 'u', name: 'Home', slug: 'home', status: 'draft', seo_title: 'Acme', seo_description: 'Acme', seo_keywords: ['Wash'], created_at: 'now', funnel_id: 'f' },
    sections: [{ id: 'section', page_id: 'p', type: 'hero', content: {}, order: 0, styles: {} }], created: true, idempotency_key: 'website-create:1234567890'
  } };
}
