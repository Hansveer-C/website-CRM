import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  '../supabase/migrations/20260831200000_create_crm_invoice_from_accepted_quote.sql',
  import.meta.url
)), 'utf8').toLowerCase();

describe('durable accepted-quote invoice migration', () => {
  it('creates tenant-owned issued invoices and immutable item evidence', () => {
    expect(migration).toContain('create table public.invoices');
    expect(migration).toContain("status text not null default 'issued' check (status = 'issued')");
    expect(migration).toContain('unique (quote_acceptance_id)');
    expect(migration).toContain('unique (user_id, invoice_number)');
    expect(migration).toContain('create table public.invoice_items');
    expect(migration).toContain('line_total numeric(12,2) generated always');
    expect(migration).toContain('foreign key (quote_acceptance_id, user_id)');
  });

  it('uses least-privilege RLS and a scoped privileged conversion RPC', () => {
    expect(migration).toContain('alter table public.invoices enable row level security');
    expect(migration).toContain('alter table public.invoice_items enable row level security');
    expect(migration).toContain('revoke all on table public.invoices, public.invoice_items from public, anon, authenticated');
    expect(migration).toContain('grant select on table public.invoices, public.invoice_items to authenticated');
    expect(migration).toContain('create or replace function public.create_invoice_from_accepted_quote');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('v_user_id text := auth.uid()::text');
    expect(migration).toContain('revoke all on function public.create_invoice_from_accepted_quote');
  });

  it('binds the issued invoice to immutable accepted evidence and serializes duplicate creation', () => {
    expect(migration).toContain('v_acceptance.quote_revision <> p_accepted_quote_revision');
    expect(migration).toContain("message = 'accepted total does not match selected items'");
    expect(migration).toContain("v_item ->> 'tier' <> v_selected_tier");
    expect(migration).toContain("':invoice-request:'");
    expect(migration).toContain("':invoice-number'");
    expect(migration).toContain('for update');
    expect(migration).toContain("v_issued_at + interval '7 days'");
  });
});
