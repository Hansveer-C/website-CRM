import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  '../supabase/migrations/20260901090000_create_tenant_business_identity.sql', import.meta.url
)), 'utf8').toLowerCase();

describe('tenant business identity migration', () => {
  it('creates exactly one canonical issuer identity per tenant, independent of websites', () => {
    expect(migration).toContain('create table public.tenant_business_identities');
    expect(migration).toContain('user_id text primary key');
    expect(migration).toContain('business_name text not null');
    expect(migration).not.toContain('website_id uuid');
    expect(migration).not.toContain('tax_id');
    expect(migration).not.toContain('payment_terms');
  });

  it('uses owner-only RLS and explicit authenticated grants', () => {
    expect(migration).toContain('alter table public.tenant_business_identities enable row level security');
    expect(migration).toContain('tenant_business_identities_owner_select');
    expect(migration).toContain('tenant_business_identities_owner_insert');
    expect(migration).toContain('tenant_business_identities_owner_update');
    expect(migration).toContain('with check (user_id = (select auth.uid())::text)');
    expect(migration).toContain('revoke all on table public.tenant_business_identities from public, anon, authenticated');
    expect(migration).toContain('grant select, insert, update on table public.tenant_business_identities to authenticated');
  });

  it('seeds only unambiguous single-settings tenants and never chooses among multiple websites', () => {
    expect(migration).toContain('with unambiguous_settings as');
    expect(migration).toContain('having count(*) = 1');
    expect(migration).toContain('intentionally left incomplete');
  });
});
