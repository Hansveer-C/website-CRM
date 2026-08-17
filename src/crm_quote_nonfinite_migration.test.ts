import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  '../supabase/migrations/20260812150626_reject_nonfinite_quote_amounts.sql',
  import.meta.url
)), 'utf8').toLowerCase();

describe('save_crm_quote non-finite forward hardening', () => {
  it('parses into local numeric variables and explicitly rejects special numeric values', () => {
    expect(migration).toContain('v_quantity numeric');
    expect(migration).toContain('v_unit_price numeric');
    expect(migration).toContain('v_line_total numeric');
    expect(migration).toContain("in ('nan', 'infinity', '-infinity')");
    expect(migration).toContain("when invalid_text_representation or numeric_value_out_of_range");
  });

  it('enforces numeric(12,2) line and aggregate boundaries before durable inserts', () => {
    const validation = migration.indexOf('v_line_total :=');
    const quoteInsert = migration.indexOf('insert into public.quotes');
    expect(migration).toContain('v_max_amount constant numeric := 9999999999.99');
    expect(validation).toBeGreaterThan(-1);
    expect(quoteInsert).toBeGreaterThan(validation);
    expect(migration).toContain("message = 'invalid quote total'");
  });

  it('preserves the privileged-function security contract', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('v_user_id text := auth.uid()::text');
    expect(migration).toContain('revoke all on function public.save_crm_quote(uuid, text, text, text, text, jsonb) from public, anon');
    expect(migration).toContain('grant execute on function public.save_crm_quote(uuid, text, text, text, text, jsonb) to authenticated');
  });
});
