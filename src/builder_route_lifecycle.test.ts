import { describe, it, expect } from 'vitest';
import { normalizeRoutePath, RESERVED_APPLICATION_PATHS } from './builder_route_lifecycle';

describe('builder_route_lifecycle - Canonical Path Normalization & Validation', () => {
  it('normalizes valid paths cleanly', () => {
    const res1 = normalizeRoutePath('services');
    expect(res1.valid).toBe(true);
    expect(res1.normalizedPath).toBe('/services');

    const res2 = normalizeRoutePath('/about-us');
    expect(res2.valid).toBe(true);
    expect(res2.normalizedPath).toBe('/about-us');

    const res3 = normalizeRoutePath('Services/Driveway-Cleaning/');
    expect(res3.valid).toBe(true);
    expect(res3.normalizedPath).toBe('/services/driveway-cleaning');

    const res4 = normalizeRoutePath('   ///residential//gutter-cleaning///   ');
    expect(res4.valid).toBe(true);
    expect(res4.normalizedPath).toBe('/residential/gutter-cleaning');

    const res5 = normalizeRoutePath('contact_us');
    expect(res5.valid).toBe(true);
    expect(res5.normalizedPath).toBe('/contact_us');
  });

  it('rejects empty or whitespace-only paths', () => {
    expect(normalizeRoutePath('').valid).toBe(false);
    expect(normalizeRoutePath('   ').valid).toBe(false);
    expect(normalizeRoutePath(null).valid).toBe(false);
    expect(normalizeRoutePath(undefined).valid).toBe(false);
  });

  it('strictly protects root route "/" with ROOT_ROUTE_RESERVED error', () => {
    const res = normalizeRoutePath('/');
    expect(res.valid).toBe(false);
    expect(res.isRoot).toBe(true);
    expect(res.errorCode).toBe('ROOT_ROUTE_RESERVED');
    expect(res.error).toContain('Root route "/" is reserved');

    const resTrailing = normalizeRoutePath('///');
    expect(resTrailing.valid).toBe(false);
    expect(resTrailing.isRoot).toBe(true);
    expect(resTrailing.errorCode).toBe('ROOT_ROUTE_RESERVED');
  });

  it('rejects reserved system and application paths', () => {
    for (const reserved of RESERVED_APPLICATION_PATHS) {
      if (reserved === '/') continue; // Tested separately
      const res = normalizeRoutePath(reserved);
      expect(res.valid).toBe(false);
      expect(res.isReserved).toBe(true);
      expect(res.errorCode).toBe('RESERVED_PATH');
    }

    // Prefixed reserved paths
    expect(normalizeRoutePath('/api/v1/users').valid).toBe(false);
    expect(normalizeRoutePath('/preview/custom').valid).toBe(false);
    expect(normalizeRoutePath('/builder/editor').valid).toBe(false);
    expect(normalizeRoutePath('/dashboard/sites').valid).toBe(false);
    expect(normalizeRoutePath('/_next/data').valid).toBe(false);
    expect(normalizeRoutePath('/.well-known/acme').valid).toBe(false);
  });

  it('rejects query parameters, fragments, and percent-encoding', () => {
    const query = normalizeRoutePath('/services?utm_source=google');
    expect(query.valid).toBe(false);
    expect(query.errorCode).toBe('INVALID_PATH');

    const fragment = normalizeRoutePath('/services#pricing');
    expect(fragment.valid).toBe(false);
    expect(fragment.errorCode).toBe('INVALID_PATH');

    const percent = normalizeRoutePath('/services%20clean');
    expect(percent.valid).toBe(false);
    expect(percent.errorCode).toBe('INVALID_PATH');
  });

  it('rejects path traversal and invalid characters', () => {
    const traversal1 = normalizeRoutePath('/services/../about');
    expect(traversal1.valid).toBe(false);
    expect(traversal1.errorCode).toBe('INVALID_PATH');

    const traversal2 = normalizeRoutePath('/./services');
    expect(traversal2.valid).toBe(false);
    expect(traversal2.errorCode).toBe('INVALID_PATH');

    const invalidChars = normalizeRoutePath('/services<script>');
    expect(invalidChars.valid).toBe(false);
    expect(invalidChars.errorCode).toBe('INVALID_PATH');
  });

  it('rejects paths exceeding maximum length of 256 characters', () => {
    const longSegment = 'a'.repeat(300);
    const res = normalizeRoutePath(`/${longSegment}`);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe('INVALID_PATH');
    expect(res.error).toContain('maximum allowed length');
  });
});
