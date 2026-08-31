import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  '../supabase/migrations/20260831190000_create_crm_quote_acceptance.sql',
  import.meta.url
)), 'utf8').toLowerCase();

describe('durable quote acceptance migration', () => {
  it('creates immutable acceptance evidence bound to a quote revision and replay key', () => {
    expect(migration).toContain('create table public.quote_acceptances');
    expect(migration).toContain('quote_revision integer not null');
    expect(migration).toContain('quote_snapshot jsonb not null');
    expect(migration).toContain('unique (quote_id)');
    expect(migration).toContain('unique (user_id, request_key)');
    expect(migration).toContain("acceptance_status text not null default 'accepted'");
  });

  it('keeps signature evidence private, bounded, PNG-only, and tenant-owned', () => {
    expect(migration).toContain('signature_bytes bytea');
    expect(migration).toContain("signature_mime_type = 'image/png'");
    expect(migration).toContain('octet_length(signature_bytes) between 8 and 1048576');
    expect(migration).toContain("v_signature_data_url !~ '^data:image/png;base64");
    expect(migration).toContain("decode('89504e470d0a1a0a', 'hex')");
    expect(migration).toContain('alter table public.quote_acceptances enable row level security');
    expect(migration).toContain('revoke all on table public.quote_acceptances from public, anon, authenticated');
  });

  it('uses a scoped privileged RPC with server-generated acceptance time and explicit conflicts', () => {
    expect(migration).toContain('create or replace function public.accept_crm_quote');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('v_user_id text := auth.uid()::text');
    expect(migration).toContain("message = 'quote revision conflict'");
    expect(migration).toContain("message = 'quote already accepted'");
    expect(migration).toContain('v_accepted_at timestamptz := statement_timestamp()');
    expect(migration).toContain('for update');
  });
});
