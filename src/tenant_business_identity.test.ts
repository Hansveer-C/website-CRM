import { describe, expect, it, vi } from 'vitest';
import {
  normalizeTenantBusinessIdentity,
  saveTenantBusinessIdentity,
  TenantBusinessIdentityHydrator,
  validateTenantBusinessIdentity
} from './tenant_business_identity';

const row = {
  user_id: 'tenant-a', business_name: 'Wash Co', phone: '555-0100', email: 'hello@example.test',
  logo_url: 'https://cdn.example/logo.png', primary_color: '#123456',
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z'
};

function client(data: unknown | null, error: unknown | null = null) {
  const maybeSingle = vi.fn(async () => ({ data, error }));
  const where = vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle })) }));
  return { where, from: vi.fn(() => ({ select: vi.fn(() => ({ eq: where })) })) };
}

describe('Tenant business identity contract', () => {
  it('accepts only bounded document-issuer fields and does not add tax or payment settings', () => {
    expect(validateTenantBusinessIdentity({ ...row })).toEqual({
      business_name: 'Wash Co', phone: '555-0100', email: 'hello@example.test',
      logo_url: 'https://cdn.example/logo.png', primary_color: '#123456'
    });
    expect(validateTenantBusinessIdentity({ ...row, business_name: ' ', email: 'not-an-email' })).toBeNull();
    expect(validateTenantBusinessIdentity({ ...row, logo_url: 'javascript:alert(1)' })).toBeNull();
    expect(validateTenantBusinessIdentity({ ...row, primary_color: '#12345g' })).toBeNull();
  });

  it('normalizes only the authenticated tenant row and preserves a missing identity as incomplete', () => {
    expect(normalizeTenantBusinessIdentity(row, 'tenant-a')).toMatchObject({ user_id: 'tenant-a', business_name: 'Wash Co' });
    expect(normalizeTenantBusinessIdentity({ ...row, user_id: 'tenant-b' }, 'tenant-a')).toBeNull();
    expect(normalizeTenantBusinessIdentity(null, 'tenant-a')).toBeNull();
  });

  it('uses a tenant-only field whitelist and never reads a website identifier', async () => {
    const source = client(row);
    const hydrator = new TenantBusinessIdentityHydrator(async () => source);
    await expect(hydrator.hydrate('tenant-a')).resolves.toMatchObject({ business_name: 'Wash Co' });
    expect(source.from).toHaveBeenCalledWith('tenant_business_identities');
    expect(source.where).toHaveBeenCalledWith('user_id', 'tenant-a');
  });

  it('writes only validated issuer fields under the authenticated tenant identity', async () => {
    const single = vi.fn(async () => ({ data: row, error: null }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const source = { from: vi.fn(() => ({ upsert })) };
    await expect(saveTenantBusinessIdentity(source, 'tenant-a', row)).resolves.toMatchObject({ user_id: 'tenant-a' });
    expect(source.from).toHaveBeenCalledWith('tenant_business_identities');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'tenant-a', business_name: 'Wash Co', primary_color: '#123456'
    }), { onConflict: 'user_id' });
    expect(JSON.stringify(upsert.mock.calls[0][0])).not.toContain('website_id');
    await expect(saveTenantBusinessIdentity(source, '', row)).resolves.toBeNull();
  });

  it('fails closed for malformed, unavailable, or superseded identity reads', async () => {
    const malformed = new TenantBusinessIdentityHydrator(async () => client({ ...row, primary_color: 'blue' }));
    await expect(malformed.hydrate('tenant-a')).resolves.toBeNull();
    const unavailable = new TenantBusinessIdentityHydrator(async () => null);
    await expect(unavailable.hydrate('tenant-a')).resolves.toBeNull();
  });
});
