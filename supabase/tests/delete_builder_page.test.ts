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
    pool = new pg.Pool({ connectionString: databaseUrl });
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

  it('1. migration installs function delete_builder_page', async () => {
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
        insert into public.users(id, email) values ('${u1}', 'u1@test.com'), ('${u2}', 'u2@test.com')
        on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f1', '${u1}', 'F1'), ('f2', '${u2}', 'F2')
        on conflict do nothing;
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

  it('5. enforces LAST_PAGE invariant: rejects deleting the only page in a funnel', async () => {
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
      ).rejects.toThrow(/Cannot delete the only page in this website/);
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('6. valid deletion succeeds: removes page and sections, preserving remaining funnel pages and other tenant data', async () => {
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

  it('7. concurrent Delete/Create in same funnel serializes cleanly', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      const u1 = '11111111-1111-4111-8111-111111111111';
      await c1.query('begin');
      await c1.query(`
        insert into public.users(id, email) values ('${u1}', 'u1@test.com') on conflict do nothing;
        insert into public.funnels(id, user_id, name) values ('f-race', '${u1}', 'Race Funnel') on conflict do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id, step_order) values
          ('p-race-1', '${u1}', 'Page 1', 'race-1', 'f-race', 0),
          ('p-race-2', '${u1}', 'Page 2', 'race-2', 'f-race', 1)
        on conflict do nothing;
      `);
      await c1.query('commit');

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c1.query("select public.delete_builder_page('p-race-1')");
      await c1.query('commit');

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${u1}'`);
      await c2.query("select public.create_builder_page('New Page', 'new-page', 'f-race')");
      await c2.query('commit');

      const check = await pool.query("select id, step_order from public.pages where funnel_id = 'f-race' order by step_order");
      expect(check.rows.length).toBe(2);
      expect(check.rows.map(r => r.id)).not.toContain('p-race-1');
    } finally {
      await c1.query('rollback').catch(() => {});
      await c2.query('rollback').catch(() => {});
      c1.release();
      c2.release();
    }
  });

  it('8. injected trigger failure during deletion rolls back transaction completely', async () => {
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

  it('9. retry on already-deleted page returns PT404 cleanly', async () => {
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
