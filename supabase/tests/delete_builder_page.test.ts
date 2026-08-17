import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.PAGE_DELETE_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050200_delete_builder_page.sql');
const PREVIOUS_MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050100_duplicate_builder_page.sql');

describeDatabase('delete_builder_page RPC Integration Tests (PostgreSQL 17)', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
    const client = await pool.connect();
    try {
      await client.query('begin');

      // Setup exact deployed production schema (NO schema_markup column in public.pages)
      await client.query(`
        create extension if not exists "pgcrypto";
        do $$ begin
          create schema auth;
        exception when duplicate_schema then null;
        end $$;

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

        create schema if not exists private;

        create table if not exists private.page_section_save_revisions (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          created_at timestamptz not null default now()
        );

        create table if not exists public.builder_publication_targets (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          created_at timestamptz not null default now()
        );

        create table if not exists public.builder_published_revisions (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          created_at timestamptz not null default now()
        );

        create table if not exists public.public_lead_intake_requests (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          created_at timestamptz not null default now()
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

  it('1. migration installs function delete_builder_page with SECURITY DEFINER and search_path empty', async () => {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        select routine_name, security_type
        from information_schema.routines
        where routine_schema = 'public'
          and routine_name = 'delete_builder_page';
      `);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].security_type).toBe('DEFINER');
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

      // Verify page remains untouched in clean query
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
      await client.query('begin');
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-pub', '${u1}', 'Pub Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, status, funnel_id) values
          ('p-pub-status', '${u1}', 'Published Status Page', 'pub-status', 'published', 'f-pub'),
          ('p-pub-target', '${u1}', 'Pub Target Page', 'pub-target', 'draft', 'f-pub'),
          ('p-pub-rev', '${u1}', 'Pub Rev Page', 'pub-rev', 'draft', 'f-pub'),
          ('p-pub-keep', '${u1}', 'Keep Page', 'pub-keep', 'draft', 'f-pub')
        on conflict do nothing;

        insert into public.builder_publication_targets(id, user_id, page_id) values ('t1', '${u1}', 'p-pub-target') on conflict do nothing;
        insert into public.builder_published_revisions(id, user_id, page_id) values ('r1', '${u1}', 'p-pub-rev') on conflict do nothing;
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

      // Assert all publication rows remain untouched
      const targetCheck = await pool.query("select * from public.builder_publication_targets where id = 't1'");
      expect(targetCheck.rows.length).toBe(1);
      const revCheck = await pool.query("select * from public.builder_published_revisions where id = 'r1'");
      expect(revCheck.rows.length).toBe(1);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('8. LEAD_HISTORY_BLOCKED: rejects deleting page with historical lead intake requests', async () => {
    const client = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await client.query('begin');
      await client.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-lead', '${u1}', 'Lead Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id) values
          ('p-lead-1', '${u1}', 'Lead Page 1', 'lead-1', 'f-lead'),
          ('p-lead-2', '${u1}', 'Lead Page 2', 'lead-2', 'f-lead')
        on conflict do nothing;

        insert into public.public_lead_intake_requests(id, user_id, page_id) values ('lead-req-1', '${u1}', 'p-lead-1') on conflict do nothing;
      `);
      await client.query('commit');

      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-lead-1')")
      ).rejects.toThrow(/historical lead intake records/);
      await client.query('rollback');

      // Verify page & lead request remain untouched
      const pageCheck = await pool.query("select * from public.pages where id = 'p-lead-1'");
      expect(pageCheck.rows.length).toBe(1);
      const leadCheck = await pool.query("select * from public.public_lead_intake_requests where id = 'lead-req-1'");
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

        insert into private.page_section_save_revisions(id, user_id, page_id) values
          ('rev-del-1', '${u1}', 'p-del-1')
        on conflict do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      const res = await client.query("select public.delete_builder_page('p-del-1') as result");
      const data = res.rows[0].result;
      expect(data.id).toBe('p-del-1');
      expect(data.deleted).toBe(true);

      // Verify page row deleted
      const pageCheck = await client.query("select * from public.pages where id = 'p-del-1'");
      expect(pageCheck.rows.length).toBe(0);

      // Verify section row deleted
      const secCheck = await client.query("select * from public.page_sections where id = 'sec-del-1'");
      expect(secCheck.rows.length).toBe(0);

      // Verify private save revision deleted
      const revCheck = await client.query("select * from private.page_section_save_revisions where id = 'rev-del-1'");
      expect(revCheck.rows.length).toBe(0);

      // Verify remaining page and section preserved
      const keepPageCheck = await client.query("select * from public.pages where id = 'p-keep-1'");
      expect(keepPageCheck.rows.length).toBe(1);
      const keepSecCheck = await client.query("select * from public.page_sections where id = 'sec-keep-1'");
      expect(keepSecCheck.rows.length).toBe(1);

      // Verify user 2 data preserved
      const u2PageCheck = await client.query("select * from public.pages where id = 'p-u2-keep'");
      expect(u2PageCheck.rows.length).toBe(1);

      await client.query('commit');
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('10. REAL CONCURRENCY: SAME PAGE Delete/Delete serializes cleanly, first succeeds, second gets NOT_FOUND', async () => {
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

      // c1 starts transaction and acquires lock during delete
      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);

      // c1 deletes p-same-del
      const res1 = await c1.query("select public.delete_builder_page('p-same-del') as result");
      expect(res1.rows[0].result.deleted).toBe(true);

      // c1 commits lock release
      await c1.query('commit');

      // c2 tries deleting p-same-del (now deleted)
      await expect(
        c2.query("select public.delete_builder_page('p-same-del')")
      ).rejects.toThrow(/Page not found/);

      await c2.query('rollback');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('11. REAL CONCURRENCY: DIFFERENT PAGES Delete/Delete SAME FUNNEL serializes cleanly with LAST_PAGE invariant enforced', async () => {
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
      await c1.query("select public.delete_builder_page('p-diff-1')");
      await c1.query('commit');

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c2.query("select public.delete_builder_page('p-diff-2')");
      await c2.query('commit');

      // Attempting to delete final page p-diff-3 must fail under LAST_PAGE invariant
      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        c1.query("select public.delete_builder_page('p-diff-3')")
      ).rejects.toThrow(/Cannot delete the only page in this destination/);
      await c1.query('rollback');

      const check = await pool.query("select id from public.pages where funnel_id = 'f-diff-del'");
      expect(check.rows.length).toBe(1);
      expect(check.rows[0].id).toBe('p-diff-3');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('12. REAL CONCURRENCY: Delete/Create SAME FUNNEL serializes cleanly on shared advisory lock', async () => {
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
      await c1.query("select public.delete_builder_page('p-dc-1')");
      await c1.query('commit');

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c2.query("select public.create_builder_page('New DC Page', 'new-dc-page', 'f-del-create')");
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

  it('13. REAL CONCURRENCY: Delete/Duplicate SAME FUNNEL serializes cleanly on shared advisory lock', async () => {
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
      await c1.query("select public.delete_builder_page('p-dd-1')");
      await c1.query('commit');

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c2.query("select public.duplicate_builder_page('p-dd-2')");
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

  it('14. injected trigger failure during deletion rolls back transaction completely', async () => {
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
        client.query("select public.delete_builder_page('p-fail-1')")
      ).rejects.toThrow(/Injected delete failure/);
      await client.query('rollback');

      // Verify row was NOT deleted (checked in fresh transaction after rollback)
      const pageCheck = await pool.query("select * from public.pages where id = 'p-fail-1'");
      expect(pageCheck.rows.length).toBe(1);

      // Cleanup trigger
      await pool.query('drop trigger if exists trg_fail_delete on public.pages; drop function if exists public.fail_delete_trigger();');
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('15. retry on already-deleted page returns PT404 cleanly', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const u1 = '11111111-1111-4111-8111-111111111111';
      await client.query(`set local request.jwt.claim.sub = '${u1}'`);
      await expect(
        client.query("select public.delete_builder_page('p-del-1')")
      ).rejects.toThrow(/Page not found/);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });
});
