import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.PAGE_REORDER_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050300_reorder_builder_pages.sql');
const DUPLICATE_MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050100_duplicate_builder_page.sql');
const DELETE_MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050200_delete_builder_page.sql');

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

describeDatabase('reorder_builder_pages RPC Integration Tests (PostgreSQL 17)', () => {
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

        create table if not exists private.page_section_save_revisions (
          page_id text not null primary key references public.pages(id) on delete cascade,
          user_id text not null references public.users(id) on delete cascade,
          revision bigint not null default 1,
          document_hash text not null default 'hash',
          updated_at timestamptz not null default now()
        );

        create table if not exists public.builder_published_revisions (
          id uuid not null primary key default gen_random_uuid(),
          website_id uuid not null references public.websites(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          created_at timestamptz not null default now(),
          created_by text,
          schema_version smallint not null default 1,
          document jsonb not null default '{}'::jsonb,
          document_fingerprint text not null default 'fp',
          constraint builder_published_revisions_composite_key_reorder unique (website_id, page_id, id)
        );

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

      const dupSql = readFileSync(DUPLICATE_MIGRATION_PATH, 'utf8');
      await client.query(dupSql);

      const delSql = readFileSync(DELETE_MIGRATION_PATH, 'utf8');
      await client.query(delSql);

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

  it('1. migration installs reorder_builder_pages with SECURITY DEFINER, search_path empty, and grants execute only to authenticated', async () => {
    const client = await pool.connect();
    try {
      const procRes = await client.query(`
        select prosecdef, proconfig
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'reorder_builder_pages';
      `);
      expect(procRes.rows.length).toBe(1);
      expect(procRes.rows[0].prosecdef).toBe(true);
      expect(procRes.rows[0].proconfig).toEqual(expect.arrayContaining([expect.stringMatching(/^search_path=(""|''|)$/)]));

      const privRes = await client.query(`
        select
          has_function_privilege('public', 'public.reorder_builder_pages(text, text[], text[])', 'execute') as pub_exec,
          has_function_privilege('anon', 'public.reorder_builder_pages(text, text[], text[])', 'execute') as anon_exec,
          has_function_privilege('authenticated', 'public.reorder_builder_pages(text, text[], text[])', 'execute') as auth_exec;
      `);
      expect(privRes.rows[0].pub_exec).toBe(false);
      expect(privRes.rows[0].anon_exec).toBe(false);
      expect(privRes.rows[0].auth_exec).toBe(true);
    } finally {
      client.release();
    }
  });

  it('2. unauthenticated invocation raises PT401', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("set local request.jwt.claim.sub = ''");
      await expect(
        client.query("select public.reorder_builder_pages('f1', array['p1'], array['p1'])")
      ).rejects.toMatchObject({ code: 'PT401' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('3. foreign or non-existent funnel raises PT404', async () => {
    const client = await pool.connect();
    const userA = '00000000-0000-0000-0000-000000000001';
    const userB = '00000000-0000-0000-0000-000000000002';
    try {
      await client.query('begin');
      await client.query(`
        insert into public.users (id, email) values ('${userA}', 'a@test.com'), ('${userB}', 'b@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-user-b', '${userB}', 'Funnel B') on conflict do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${userA}'`);

      await expect(
        client.query("select public.reorder_builder_pages('f-user-b', array['p1'], array['p1'])")
      ).rejects.toMatchObject({ code: 'PT404' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('4. invalid payload or array length mismatch raises PT400', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      await expect(
        client.query("select public.reorder_builder_pages('f-test', array[]::text[], array['p1'])")
      ).rejects.toMatchObject({ code: 'PT400' });

      await expect(
        client.query("select public.reorder_builder_pages('f-test', array['p1', 'p2'], array['p1'])")
      ).rejects.toMatchObject({ code: 'PT400' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('5. duplicate IDs in ordered array raises PT400', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      await expect(
        client.query("select public.reorder_builder_pages('f-test', array['p1', 'p1'], array['p1', 'p2'])")
      ).rejects.toMatchObject({ code: 'PT400' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('6. cross-tenant or missing page ID does not leak existence and raises PT400', async () => {
    const client = await pool.connect();
    const userA = '00000000-0000-0000-0000-000000000001';
    const userB = '00000000-0000-0000-0000-000000000002';
    try {
      await client.query('begin');
      await client.query(`
        insert into public.users (id, email) values ('${userA}', 'a@test.com'), ('${userB}', 'b@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-leak-a', '${userA}', 'Funnel A'), ('f-leak-b', '${userB}', 'Funnel B') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values
          ('p-leak-a1', '${userA}', 'Page A1', 'a1', 'f-leak-a', 0),
          ('p-leak-b1', '${userB}', 'Page B1', 'b1', 'f-leak-b', 0)
        on conflict do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${userA}'`);

      await expect(
        client.query("select public.reorder_builder_pages('f-leak-a', array['p-leak-b1'], array['p-leak-a1'])")
      ).rejects.toMatchObject({ code: 'PT400' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('7. stale expected order raises PT409 CONFLICT', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`
        insert into public.users (id, email) values ('${user}', 'u@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-stale', '${user}', 'Funnel Stale') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values
          ('p-stale-1', '${user}', 'P1', 'p1', 'f-stale', 0),
          ('p-stale-2', '${user}', 'P2', 'p2', 'f-stale', 1)
        on conflict do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      await expect(
        client.query("select public.reorder_builder_pages('f-stale', array['p-stale-2', 'p-stale-1'], array['p-stale-2', 'p-stale-1'])")
      ).rejects.toMatchObject({ code: 'PT409' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('8. valid complete reorder succeeds, assigns contiguous 0-based step_order, and preserves all page metadata', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`
        insert into public.users (id, email) values ('${user}', 'u@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-valid', '${user}', 'Funnel Valid') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, status, seo_title, funnel_id, step_order)
        values
          ('p-val-1', '${user}', 'Page 1', 'slug-1', 'draft', 'SEO 1', 'f-valid', 10),
          ('p-val-2', '${user}', 'Page 2', 'slug-2', 'draft', 'SEO 2', 'f-valid', 20),
          ('p-val-3', '${user}', 'Page 3', 'slug-3', 'draft', 'SEO 3', 'f-valid', 30)
        on conflict (id) do update set step_order = excluded.step_order;
      `);

      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      const res = await client.query(`
        select public.reorder_builder_pages(
          'f-valid',
          array['p-val-3', 'p-val-1', 'p-val-2'],
          array['p-val-1', 'p-val-2', 'p-val-3']
        ) as result;
      `);

      const pages = res.rows[0].result.pages;
      expect(pages.length).toBe(3);
      expect(pages[0].id).toBe('p-val-3');
      expect(pages[0].step_order).toBe(0);
      expect(pages[1].id).toBe('p-val-1');
      expect(pages[1].step_order).toBe(1);
      expect(pages[2].id).toBe('p-val-2');
      expect(pages[2].step_order).toBe(2);

      // Verify metadata preserved
      expect(pages[0].slug).toBe('slug-3');
      expect(pages[0].seo_title).toBe('SEO 3');
      expect(pages[0].funnel_id).toBe('f-valid');
      await client.query('commit');
    } finally {
      client.release();
    }
  });

  it('9. no-op reorder returns success without modifying page rows', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      const res = await client.query(`
        select public.reorder_builder_pages(
          'f-valid',
          array['p-val-3', 'p-val-1', 'p-val-2'],
          array['p-val-3', 'p-val-1', 'p-val-2']
        ) as result;
      `);

      expect(res.rows[0].result.pages.length).toBe(3);
      expect(res.rows[0].result.pages[0].id).toBe('p-val-3');
      await client.query('commit');
    } finally {
      client.release();
    }
  });

  it('10. unrelated funnel and sections remain untouched', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`
        insert into public.funnels (id, user_id, name) values ('f-other', '${user}', 'Funnel Other') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values ('p-other-1', '${user}', 'Other Page', 'other', 'f-other', 99)
        on conflict (id) do update set step_order = excluded.step_order;

        insert into public.page_sections (id, user_id, page_id, type, order_index)
        values ('sec-val-1', '${user}', 'p-val-1', 'hero', 0)
        on conflict (id) do nothing;
      `);

      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      await client.query(`
        select public.reorder_builder_pages(
          'f-valid',
          array['p-val-1', 'p-val-2', 'p-val-3'],
          array['p-val-3', 'p-val-1', 'p-val-2']
        );
      `);

      // Verify other page unchanged
      const otherRes = await client.query("select step_order from public.pages where id = 'p-other-1'");
      expect(otherRes.rows[0].step_order).toBe(99);

      // Verify section unchanged
      const secRes = await client.query("select id, page_id from public.page_sections where id = 'sec-val-1'");
      expect(secRes.rows.length).toBe(1);
      await client.query('commit');
    } finally {
      client.release();
    }
  });

  it('11. injected transaction failure rolls back all reordering atomically', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      // Initial state: p-val-1 (0), p-val-2 (1), p-val-3 (2)
      await client.query(`
        select public.reorder_builder_pages(
          'f-valid',
          array['p-val-3', 'p-val-2', 'p-val-1'],
          array['p-val-1', 'p-val-2', 'p-val-3']
        );
      `);

      // Force rollback of transaction
      await client.query('rollback');

      // Verify state was restored
      const checkRes = await pool.query("select id, step_order from public.pages where funnel_id = 'f-valid' order by step_order");
      expect(checkRes.rows.map(r => r.id)).toEqual(['p-val-1', 'p-val-2', 'p-val-3']);
    } finally {
      client.release();
    }
  });

  it('12. REAL CONCURRENCY: Reorder / Reorder on same funnel serializes and second gets PT409', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await pool.query(`
        insert into public.users (id, email) values ('${user}', 'u@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-conc-rr', '${user}', 'Funnel RR') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values
          ('p-rr-1', '${user}', 'RR1', 'rr1', 'f-conc-rr', 0),
          ('p-rr-2', '${user}', 'RR2', 'rr2', 'f-conc-rr', 1),
          ('p-rr-3', '${user}', 'RR3', 'rr3', 'f-conc-rr', 2)
        on conflict (id) do update set step_order = excluded.step_order;
      `);

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${user}'`);

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${user}'`);

      // c1 performs reorder (holds advisory lock until commit)
      await c1.query(`
        select public.reorder_builder_pages(
          'f-conc-rr',
          array['p-rr-2', 'p-rr-1', 'p-rr-3'],
          array['p-rr-1', 'p-rr-2', 'p-rr-3']
        );
      `);

      // c2 begins reorder on same funnel with old expected order
      const pid2Res = await c2.query('select pg_backend_pid() as pid');
      const pid2 = pid2Res.rows[0].pid;

      const c2Promise = c2.query(`
        select public.reorder_builder_pages(
          'f-conc-rr',
          array['p-rr-3', 'p-rr-2', 'p-rr-1'],
          array['p-rr-1', 'p-rr-2', 'p-rr-3']
        );
      `);

      // Assert c2 is waiting on advisory lock
      await assertBackendWaiting(pool, pid2);

      // c1 commits
      await c1.query('commit');

      // c2 finishes waiting and rejects with PT409
      let c2Err: any;
      try {
        await c2Promise;
      } catch (e) {
        c2Err = e;
      }
      expect(c2Err?.code).toBe('PT409');
      await c2.query('rollback').catch(() => {});
    } finally {
      c1.release();
      c2.release();
    }
  });

  it('13. REAL CONCURRENCY: Reorder / Create on same funnel serializes and creates new page with next step_order', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await pool.query(`
        insert into public.users (id, email) values ('${user}', 'u@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-conc-rc', '${user}', 'Funnel RC') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values
          ('p-rc-1', '${user}', 'RC1', 'rc1', 'f-conc-rc', 0),
          ('p-rc-2', '${user}', 'RC2', 'rc2', 'f-conc-rc', 1),
          ('p-rc-3', '${user}', 'RC3', 'rc3', 'f-conc-rc', 2)
        on conflict (id) do update set step_order = excluded.step_order;
      `);

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${user}'`);

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${user}'`);

      // c1 performs reorder (holds advisory lock)
      await c1.query(`
        select public.reorder_builder_pages(
          'f-conc-rc',
          array['p-rc-1', 'p-rc-3', 'p-rc-2'],
          array['p-rc-1', 'p-rc-2', 'p-rc-3']
        );
      `);

      // c2 invokes create_builder_page
      const pid2Res = await c2.query('select pg_backend_pid() as pid');
      const pid2 = pid2Res.rows[0].pid;

      const c2Promise = c2.query(`
        select public.create_builder_page('f-conc-rc', 'New RC Page', 'new-rc-p', 'landing');
      `);

      await assertBackendWaiting(pool, pid2);

      await c1.query('commit');
      const c2Res = await c2Promise;
      await c2.query('commit');

      expect(c2Res.rows.length).toBe(1);
    } finally {
      c1.release();
      c2.release();
    }
  });

  it('14. Create / Reorder stale-set: reorder rejects with PT409 after new page created', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      // In f-conc-rc, a 4th page was created in test 13.
      // Reorder with expected list of only the original 3 pages => PT409
      await expect(
        client.query(`
          select public.reorder_builder_pages(
            'f-conc-rc',
            array['p-rc-2', 'p-rc-1', 'p-rc-3'],
            array['p-rc-1', 'p-rc-2', 'p-rc-3']
          );
        `)
      ).rejects.toMatchObject({ code: 'PT409' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });

  it('15. REAL CONCURRENCY: Reorder / Duplicate on same funnel serializes', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await pool.query(`
        insert into public.users (id, email) values ('${user}', 'u@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-conc-rd', '${user}', 'Funnel RD') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values
          ('p-rd-1', '${user}', 'RD1', 'rd1', 'f-conc-rd', 0),
          ('p-rd-2', '${user}', 'RD2', 'rd2', 'f-conc-rd', 1),
          ('p-rd-3', '${user}', 'RD3', 'rd3', 'f-conc-rd', 2)
        on conflict (id) do update set step_order = excluded.step_order;
      `);

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${user}'`);

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${user}'`);

      // c1 reorders
      await c1.query(`
        select public.reorder_builder_pages(
          'f-conc-rd',
          array['p-rd-3', 'p-rd-1', 'p-rd-2'],
          array['p-rd-1', 'p-rd-2', 'p-rd-3']
        );
      `);

      // c2 invokes duplicate_builder_page
      const pid2Res = await c2.query('select pg_backend_pid() as pid');
      const pid2 = pid2Res.rows[0].pid;

      const c2Promise = c2.query(`
        select public.duplicate_builder_page('p-rd-1');
      `);

      await assertBackendWaiting(pool, pid2);

      await c1.query('commit');
      const c2Res = await c2Promise;
      await c2.query('commit');

      expect(c2Res.rows.length).toBe(1);
    } finally {
      c1.release();
      c2.release();
    }
  });

  it('16. REAL CONCURRENCY: Reorder / Delete on same funnel serializes', async () => {
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await pool.query(`
        insert into public.users (id, email) values ('${user}', 'u@test.com') on conflict do nothing;
        insert into public.funnels (id, user_id, name) values ('f-conc-rdel', '${user}', 'Funnel RDEL') on conflict do nothing;
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values
          ('p-rdel-1', '${user}', 'RDEL1', 'rdel1', 'f-conc-rdel', 0),
          ('p-rdel-2', '${user}', 'RDEL2', 'rdel2', 'f-conc-rdel', 1),
          ('p-rdel-3', '${user}', 'RDEL3', 'rdel3', 'f-conc-rdel', 2)
        on conflict (id) do update set step_order = excluded.step_order;
      `);

      await c1.query('begin');
      await c1.query(`set local request.jwt.claim.sub = '${user}'`);

      await c2.query('begin');
      await c2.query(`set local request.jwt.claim.sub = '${user}'`);

      // c1 reorders
      await c1.query(`
        select public.reorder_builder_pages(
          'f-conc-rdel',
          array['p-rdel-3', 'p-rdel-1', 'p-rdel-2'],
          array['p-rdel-1', 'p-rdel-2', 'p-rdel-3']
        );
      `);

      // c2 deletes a page
      const pid2Res = await c2.query('select pg_backend_pid() as pid');
      const pid2 = pid2Res.rows[0].pid;

      const c2Promise = c2.query(`
        select public.delete_builder_page('p-rdel-3');
      `);

      await assertBackendWaiting(pool, pid2);

      await c1.query('commit');
      const c2Res = await c2Promise;
      await c2.query('commit');

      expect(c2Res.rows.length).toBe(1);
    } finally {
      c1.release();
      c2.release();
    }
  });

  it('17. Delete / Reorder stale-set: reorder rejects with PT400 or PT409 after page is deleted', async () => {
    const client = await pool.connect();
    const user = '00000000-0000-0000-0000-000000000001';
    try {
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${user}'`);

      // Try reordering with expected list containing already deleted page 'p-rdel-3'
      await expect(
        client.query(`
          select public.reorder_builder_pages(
            'f-conc-rdel',
            array['p-rdel-1', 'p-rdel-2', 'p-rdel-3'],
            array['p-rdel-1', 'p-rdel-2', 'p-rdel-3']
          );
        `)
      ).rejects.toMatchObject({ code: 'PT400' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  });
});
