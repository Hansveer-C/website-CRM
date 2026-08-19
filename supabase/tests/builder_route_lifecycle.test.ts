import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.BUILDER_ROUTE_TEST_DATABASE_URL || process.env.DATABASE_URL;
const MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050500_create_builder_route_drafts.sql');

describe.skipIf(!DATABASE_URL)('Builder Route Lifecycle RPC Integration Tests (PostgreSQL 17)', () => {
  let pool: Pool;

  async function setAuthUser(client: PoolClient, userId: string | null): Promise<void> {
    if (userId === null) {
      await client.query(`set "request.jwt.claim.sub" = ''`);
    } else {
      await client.query(`set "request.jwt.claim.sub" = '${userId}'`);
    }
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    const client = await pool.connect();
    try {
      await client.query('begin');

      // Create base schemas and roles if missing
      await client.query(`
        do $$ begin create role anon; exception when duplicate_object then null; end $$;
        do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
        do $$ begin create role service_role; exception when duplicate_object then null; end $$;
        do $$ begin create schema auth; exception when duplicate_schema then null; end $$;

        create table if not exists public.users (
          id text primary key,
          email text unique
        );

        create table if not exists public.funnels (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          created_at timestamptz not null default now()
        );

        create table if not exists public.websites (
          id uuid primary key default gen_random_uuid(),
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          domain text unique,
          subdomain text not null unique,
          homepage_funnel_id text references public.funnels(id) on delete set null,
          draft_homepage_funnel_id text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists public.website_routes (
          id uuid primary key default gen_random_uuid(),
          website_id uuid not null references public.websites(id) on delete cascade,
          path text not null,
          funnel_id text not null references public.funnels(id) on delete cascade,
          created_at timestamptz not null default now(),
          unique (website_id, path)
        );

        create or replace function auth.uid() returns uuid as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$ language sql stable;
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
      await client.query('reset role');
      await client.query(`set "request.jwt.claim.sub" = ''`);
      await client.query(`set "request.jwt.claims" = '{}'`);

      await client.query('insert into public.users (id, email) values ($1, $2) on conflict (id) do nothing', [
        userId,
        `${userId}@example.com`
      ]);

      const fnlHome = `fnl-home-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const fnlServices = `fnl-srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const fnlAbout = `fnl-abt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const fnlNew = `fnl-new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await client.query(
        `insert into public.funnels (id, user_id, name)
         values ($1, $2, 'Home Funnel'), ($3, $2, 'Services Funnel'), ($4, $2, 'About Funnel'), ($5, $2, 'New Funnel')`,
        [fnlHome, userId, fnlServices, fnlAbout, fnlNew]
      );

      const websiteRes = await client.query(
        `insert into public.websites (user_id, name, subdomain, homepage_funnel_id)
         values ($1, 'Test Site', $2, $3)
         returning id`,
        [userId, `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, fnlHome]
      );
      const websiteId = websiteRes.rows[0].id;

      const rHome = await client.query(
        `insert into public.website_routes (website_id, path, funnel_id) values ($1, '/', $2) returning id`,
        [websiteId, fnlHome]
      );
      const rServices = await client.query(
        `insert into public.website_routes (website_id, path, funnel_id) values ($1, '/services', $2) returning id`,
        [websiteId, fnlServices]
      );
      const rAbout = await client.query(
        `insert into public.website_routes (website_id, path, funnel_id) values ($1, '/about', $2) returning id`,
        [websiteId, fnlAbout]
      );

      return {
        websiteId,
        fnlHome,
        fnlServices,
        fnlAbout,
        fnlNew,
        routeHomeId: rHome.rows[0].id,
        routeServicesId: rServices.rows[0].id,
        routeAboutId: rAbout.rows[0].id
      };
    } finally {
      client.release();
    }
  }

  it('rejects unauthenticated caller with PT401', async () => {
    const client = await pool.connect();
    try {
      await client.query('select public.set_builder_route_draft($1, $2, $3)', [randomUUID(), 'fnl-1', '/test']);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT401');
    } finally {
      client.release();
    }
  });

  it('rejects foreign website with PT404', async () => {
    const client = await pool.connect();
    const userA = randomUUID();
    const userB = randomUUID();
    try {
      const { websiteId, fnlServices } = await createTestFixture(userA);
      await setAuthUser(client, userB);
      await client.query('select public.set_builder_route_draft($1, $2, $3)', [websiteId, fnlServices, '/custom']);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT404');
    } finally {
      client.release();
    }
  });

  it('rejects foreign destination funnel with PT404', async () => {
    const client = await pool.connect();
    const userA = randomUUID();
    const userB = randomUUID();
    try {
      const { websiteId } = await createTestFixture(userA);
      const { fnlServices: foreignFunnel } = await createTestFixture(userB);

      await setAuthUser(client, userA);
      await client.query('select public.set_builder_route_draft($1, $2, $3)', [websiteId, foreignFunnel, '/foreign']);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT404');
    } finally {
      client.release();
    }
  });

  it('stages draft rename without mutating live routes table', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      const res = await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/pressure-washing',
        routeServicesId
      ]);
      expect(res.rows[0].set_builder_route_draft.success).toBe(true);
      expect(res.rows[0].set_builder_route_draft.draft.path).toBe('/pressure-washing');
      expect(res.rows[0].set_builder_route_draft.draft.action).toBe('upsert');

      // Live routes table remains 100% UNCHANGED
      const liveRoute = await client.query('select * from public.website_routes where id = $1', [routeServicesId]);
      expect(liveRoute.rows[0].path).toBe('/services');
    } finally {
      client.release();
    }
  });

  it('reverts draft to live if user sets path back to live path', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // Stage rename
      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/pressure-washing',
        routeServicesId
      ]);

      const drafts1 = await client.query('select * from public.builder_route_drafts where website_id = $1', [websiteId]);
      expect(drafts1.rows).toHaveLength(1);

      // Revert back to live path '/services'
      const revertRes = await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/services',
        routeServicesId
      ]);
      expect(revertRes.rows[0].set_builder_route_draft.draft).toBeNull();

      const drafts2 = await client.query('select * from public.builder_route_drafts where website_id = $1', [websiteId]);
      expect(drafts2.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('strictly rejects root route "/" with PT400', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/',
        routeServicesId
      ]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT400');
      expect(err.message).toContain('Root route "/" is reserved');
    } finally {
      client.release();
    }
  });

  it('strictly rejects reserved platform routes with PT400', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      await client.query('select public.set_builder_route_draft($1, $2, $3)', [websiteId, fnlServices, '/api/test']);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT400');
      expect(err.message).toContain('reserved');
    } finally {
      client.release();
    }
  });

  it('normalizes uppercase, trailing slashes, and redundant slashes cleanly', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlNew } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      const res = await client.query('select public.set_builder_route_draft($1, $2, $3)', [
        websiteId,
        fnlNew,
        'Services/Driveway-Cleaning/'
      ]);
      expect(res.rows[0].set_builder_route_draft.draft.path).toBe('/services/driveway-cleaning');
    } finally {
      client.release();
    }
  });

  it('rejects collision with existing live route with PT409', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // Attempt to rename services to '/about' which is live on fnlAbout
      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/about',
        routeServicesId
      ]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT409');
      expect(err.message).toContain('already in use');
    } finally {
      client.release();
    }
  });

  it('rejects optimistic concurrency mismatch with PT409', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      await client.query('select public.set_builder_route_draft($1, $2, $3, $4, $5, $6)', [
        websiteId,
        fnlServices,
        '/pressure-washing',
        routeServicesId,
        '/stale-draft', // Expected draft mismatch
        '/services'
      ]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT409');
      expect(err.message).toContain('modified elsewhere');
    } finally {
      client.release();
    }
  });

  it('stages deletion of a live route', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, routeAboutId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      const res = await client.query('select public.delete_builder_route_draft($1, $2)', [websiteId, routeAboutId]);
      expect(res.rows[0].delete_builder_route_draft.draft.action).toBe('delete');

      // Live route still exists
      const live = await client.query('select * from public.website_routes where id = $1', [routeAboutId]);
      expect(live.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it('rejects deletion of root homepage route with PT400', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, routeHomeId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      await client.query('select public.delete_builder_route_draft($1, $2)', [websiteId, routeHomeId]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT400');
      expect(err.message).toContain('Root homepage route cannot be deleted');
    } finally {
      client.release();
    }
  });

  it('returns effective routes merging live and draft state via get_builder_effective_routes', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, fnlAbout, fnlNew, routeServicesId, routeAboutId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // 1. Rename services to /power-washing
      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/power-washing',
        routeServicesId
      ]);

      // 2. Stage deletion for about
      await client.query('select public.delete_builder_route_draft($1, $2)', [websiteId, routeAboutId]);

      // 3. Stage new draft route
      await client.query('select public.set_builder_route_draft($1, $2, $3)', [websiteId, fnlNew, '/pricing']);

      // 4. Fetch effective routes
      const effRes = await client.query('select public.get_builder_effective_routes($1)', [websiteId]);
      const routes = effRes.rows[0].get_builder_effective_routes.routes;

      const srv = routes.find((r: any) => r.funnel_id === fnlServices);
      expect(srv.path).toBe('/power-washing');
      expect(srv.live_path).toBe('/services');
      expect(srv.is_draft_override).toBe(true);

      const abt = routes.find((r: any) => r.funnel_id === fnlAbout);
      expect(abt.path).toBe('/about');
      expect(abt.is_staged_delete).toBe(true);

      const prc = routes.find((r: any) => r.funnel_id === fnlNew);
      expect(prc.path).toBe('/pricing');
      expect(prc.is_new_draft).toBe(true);
      expect(prc.live_path).toBeNull();
    } finally {
      client.release();
    }
  });
});
