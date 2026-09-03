import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const migration = readFileSync(new URL('../supabase/migrations/20260901110000_create_issued_invoice_pdf_artifacts.sql', import.meta.url), 'utf8');
describe('DOC-1B2 artifact migration boundary', () => {
  it('keeps one immutable, tenant-scoped artifact per frozen document spec', () => { expect(migration).toContain('unique (invoice_document_spec_id)'); expect(migration).toContain("status in ('pending', 'ready')"); expect(migration).toContain("mime_type = 'application/pdf'"); expect(migration).toContain("object_path,mime_type)"); expect(migration).toContain("'application/pdf') returning"); expect(migration).toContain('pg_advisory_xact_lock'); });
  it('keeps claim and finalization server-only', () => { expect(migration).toContain('revoke all on function public.claim_issued_invoice_pdf_artifact(text,uuid) from public, anon, authenticated'); expect(migration).toContain('grant execute on function public.claim_issued_invoice_pdf_artifact(text,uuid) to service_role'); expect(migration).toContain('revoke all on public.invoice_document_artifacts from public, anon, authenticated'); });
});
