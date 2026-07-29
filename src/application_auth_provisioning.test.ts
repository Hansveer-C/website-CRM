import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(new URL(
  '../supabase/migrations/20260729173233_provision_supabase_auth_users.sql',
  import.meta.url
));
const migration = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('Supabase Auth application-profile provisioning migration', () => {
  it('derives every profile identity from the inserted auth user', () => {
    expect(migration).toContain('after insert on auth.users');
    expect(migration).toContain("values (new.id::text, lower(btrim(new.email)), '$supabase-auth-managed$')");
    expect(migration).not.toMatch(/current_setting|request\.jwt|auth\.uid\(\)/);
  });

  it('populates every required public.users field and remains idempotent', () => {
    expect(migration).toContain('insert into public.users (id, email, password_hash)');
    expect(migration).toContain('on conflict (id) do nothing');
    expect(migration).toContain("errcode = '23502'");
  });

  it('uses a least-privilege security-definer function with a fixed search path', () => {
    expect(migration).toContain('create schema if not exists private');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('revoke all on function private.provision_application_user() from public, anon, authenticated');
    expect(migration).not.toMatch(/grant\s+execute/);
  });

  it('does not add anonymous profile writes or create unrelated tenant records', () => {
    expect(migration).not.toMatch(/create\s+policy/);
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)/);
    expect(migration).not.toMatch(/insert\s+into\s+public\.(websites|funnels|pages|page_sections|contacts|opportunities|media|builder_)/);
  });
});
