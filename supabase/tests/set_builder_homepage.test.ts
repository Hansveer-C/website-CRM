import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.BUILDER_HOMEPAGE_TEST_DATABASE_URL || process.env.PAGE_REORDER_TEST_DATABASE_URL || process.env.PAGE_LIFECYCLE_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050400_set_builder_homepage.sql');

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

describeDatabase('set_builder_homepage RPC Integration Tests (PostgreSQL 17)', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
    const client = await pool.connect();
    try {
      await client.query('begin');

      // Create roles if missing
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

        create table if not exists public.websites (
          id uuid primary key default gen_random_uuid(),
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          domain text unique,
          subdomain text unique not null,
          homepage_funnel_id text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists public.website_routes (
          id text primary key,
          website_id uuid not null references public.websites(id) on delete cascade,
          path text not null,
          funnel_id text not null,
          created_at timestamptz not null default now(),
          constraint website_routes_website_id_path_unique unique (website_id, path)
        );

        create table if not exists public.pages (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          funnel_id text references public.funnels(id) on delete cascade,
          step_type text,
          step_order integer,
          created_at timestamptz not null default now()
        );
      `);

      // Apply migration under test
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');
      await client.query(migrationSql);

      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  async function createTestFixture(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('insert into public.users (id, email) values ($1, $2) on conflict (id) do nothing', [
        userId,
        `${userId}@example.com`
      ]);

      const fnl1 = `fnl-1-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fnl2 = `fnl-2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      await client.query(
        `insert into public.funnels (id, user_id, name) values ($1, $2, 'Home Funnel'), ($3, $2, 'Service Funnel')`,
        [fnl1, userId, fnl2]
      );

      const websiteRes = await client.query(
        `insert into public.websites (user_id, name, subdomain, homepage_funnel_id)
         values ($1, 'Test Site', $2, $3)
         returning id`,
        [userId, `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, fnl1]
      );
      const websiteId = websiteRes.rows[0].id;

      // Add routes
      await client.query(
        `insert into public.website_routes (id, website_id, path, funnel_id)
         values ($1, $2, '/', $3), ($4, $2, '/services', $5)`,
        [`r1-${Date.now()}`, websiteId, fnl1, `r2-${Date.now()}`, websiteId, fnl2]
      );

      return { websiteId, fnl1, fnl2 };
    } finally {
      client.release();
    }
  }

  it('rejects unauthenticated calls with PT401', async () => {
    const client = await pool.connect();
    try {
      await client.query(`create or replace function auth.uid() returns text language sql as $$ select null::text $$`);
      await client.query(`select public.set_builder_homepage('00000000-0000-0000-0000-000000000000'::uuid, 'fnl-1', 'fnl-1')`);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT401');
      expect(err.message).toContain('Authentication required');
    } finally {
      client.release();
    }
  });

  it('rejects null website_id with PT400', async () => {
    const client = await pool.connect();
    try {
      await client.query(`create or replace function auth.uid() returns text language sql as $$ select 'user-test-1'::text $$`);
      await client.query(`select public.set_builder_homepage(null, 'fnl-1', 'fnl-1')`);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT400');
      expect(err.message).toContain('Website ID is required');
    } finally {
      client.release();
    }
  });

  it('rejects blank funnel_id with PT400', async () => {
    const client = await pool.connect();
    try {
      await client.query(`create or replace function auth.uid() returns text language sql as $$ select 'user-test-1'::text $$`);
      await client.query(`select public.set_builder_homepage('00000000-0000-0000-0000-000000000000'::uuid, '   ', 'fnl-1')`);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT400');
      expect(err.message).toContain('Invalid funnel ID');
    } finally {
      client.release();
    }
  });

  it('rejects foreign website with PT404', async () => {
    const client = await pool.connect();
    try {
      const { websiteId } = await createTestFixture('owner-user');
      await client.query(`create or replace function auth.uid() returns text language sql as $$ select 'attacker-user'::text $$`);
      await client.query(`select public.set_builder_homepage($1, 'fnl-1', 'fnl-1')`, [websiteId]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT404');
      expect(err.message).toContain('Website not found');
    } finally {
      client.release();
    }
  });

  it('rejects foreign funnel with PT404', async () => {
    const client = await pool.connect();
    try {
      const { websiteId } = await createTestFixture('user-alpha');
      const { fnl1: foreignFunnel } = await createTestFixture('user-beta');

      await client.query(`create or replace function auth.uid() returns text language sql as $$ select 'user-alpha'::text $$`);
      await client.query(`select public.set_builder_homepage($1, $2, null)`, [websiteId, foreignFunnel]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT404');
      expect(err.message).toContain('Funnel not found');
    } finally {
      client.release();
    }
  });

  it('rejects unassociated funnel with PT400', async () => {
    const client = await pool.connect();
    try {
      const userId = `user-unassoc-${Date.now()}`;
      const { websiteId } = await createTestFixture(userId);

      // Create an unassociated funnel for the same user (not in website_routes and not currently homepage)
      const unassocFunnel = `fnl-unassoc-${Date.now()}`;
      await client.query(`insert into public.funnels (id, user_id, name) values ($1, $2, 'Unrelated Funnel')`, [
        unassocFunnel,
        userId
      ]);

      await client.query(`create or replace function auth.uid() returns text language sql as $$ select '${userId}'::text $$`);
      await client.query(`select public.set_builder_homepage($1, $2, null)`, [websiteId, unassocFunnel]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT400');
      expect(err.message).toContain('Funnel is not an associated destination');
    } finally {
      client.release();
    }
  });

  it('rejects optimistic concurrency mismatch with PT409', async () => {
    const client = await pool.connect();
    try {
      const userId = `user-conflict-${Date.now()}`;
      const { websiteId, fnl1, fnl2 } = await createTestFixture(userId);

      await client.query(`create or replace function auth.uid() returns text language sql as $$ select '${userId}'::text $$`);
      // Provide wrong expected homepage ('fnl-wrong' instead of fnl1)
      await client.query(`select public.set_builder_homepage($1, $2, 'fnl-wrong')`, [websiteId, fnl2]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT409');
      expect(err.message).toContain('The homepage changed elsewhere');
    } finally {
      client.release();
    }
  });

  it('successfully updates homepage and synchronizes root route', async () => {
    const client = await pool.connect();
    try {
      const userId = `user-success-${Date.now()}`;
      const { websiteId, fnl1, fnl2 } = await createTestFixture(userId);

      await client.query(`create or replace function auth.uid() returns text language sql as $$ select '${userId}'::text $$`);

      const res = await client.query(`select public.set_builder_homepage($1, $2, $3) as result`, [
        websiteId,
        fnl2,
        fnl1
      ]);

      const data = res.rows[0].result;
      expect(data.website.id).toBe(websiteId);
      expect(data.website.homepage_funnel_id).toBe(fnl2);

      // Verify DB state
      const dbWebsite = await client.query(`select * from public.websites where id = $1`, [websiteId]);
      expect(dbWebsite.rows[0].homepage_funnel_id).toBe(fnl2);

      const dbRoute = await client.query(`select * from public.website_routes where website_id = $1 and path = '/'`, [websiteId]);
      expect(dbRoute.rows[0].funnel_id).toBe(fnl2);
    } finally {
      client.release();
    }
  });

  it('returns current state as no-op when already homepage', async () => {
    const client = await pool.connect();
    try {
      const userId = `user-noop-${Date.now()}`;
      const { websiteId, fnl1 } = await createTestFixture(userId);

      await client.query(`create or replace function auth.uid() returns text language sql as $$ select '${userId}'::text $$`);

      const res = await client.query(`select public.set_builder_homepage($1, $2, $3) as result`, [
        websiteId,
        fnl1,
        fnl1
      ]);

      const data = res.rows[0].result;
      expect(data.website.homepage_funnel_id).toBe(fnl1);
    } finally {
      client.release();
    }
  });

  it('serializes concurrent homepage updates using website lifecycle advisory lock', async () => {
    const userId = `user-lock-${Date.now()}`;
    const { websiteId, fnl1, fnl2 } = await createTestFixture(userId);

    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      await client1.query(`create or replace function auth.uid() returns text language sql as $$ select '${userId}'::text $$`);
      await client2.query(`create or replace function auth.uid() returns text language sql as $$ select '${userId}'::text $$`);

      // Client 1 begins transaction and holds lock
      await client1.query('begin');
      await client1.query(`select public.set_builder_homepage($1, $2, $3)`, [websiteId, fnl2, fnl1]);

      // Client 2 attempts update concurrently on same website
      const c2PidRes = await client2.query('select pg_backend_pid() as pid');
      const c2Pid = c2PidRes.rows[0].pid;

      const client2Promise = client2.query(`select public.set_builder_homepage($1, $2, $3)`, [websiteId, fnl1, fnl2]);

      await assertBackendWaiting(pool, c2Pid);

      // Client 1 commits
      await client1.query('commit');

      // Client 2 should proceed now
      const c2Res = await client2Promise;
      expect(c2Res.rows[0].set_builder_homepage.website.homepage_funnel_id).toBe(fnl1);
    } finally {
      client1.release();
      client2.release();
    }
  });
});
