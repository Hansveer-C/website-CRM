import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(fileURLToPath(new URL('../supabase/migrations/20260901100000_create_issued_invoice_document_specs.sql', import.meta.url)), 'utf8').toLowerCase();
describe('immutable issued invoice document specification migration', () => {
  it('freezes one invoice specification without claiming a rendered artifact', () => {
    expect(sql).toContain('create table public.invoice_document_specs'); expect(sql).toContain('unique (invoice_id)'); expect(sql).toContain('specification jsonb not null'); expect(sql).toContain('specification_fingerprint'); expect(sql).not.toContain('pdf_mime'); expect(sql).not.toContain('object_path text');
  });
  it('uses a canonical issuer, private bucket, and narrow grants', () => {
    expect(sql).toContain("'commercial-documents', 'commercial-documents', false"); expect(sql).toContain('public.tenant_business_identities'); expect(sql).toContain("message = 'canonical business identity is required'"); expect(sql).not.toContain('website_settings'); expect(sql).toContain('revoke all on table public.invoice_document_specs');
  });
  it('serializes idempotent server-authoritative creation', () => {
    expect(sql).toContain('security definer'); expect(sql).toContain("set search_path = ''"); expect(sql).toContain("':invoice-document:'"); expect(sql).toContain('for update'); expect(sql).toContain("message = 'request key was already used'"); expect(sql).toContain('pg_catalog.md5(v_spec::text)');
  });
});
