import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL(
  '../supabase/migrations/20260812144447_backfill_supabase_auth_user_profiles.sql',
  import.meta.url
)), 'utf8').toLowerCase();

describe('existing Supabase Auth profile forward backfill', () => {
  it('derives identity only from auth.users and inserts only missing IDs', () => {
    expect(migration).toContain('auth_user.id::text');
    expect(migration).toContain('left join public.users application_user on application_user.id = auth_user.id::text');
    expect(migration).toContain('where application_user.id is null');
    expect(migration).toContain("'$supabase-auth-managed$'");
    expect(migration).not.toMatch(/update\s+public\.users|delete\s+from\s+public\.users|update\s+auth\.users|delete\s+from\s+auth\.users/);
  });

  it('fails closed for normalized same-email/different-ID collisions and unusable missing emails', () => {
    expect(migration).toContain('lower(btrim(application_user.email)) = lower(btrim(auth_user.email))');
    expect(migration).toContain('application_user.id <> auth_user.id::text');
    expect(migration).toContain('supabase auth profile backfill found an email identity collision');
    expect(migration).toContain('supabase auth profile backfill requires a usable email');
  });

  it('does not replace or reinstall the future-signup trigger', () => {
    expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?function\s+private\.provision_application_user/);
    expect(migration).not.toMatch(/(create|drop)\s+trigger/);
  });
});
