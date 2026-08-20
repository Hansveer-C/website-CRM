import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.PAGE_DELETE_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050200_delete_builder_page.sql');
const PREVIOUS_MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050100_duplicate_builder_page.sql');

async function assertBackendWaiting(pool: pg.Pool, pid: number): Promise<void> {
  let waiting = false;
  for (let i = 0; i < 25; i++) {
    const lockRes = await pool.query(
      `select count(*) from pg_locks where pid = $1 and granted = false`,
      [pid]
    ).catch(() => null);
    if (lockRes && Number(lockRes.rows[0]?.count) > 0) {
      waiting = true;
      break;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  expect(waiting).toBe(true);
}

describeDatabase('delete_builder_page RPC Integration Tests (PostgreSQL 17)', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
    const client = await pool.connect();
    try {
      await client.query('begin');

      // Create required test roles if missing so suite is 100% self-contained
      await client.query(`
        do $$ begin create role anon; exception when duplicate_object then null; end $$;
        do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
        create extension if not exists "pgcrypto";
        do $$ begin create schema auth; exception when duplicate_schema then null; end $$;

        create table if not exists public.users (
          id text primary key,
          email text,
          created_at timestamptz default now()
        );

        create table if not exists public.funnels (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          status text not null default 'draft',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          service_type text,
          city text
        );

        create table if not exists public.pages (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          seo_title text,
          seo_description text,
          seo_keywords text[],
          created_at timestamptz not null default now(),
          funnel_id text references public.funnels(id) on delete cascade,
          step_type text,
          step_order integer
        );

        create table if not exists public.page_sections (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          type text not null,
          content jsonb not null default '{}'::jsonb,
          order_index integer not null default 0,
          styles jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        );

        create table if not exists public.websites (
          id uuid primary key default gen_random_uuid(),
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          homepage_funnel_id text references public.funnels(id) on delete set null,
          created_at timestamptz not null default now()
        );

        create schema if not exists private;

        -- Deployed schema parity: private.page_section_save_revisions
        create table if not exists private.page_section_save_revisions (
          page_id text not null primary key references public.pages(id) on delete cascade,
          user_id text not null references public.users(id) on delete cascade,
          revision bigint not null default 1,
          document_hash text not null default 'hash',
          updated_at timestamptz not null default now()
        );

        -- Deployed schema parity: public.builder_published_revisions
        create table if not exists public.builder_published_revisions (
          id uuid not null primary key default gen_random_uuid(),
          website_id uuid not null references public.websites(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          created_at timestamptz not null default now(),
          created_by text,
          schema_version smallint not null default 1,
          document jsonb not null default '{}'::jsonb,
          document_fingerprint text not null default 'fp',
          constraint builder_published_revisions_composite_key unique (website_id, page_id, id)
        );

        -- Deployed schema parity: public.builder_publication_targets (composite FK to revisions)
        create table if not exists public.builder_publication_targets (
          website_id uuid not null references public.websites(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          published_revision_id uuid not null,
          published_at timestamptz not null default now(),
          published_by text,
          primary key (website_id, page_id),
          foreign key (website_id, page_id, published_revision_id)
            references public.builder_published_revisions (website_id, page_id, id)
            on delete no action deferrable initially immediate
        );

        -- Deployed schema parity: public.public_lead_intake_requests
        create table if not exists public.public_lead_intake_requests (
          id uuid not null primary key default gen_random_uuid(),
          website_id uuid not null references public.websites(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          form_section_id text not null default 'sec-1',
          idempotency_key uuid not null default gen_random_uuid(),
          request_fingerprint text not null default 'fp',
          ip_hash text not null default 'ip',
          contact_hash text,
          contact_id text,
          opportunity_id text,
          status text not null default 'pending',
          created_at timestamptz not null default now(),
          completed_at timestamptz
        );

        create or replace function auth.uid() returns uuid as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$ language sql stable;
      `);

      const prevSql = readFileSync(PREVIOUS_MIGRATION_PATH, 'utf8');
      await client.query(prevSql);

      const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');
      await client.query(migrationSql);

      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('1. migration installs delete_builder_page with SECURITY DEFINER, search_path empty, and grants execute only to authenticated', async () => {
    const client = await pool.connect();
    try {
      const procRes = await client.query(`
        select prosecdef, proconfig
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'delete_builder_page';
      `);
      expect(procRes.rows.length).toBe(1);
      expect(procRes.rows[0].prosecdef).toBe(true);
      expect(procRes.rows[0].proconfig[0]).toMatch(/^search_path=(""|=)$/);

      const publicPriv = await client.query("select has_function_privilege('public', 'public.delete_builder_page(text)', 'execute') as has_priv");
      expect(publicPriv.rows[0].has_priv).toBe(false);

      const anonPriv = await client.query("select has_function_privilege('anon', 'public.delete_builder_page(text)', 'execute') as has_priv");
      expect(anonPriv.rows[0].has_priv).toBe(false);

      const authPriv = await client.query("select has_function_privilege('authenticated', 'public.delete_builder_page(text)', 'execute') as has_priv");
      expect(authPriv.rows[0].has_priv).toBe(true);
    } finally {
      client.release();
    }
  });

  it('2. production-shape regression assertion: public.pages does NOT contain schema_markup', async () => {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'pages'
          and column_name = 'schema_markup';
      `);
      expect(res.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });

  it('3. rejects unauthenticated calls', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("set local request.jwt.claim.sub = ''");
      await expect(
        client.query("select public.delete_builder_page('page-1')")
      ).rejects.toThrow(/Authentication required/);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('4. cross-tenant deletion rejects without leaking existence', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const u1 = '11111111-1111-4111-8111-111111111111';
      const u2 = '22222222-2222-4222-8222-222222222222';
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com'), ('${u2}', 'u2@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f1', '${u1}', 'F1'), ('f2', '${u2}', 'F2') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p1-u1', '${u1}', 'P1', 'p1', 'f1'),
          ('p2-u1', '${u1}', 'P2', 'p2', 'f1'),
          ('p1-u2', '${u2}', 'Other Page', 'other', 'f2')
        on conflict do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p1-u2')")
      ).rejects.toThrow(/Page not found/);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('5. corrupt funnel relationship (page owned by user A, funnel owned by user B) rejects with FORBIDDEN', async () => {
    const client = await pool.connect();
    try {
      const uA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const uB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      await client.query('begin');
      await client.query(`
        insert into public.users(id, email) values ('${uA}', 'ua@test.com'), ('${uB}', 'ub@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-corrupt', '${uB}', 'User B Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-corrupt', '${uA}', 'Corrupt Page', 'corrupt', 'f-corrupt')
        on conflict do nothing;
      `);
      await client.query('commit');

      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${uA}'`);
      await expect(
        client.query("select public.delete_builder_page('p-corrupt')")
      ).rejects.toThrow(/Corrupt or unowned funnel relationship/);
      await client.query('rollback');

      const check = await pool.query("select * from public.pages where id = 'p-corrupt'");
      expect(check.rows.length).toBe(1);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('6. enforces LAST_PAGE invariant: rejects deleting the only page in a funnel', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const u1 = '11111111-1111-4111-8111-111111111111';
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-single', '${u1}', 'Single Page Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values ('p-single', '${u1}', 'Lone Page', 'lone', 'f-single') on conflict do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-single')")
      ).rejects.toThrow(/Cannot delete the only page in this destination/);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('7. PUBLISHED_BLOCKED: rejects deleting published status, publication target, or published revision page', async () => {
    const client = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      const siteId = '10000000-0000-4000-8000-000000000001';
      const revTargetId = '20000000-0000-4000-8000-000000000001';
      const revOnlyId = '20000000-0000-4000-8000-000000000002';

      await client.query('begin');
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-pub', '${u1}', 'Pub Funnel') on conflict do nothing;
        insert into public.websites(id, user_id, name, homepage_funnel_id) values ('${siteId}', '${u1}', 'Pub Site', 'f-pub') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, status, funnel_id) values
          ('p-pub-status', '${u1}', 'Published Status Page', 'pub-status', 'published', 'f-pub'),
          ('p-pub-target', '${u1}', 'Pub Target Page', 'pub-target', 'draft', 'f-pub'),
          ('p-pub-rev', '${u1}', 'Pub Rev Page', 'pub-rev', 'draft', 'f-pub'),
          ('p-pub-keep', '${u1}', 'Keep Page', 'pub-keep', 'draft', 'f-pub')
        on conflict do nothing;

        insert into public.builder_published_revisions(id, website_id, page_id) values
          ('${revTargetId}', '${siteId}', 'p-pub-target'),
          ('${revOnlyId}', '${siteId}', 'p-pub-rev')
        on conflict do nothing;

        insert into public.builder_publication_targets(website_id, page_id, published_revision_id) values
          ('${siteId}', 'p-pub-target', '${revTargetId}')
        on conflict do nothing;
      `);
      await client.query('commit');

      // 1. Status published
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-pub-status')")
      ).rejects.toThrow(/published or has active publication records/);
      await client.query('rollback');

      // 2. Publication target row exists
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-pub-target')")
      ).rejects.toThrow(/published or has active publication records/);
      await client.query('rollback');

      // 3. Published revision row exists
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-pub-rev')")
      ).rejects.toThrow(/published or has active publication records/);
      await client.query('rollback');

      const targetCheck = await pool.query(`select * from public.builder_publication_targets where website_id = '${siteId}' and page_id = 'p-pub-target'`);
      expect(targetCheck.rows.length).toBe(1);
      const revCheck = await pool.query(`select * from public.builder_published_revisions where id = '${revTargetId}'`);
      expect(revCheck.rows.length).toBe(1);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('7b. EXPLICIT CROSS-PAGE FK REJECTION: publication target cannot point to revision of a different page', async () => {
    const client = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      const siteId = '10000000-0000-4000-8000-000000000099';
      const revA = '20000000-0000-4000-8000-000000000099';

      await client.query('begin');
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-xp', '${u1}', 'XP Funnel') on conflict do nothing;
        insert into public.websites(id, user_id, name, homepage_funnel_id) values ('${siteId}', '${u1}', 'XP Site', 'f-xp') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-xp-A', '${u1}', 'XP Page A', 'xp-a', 'f-xp'),
          ('p-xp-B', '${u1}', 'XP Page B', 'xp-b', 'f-xp')
        on conflict do nothing;

        insert into public.builder_published_revisions(id, website_id, page_id) values ('${revA}', '${siteId}', 'p-xp-A') on conflict do nothing;
      `);
      await client.query('commit');

      await client.query('begin');
      // Attempt target for Page B using revision of Page A -> must fail composite FK
      await expect(
        client.query(`insert into public.builder_publication_targets(website_id, page_id, published_revision_id) values ('${siteId}', 'p-xp-B', '${revA}')`)
      ).rejects.toThrow(/foreign key constraint/);
      await client.query('rollback');
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('8. LEAD_HISTORY_BLOCKED: rejects deleting page with historical lead intake requests', async () => {
    const client = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      const siteId = '10000000-0000-4000-8000-000000000002';
      const leadId = '30000000-0000-4000-8000-000000000001';

      await client.query('begin');
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-lead', '${u1}', 'Lead Funnel') on conflict do nothing;
        insert into public.websites(id, user_id, name, homepage_funnel_id) values ('${siteId}', '${u1}', 'Lead Site', 'f-lead') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-lead-1', '${u1}', 'Lead Page 1', 'lead-1', 'f-lead'),
          ('p-lead-2', '${u1}', 'Lead Page 2', 'lead-2', 'f-lead')
        on conflict do nothing;

        insert into public.public_lead_intake_requests(id, website_id, page_id) values ('${leadId}', '${siteId}', 'p-lead-1') on conflict do nothing;
      `);
      await client.query('commit');

      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-lead-1')")
      ).rejects.toThrow(/historical lead intake records/);
      await client.query('rollback');

      const pageCheck = await pool.query("select * from public.pages where id = 'p-lead-1'");
      expect(pageCheck.rows.length).toBe(1);
      const leadCheck = await pool.query(`select * from public.public_lead_intake_requests where id = '${leadId}'`);
      expect(leadCheck.rows.length).toBe(1);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('9. valid draft deletion succeeds: removes page, sections, and private save revisions while preserving other data', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const u1 = '11111111-1111-4111-8111-111111111111';
      const u2 = '22222222-2222-4222-8222-222222222222';
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com'), ('${u2}', 'u2@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-multi', '${u1}', 'Multi Funnel'), ('f-u2', '${u2}', 'U2 Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-del-1', '${u1}', 'Page To Delete', 'del-1', 'f-multi'),
          ('p-keep-1', '${u1}', 'Page To Keep', 'keep-1', 'f-multi'),
          ('p-u2-keep', '${u2}', 'U2 Page', 'u2-page', 'f-u2')
        on conflict do nothing;

        insert into public.page_sections(id, user_id, page_id, type, content, order_index) values
          ('sec-del-1', '${u1}', 'p-del-1', 'hero', '{"heading":"Hero"}'::jsonb, 0),
          ('sec-keep-1', '${u1}', 'p-keep-1', 'offer', '{"headline":"Offer"}'::jsonb, 0),
          ('sec-u2-1', '${u2}', 'p-u2-keep', 'hero', '{"heading":"U2 Hero"}'::jsonb, 0)
        on conflict do nothing;

        insert into private.page_section_save_revisions(page_id, user_id, revision, document_hash) values
          ('p-del-1', '${u1}', 1, 'hash-del-1')
        on conflict do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      const res = await client.query("select public.delete_builder_page('p-del-1') as result");
      const data = res.rows[0].result;
      expect(data.id).toBe('p-del-1');
      expect(data.deleted).toBe(true);

      const pageCheck = await client.query("select * from public.pages where id = 'p-del-1'");
      expect(pageCheck.rows.length).toBe(0);

      const secCheck = await client.query("select * from public.page_sections where id = 'sec-del-1'");
      expect(secCheck.rows.length).toBe(0);

      const revCheck = await client.query("select * from private.page_section_save_revisions where page_id = 'p-del-1'");
      expect(revCheck.rows.length).toBe(0);

      const keepPageCheck = await client.query("select * from public.pages where id = 'p-keep-1'");
      expect(keepPageCheck.rows.length).toBe(1);

      await client.query('commit');
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('10. REAL CONCURRENCY: SAME PAGE Delete/Delete lock-wait proof', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-same-del', '${u1}', 'Same Del Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-same-del', '${u1}', 'Target Page', 'same-del', 'f-same-del'),
          ('p-same-keep', '${u1}', 'Keep Page', 'same-keep', 'f-same-del')
        on conflict do nothing;
      `);
      await c1.query('commit');

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      const res1 = await c1.query("select public.delete_builder_page('p-same-del') as result");
      expect(res1.rows[0].result.deleted).toBe(true);

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      const c2Promise = c2.query("select public.delete_builder_page('p-same-del') as result");

      await assertBackendWaiting(pool, (c2 as any).processID);

      await c1.query('commit');

      await expect(c2Promise).rejects.toThrow(/Page not found/);
      await c2.query('rollback');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('11. REAL CONCURRENCY: DIFFERENT PAGES Delete/Delete SAME FUNNEL lock-wait proof with LAST_PAGE enforced', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-diff-del', '${u1}', 'Diff Del Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-diff-1', '${u1}', 'P1', 'diff-1', 'f-diff-del'),
          ('p-diff-2', '${u1}', 'P2', 'diff-2', 'f-diff-del'),
          ('p-diff-3', '${u1}', 'P3', 'diff-3', 'f-diff-del')
        on conflict do nothing;
      `);
      await c1.query('commit');

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c1.query("select public.delete_builder_page('p-diff-1') as result");

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      const c2Promise = c2.query("select public.delete_builder_page('p-diff-2') as result");

      await assertBackendWaiting(pool, (c2 as any).processID);

      await c1.query('commit');

      const res2 = await c2Promise;
      expect(res2.rows[0].result.deleted).toBe(true);
      await c2.query('commit');

      const remainingCheck = await pool.query("select id from public.pages where funnel_id = 'f-diff-del'");
      expect(remainingCheck.rows.length).toBe(1);
      expect(remainingCheck.rows[0].id).toBe('p-diff-3');

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        c1.query("select public.delete_builder_page('p-diff-3') as result")
      ).rejects.toThrow(/Cannot delete the only page in this destination/);
      await c1.query('rollback');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('12. REAL CONCURRENCY: Delete/Create SAME FUNNEL lock-wait proof', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-del-create', '${u1}', 'Del Create Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id, step_order) values
          ('p-dc-1', '${u1}', 'DC 1', 'dc-1', 'f-del-create', 0),
          ('p-dc-2', '${u1}', 'DC 2', 'dc-2', 'f-del-create', 1)
        on conflict do nothing;
      `);
      await c1.query('commit');

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c1.query("select public.delete_builder_page('p-dc-1') as result");

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      const createPromise = c2.query("select public.create_builder_page('New DC Page', 'new-dc-page', 'f-del-create')");

      await assertBackendWaiting(pool, (c2 as any).processID);

      await c1.query('commit');

      const createRes = await createPromise;
      expect(createRes.rows[0].create_builder_page.name).toBe('New DC Page');
      await c2.query('commit');

      const check = await pool.query("select id, step_order from public.pages where funnel_id = 'f-del-create' order by step_order");
      expect(check.rows.length).toBe(2);
      expect(check.rows.map(r => r.id)).not.toContain('p-dc-1');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('13. REAL CONCURRENCY: Delete/Duplicate SAME FUNNEL lock-wait proof', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-del-dup', '${u1}', 'Del Dup Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id, step_order) values
          ('p-dd-1', '${u1}', 'DD 1', 'dd-1', 'f-del-dup', 0),
          ('p-dd-2', '${u1}', 'DD 2', 'dd-2', 'f-del-dup', 1)
        on conflict do nothing;
      `);
      await c1.query('commit');

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c1.query("select public.delete_builder_page('p-dd-1') as result");

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      const dupPromise = c2.query("select public.duplicate_builder_page('p-dd-2')");

      await assertBackendWaiting(pool, (c2 as any).processID);

      await c1.query('commit');

      const dupRes = await dupPromise;
      expect(dupRes.rows[0].duplicate_builder_page.page.name).toBe('DD 2 (Copy)');
      await c2.query('commit');

      const check = await pool.query("select id, step_order from public.pages where funnel_id = 'f-del-dup' order by step_order");
      expect(check.rows.length).toBe(2);
      expect(check.rows.map(r => r.id)).not.toContain('p-dd-1');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('14. POST-LOCK DESTINATION CHANGE RACE: page funnel_id changed concurrently raises CONFLICT', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-dest-A', '${u1}', 'Funnel A'), ('f-dest-B', '${u1}', 'Funnel B') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-race-1', '${u1}', 'Race Page 1', 'race-1', 'f-dest-A'),
          ('p-race-2', '${u1}', 'Race Page 2', 'race-2', 'f-dest-A'),
          ('p-race-B1', '${u1}', 'Race Page B1', 'race-b1', 'f-dest-B')
        on conflict do nothing;
      `);
      await c1.query('commit');

      await c1.query('begin');
      await c1.query(`
        select pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('builder-page-lifecycle:${u1}:f-dest-A', 0)
        );
      `);

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      const deletePromise = c2.query("select public.delete_builder_page('p-race-1') as result");

      await assertBackendWaiting(pool, (c2 as any).processID);

      await c1.query("update public.pages set funnel_id = 'f-dest-B' where id = 'p-race-1'");
      await c1.query('commit');

      await expect(deletePromise).rejects.toThrow(/Page funnel destination changed concurrently/);
      await c2.query('rollback');

      const check = await pool.query("select funnel_id from public.pages where id = 'p-race-1'");
      expect(check.rows[0].funnel_id).toBe('f-dest-B');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('15. PUBLICATION RACE: Publication wins first -> Delete waits on row lock then returns PUBLISHED_BLOCKED', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      const siteId = '10000000-0000-4000-8000-000000000010';
      const revId = '20000000-0000-4000-8000-000000000010';

      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-pub-race', '${u1}', 'Pub Race Funnel') on conflict do nothing;
        insert into public.websites(id, user_id, name, homepage_funnel_id) values ('${siteId}', '${u1}', 'Pub Race Site', 'f-pub-race') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-pub-race-1', '${u1}', 'Pub Race 1', 'pub-race-1', 'f-pub-race'),
          ('p-pub-race-2', '${u1}', 'Pub Race 2', 'pub-race-2', 'f-pub-race')
        on conflict do nothing;
      `);
      await c1.query('commit');

      // 1. Transaction A starts publication, locks page row FOR UPDATE, inserts revision and target
      await c1.query('begin');
      await c1.query("select * from public.pages where id = 'p-pub-race-1' for update");
      await c1.query(`insert into public.builder_published_revisions(id, website_id, page_id) values ('${revId}', '${siteId}', 'p-pub-race-1')`);
      await c1.query(`insert into public.builder_publication_targets(website_id, page_id, published_revision_id) values ('${siteId}', 'p-pub-race-1', '${revId}')`);

      // 2. Transaction B starts delete_builder_page for p-pub-race-1 while c1 open
      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      const deletePromise = c2.query("select public.delete_builder_page('p-pub-race-1') as result");

      // 3. Verify c2 is waiting on page row lock
      await assertBackendWaiting(pool, (c2 as any).processID);

      // 4. Commit c1
      await c1.query('commit');

      // 5. c2 unblocks, reloads page, detects publication target, raises PUBLISHED_BLOCKED
      await expect(deletePromise).rejects.toThrow(/published or has active publication records/);
      await c2.query('rollback');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('16. PUBLICATION RACE: Delete wins first -> Publication attempt fails FK check', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      const siteId = '10000000-0000-4000-8000-000000000011';
      const revId = '20000000-0000-4000-8000-000000000011';

      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-del-pub', '${u1}', 'Del Pub Funnel') on conflict do nothing;
        insert into public.websites(id, user_id, name, homepage_funnel_id) values ('${siteId}', '${u1}', 'Del Pub Site', 'f-del-pub') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-del-pub-1', '${u1}', 'Del Pub 1', 'del-pub-1', 'f-del-pub'),
          ('p-del-pub-2', '${u1}', 'Del Pub 2', 'del-pub-2', 'f-del-pub')
        on conflict do nothing;
      `);
      await c1.query('commit');

      // 1. Transaction A starts delete_builder_page, locks FOR UPDATE, deletes page, leaves transaction open
      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c1.query("select public.delete_builder_page('p-del-pub-1') as result");

      // 2. Transaction B attempts inserting published revision for p-del-pub-1 while c1 open
      await c2.query('begin');
      const revPromise = c2.query(`insert into public.builder_published_revisions(id, website_id, page_id) values ('${revId}', '${siteId}', 'p-del-pub-1')`);

      // 3. Confirm c2 waits
      await assertBackendWaiting(pool, (c2 as any).processID);

      // 4. Commit c1
      await c1.query('commit');

      // 5. c2 unblocks and fails with FK violation 23503 (page no longer exists)
      await expect(revPromise).rejects.toThrow(/foreign key constraint/);
      await c2.query('rollback');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('17. LEAD RACE: Lead intake wins first -> Delete waits on row lock then returns LEAD_HISTORY_BLOCKED', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      const siteId = '10000000-0000-4000-8000-000000000012';
      const leadId = '30000000-0000-4000-8000-000000000012';

      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-lead-race', '${u1}', 'Lead Race Funnel') on conflict do nothing;
        insert into public.websites(id, user_id, name, homepage_funnel_id) values ('${siteId}', '${u1}', 'Lead Race Site', 'f-lead-race') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-lead-race-1', '${u1}', 'Lead Race 1', 'lead-race-1', 'f-lead-race'),
          ('p-lead-race-2', '${u1}', 'Lead Race 2', 'lead-race-2', 'f-lead-race')
        on conflict do nothing;
      `);
      await c1.query('commit');

      // 1. Transaction A inserts lead intake request, leaving transaction open
      await c1.query('begin');
      await c1.query("select * from public.pages where id = 'p-lead-race-1' for update");
      await c1.query(`insert into public.public_lead_intake_requests(id, website_id, page_id) values ('${leadId}', '${siteId}', 'p-lead-race-1')`);

      // 2. Transaction B starts delete_builder_page for p-lead-race-1 while c1 open
      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      const deletePromise = c2.query("select public.delete_builder_page('p-lead-race-1') as result");

      // 3. Verify c2 is waiting
      await assertBackendWaiting(pool, (c2 as any).processID);

      // 4. Commit c1
      await c1.query('commit');

      // 5. c2 unblocks and returns LEAD_HISTORY_BLOCKED
      await expect(deletePromise).rejects.toThrow(/historical lead intake records/);
      await c2.query('rollback');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('18. LEAD RACE: Delete wins first -> Lead intake insertion fails FK check', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      const siteId = '10000000-0000-4000-8000-000000000013';
      const leadId = '30000000-0000-4000-8000-000000000013';

      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-del-lead', '${u1}', 'Del Lead Funnel') on conflict do nothing;
        insert into public.websites(id, user_id, name, homepage_funnel_id) values ('${siteId}', '${u1}', 'Del Lead Site', 'f-del-lead') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-del-lead-1', '${u1}', 'Del Lead 1', 'del-lead-1', 'f-del-lead'),
          ('p-del-lead-2', '${u1}', 'Del Lead 2', 'del-lead-2', 'f-del-lead')
        on conflict do nothing;
      `);
      await c1.query('commit');

      // 1. Transaction A starts delete_builder_page, deletes page, leaves transaction open
      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c1.query("select public.delete_builder_page('p-del-lead-1') as result");

      // 2. Transaction B attempts inserting lead request for p-del-lead-1 while c1 open
      await c2.query('begin');
      const leadPromise = c2.query(`insert into public.public_lead_intake_requests(id, website_id, page_id) values ('${leadId}', '${siteId}', 'p-del-lead-1')`).catch(err => err);

      // 3. Confirm c2 waits
      await assertBackendWaiting(pool, (c2 as any).processID);

      // 4. Commit c1
      await c1.query('commit');

      // 5. c2 unblocks and fails with FK violation 23503
      const err = await leadPromise;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/foreign key constraint/);
      await c2.query('rollback');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('19. injected trigger failure during deletion rolls back transaction completely', async () => {
    const client = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await client.query('begin');
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-fail', '${u1}', 'Fail Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-fail-1', '${u1}', 'Page Fail 1', 'fail-1', 'f-fail'),
          ('p-fail-2', '${u1}', 'Page Fail 2', 'fail-2', 'f-fail')
        on conflict do nothing;

        create or replace function public.fail_delete_trigger() returns trigger as $$
        begin
          raise exception 'Injected delete failure';
        end;
        $$ language plpgsql;

        drop trigger if exists trg_fail_delete on public.pages;
        create trigger trg_fail_delete
          before delete on public.pages
          for each row
          when (OLD.id = 'p-fail-1')
          execute function public.fail_delete_trigger();
      `);
      await client.query('commit');

      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-fail-1') as result")
      ).rejects.toThrow(/Injected delete failure/);
      await client.query('rollback');

      const pageCheck = await pool.query("select * from public.pages where id = 'p-fail-1'");
      expect(pageCheck.rows.length).toBe(1);

      await pool.query('drop trigger if exists trg_fail_delete on public.pages; drop function if exists public.fail_delete_trigger();');
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('20. retry on already-deleted page returns PT404 cleanly', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const u1 = '11111111-1111-4111-8111-111111111111';
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-del-1') as result")
      ).rejects.toThrow(/Page not found/);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });
});
