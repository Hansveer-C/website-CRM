import { describe, expect, it } from 'vitest';
import { isValidLocalSeoIdempotencyKey, validateLocalSeoGenerationInput } from './local_seo_generation_contract';

describe('Local SEO generation contract', () => {
  const website_id = '11111111-1111-4111-8111-111111111111';
  it('canonicalizes valid explicit Website input', () => {
    expect(validateLocalSeoGenerationInput({ website_id, services: [' Driveway Cleaning '], cities: ['Port Moody'] })).toEqual({ success: true, data: { website_id, services: ['Driveway Cleaning'], cities: ['Port Moody'] } });
  });
  it('rejects duplicate, blank, malformed, and unbounded requests', () => {
    expect(validateLocalSeoGenerationInput({ website_id, services: ['Wash', ' wash '], cities: ['Port Moody'] }).success).toBe(false);
    expect(validateLocalSeoGenerationInput({ website_id: 'foreign', services: ['Wash'], cities: ['Port Moody'] }).success).toBe(false);
    expect(validateLocalSeoGenerationInput({ website_id, services: Array.from({ length: 12 }, (_, i) => `S${i}`), cities: Array.from({ length: 12 }, (_, i) => `C${i}`) }).success).toBe(false);
  });
  it('validates durable idempotency keys', () => {
    expect(isValidLocalSeoIdempotencyKey('local-seo:1234567890')).toBe(true);
    expect(isValidLocalSeoIdempotencyKey('short')).toBe(false);
  });
});
