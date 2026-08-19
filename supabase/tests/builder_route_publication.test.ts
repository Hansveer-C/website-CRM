import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.BUILDER_ROUTE_TEST_DATABASE_URL || process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)('PostgreSQL 17 Integration: Builder Route Publication & Redirect Lifecycle (Task 5B)', () => {
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

        create table if not exists public.pages (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          funnel_id text not null references public.funnels(id) on delete cascade,
          step_order integer not null default 0,
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

        create table if not exists public.builder_publication_targets (
          website_id uuid not null references public.websites(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          published_revision_id text not null,
          published_at timestamptz not null default now(),
          primary key (website_id, page_id)
        );

        create or replace function auth.uid() returns uuid as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$ language sql stable;
      `);

      // Apply Task 5A draft routes migration
      const draftMigration = readFileSync(
        resolve(__dirname, '../migrations/20260817050500_create_builder_route_drafts.sql'),
        'utf-8'
      );
      await client.query(draftMigration);

      // Apply Task 5B route publication migration
      const pubMigration = readFileSync(
        resolve(__dirname, '../migrations/20260817050600_create_builder_route_redirects_and_publication.sql'),
        'utf-8'
      );
      await client.query(pubMigration);

      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
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

  async function createTestFixture(userId: string) {
    const client = await pool.connect();
    try {
      const websiteId = randomUUID();
      const fnlHome = randomUUID();
      const fnlServices = randomUUID();
      const fnlAbout = randomUUID();

      await client.query(`insert into public.users (id, email) values ($1, $2) on conflict (id) do nothing`, [userId, `${userId}@example.com`]);

      // Create funnels
      await client.query(
        `insert into public.funnels (id, user_id, name) values ($1, $2, 'Home'), ($3, $2, 'Services'), ($4, $2, 'About')`,
        [fnlHome, userId, fnlServices, fnlAbout]
      );

      // Create pages (all published)
      await client.query(
        `insert into public.pages (id, user_id, name, slug, status, funnel_id, step_order) values
         ($1, $2, 'Home', 'home', 'published', $3, 0),
         ($4, $2, 'Services', 'services', 'published', $5, 0),
         ($6, $2, 'About', 'about', 'published', $7, 0)`,
        [randomUUID(), userId, fnlHome, randomUUID(), userId, fnlServices, randomUUID(), userId, fnlAbout]
      );

      // Create website
      await client.query(
        `insert into public.websites (id, user_id, name, subdomain, homepage_funnel_id) values ($1, $2, 'Test Wash', $3, $4)`,
        [websiteId, userId, `sub-${websiteId.substring(0, 8)}`, fnlHome]
      );

      // Create initial live routes
      const routeRootRes = await client.query(
        `insert into public.website_routes (id, website_id, path, funnel_id) values (gen_random_uuid(), $1, '/', $2) returning id`,
        [websiteId, fnlHome]
      );
      const routeServicesRes = await client.query(
        `insert into public.website_routes (id, website_id, path, funnel_id) values (gen_random_uuid(), $1, '/services', $2) returning id`,
        [websiteId, fnlServices]
      );

      return {
        websiteId,
        fnlHome,
        fnlServices,
        fnlAbout,
        routeRootId: routeRootRes.rows[0].id,
        routeServicesId: routeServicesRes.rows[0].id
      };
    } finally {
      client.release();
    }
  }

  it('rejects unauthenticated caller with PT401', async () => {
    const client = await pool.connect();
    try {
      await setAuthUser(client, null);
      await client.query('select public.publish_builder_routes($1)', [randomUUID()]);
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
      const { websiteId } = await createTestFixture(userA);
      await client.query(`insert into public.users (id, email) values ($1, $2) on conflict (id) do nothing`, [userB, `${userB}@example.com`]);
      await setAuthUser(client, userB);
      await client.query('select public.publish_builder_routes($1)', [websiteId]);
      expect.unreachable('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('PT404');
    } finally {
      client.release();
    }
  });

  it('returns success 0 when website has no drafts to publish', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      const res = await client.query('select public.publish_builder_routes($1)', [websiteId]);
      expect(res.rows[0].publish_builder_routes).toMatchObject({
        success: true,
        published_count: 0
      });
    } finally {
      client.release();
    }
  });

  it('atomically publishes draft rename and creates 308 redirect', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // 1. Stage rename: /services -> /pressure-washing
      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/pressure-washing',
        routeServicesId
      ]);

      // 2. Publish routes
      const res = await client.query('select public.publish_builder_routes($1)', [websiteId]);
      expect(res.rows[0].publish_builder_routes).toMatchObject({
        success: true,
        published_count: 1
      });

      // 3. Verify live route updated
      const liveRoutes = await client.query('select * from public.website_routes where website_id = $1 order by path', [websiteId]);
      expect(liveRoutes.rows).toContainEqual(expect.objectContaining({
        id: routeServicesId,
        path: '/pressure-washing',
        funnel_id: fnlServices
      }));

      // 4. Verify redirect created
      const redirects = await client.query('select * from public.website_route_redirects where website_id = $1', [websiteId]);
      expect(redirects.rows).toHaveLength(1);
      expect(redirects.rows[0]).toMatchObject({
        website_id: websiteId,
        from_path: '/services',
        to_path: '/pressure-washing'
      });

      // 5. Verify drafts cleared
      const drafts = await client.query('select * from public.builder_route_drafts where website_id = $1', [websiteId]);
      expect(drafts.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('collapses sequential rename redirect chains', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // First rename: /services -> /pressure-washing
      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/pressure-washing',
        routeServicesId
      ]);
      await client.query('select public.publish_builder_routes($1)', [websiteId]);

      // Second rename: /pressure-washing -> /exterior-cleaning
      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [
        websiteId,
        fnlServices,
        '/exterior-cleaning',
        routeServicesId
      ]);
      await client.query('select public.publish_builder_routes($1)', [websiteId]);

      // Verify redirects: both /services and /pressure-washing point directly to /exterior-cleaning
      const redirects = await client.query('select from_path, to_path from public.website_route_redirects where website_id = $1 order by from_path', [websiteId]);
      expect(redirects.rows).toEqual([
        { from_path: '/pressure-washing', to_path: '/exterior-cleaning' },
        { from_path: '/services', to_path: '/exterior-cleaning' }
      ]);
    } finally {
      client.release();
    }
  });

  it('publishes staged delete by removing live route', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // Stage delete
      await client.query('select public.delete_builder_route_draft($1, $2)', [websiteId, routeServicesId]);

      // Publish
      await client.query('select public.publish_builder_routes($1)', [websiteId]);

      // Verify route deleted from live routes
      const live = await client.query('select * from public.website_routes where id = $1', [routeServicesId]);
      expect(live.rows).toHaveLength(0);

      // Verify drafts cleared
      const drafts = await client.query('select * from public.builder_route_drafts where website_id = $1', [websiteId]);
      expect(drafts.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('rejects publication if destination page is unpublished', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // Create new draft-only funnel with only a draft page (not published)
      const fnlDraft = randomUUID();
      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, \'Draft Funnel\')', [fnlDraft, userId]);
      await client.query('insert into public.pages (id, user_id, name, slug, status, funnel_id, step_order) values ($1, $2, \'Draft Page\', \'draft\', \'draft\', $3, 0)', [randomUUID(), userId, fnlDraft]);

      // Stage route for this draft funnel
      await client.query('select public.set_builder_route_draft($1, $2, $3)', [websiteId, fnlDraft, '/draft-route']);

      // Attempt to publish
      try {
        await client.query('select public.publish_builder_routes($1)', [websiteId]);
        expect.unreachable('Should have failed');
      } catch (err: any) {
        expect(err.code).toBe('PT400');
        expect(err.message).toContain('not published yet');
      }

      // Verify draft and live routes remain 100% intact
      const drafts = await client.query('select * from public.builder_route_drafts where website_id = $1', [websiteId]);
      expect(drafts.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it('rejects publication when optimistic draft count is stale with PT409', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlAbout } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // Stage create
      await client.query('select public.set_builder_route_draft($1, $2, $3)', [websiteId, fnlAbout, '/about']);

      // Stale expected draft count
      try {
        await client.query('select public.publish_builder_routes($1, $2)', [websiteId, 5]);
        expect.unreachable('Should have failed');
      } catch (err: any) {
        expect(err.code).toBe('PT409');
        expect(err.message).toContain('modified elsewhere');
      }
    } finally {
      client.release();
    }
  });

  it('clears redirect when newly claimed live route was previously a redirect source', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    try {
      const { websiteId, fnlServices, fnlAbout, routeServicesId } = await createTestFixture(userId);
      await setAuthUser(client, userId);

      // 1. Rename /services -> /pressure-washing
      await client.query('select public.set_builder_route_draft($1, $2, $3, $4)', [websiteId, fnlServices, '/pressure-washing', routeServicesId]);
      await client.query('select public.publish_builder_routes($1)', [websiteId]);

      // Redirect exists: /services -> /pressure-washing
      const rdsBefore = await client.query('select * from public.website_route_redirects where website_id = $1', [websiteId]);
      expect(rdsBefore.rows).toHaveLength(1);
      expect(rdsBefore.rows[0].from_path).toBe('/services');

      // 2. Create new route claiming '/services' for fnlAbout
      await client.query('select public.set_builder_route_draft($1, $2, $3)', [websiteId, fnlAbout, '/services']);
      await client.query('select public.publish_builder_routes($1)', [websiteId]);

      // Redirect for '/services' should now be removed so the real live route takes precedence!
      const rdsAfter = await client.query('select * from public.website_route_redirects where website_id = $1 and from_path = \'/services\'', [websiteId]);
      expect(rdsAfter.rows).toHaveLength(0);

      // Live route for '/services' exists
      const liveServices = await client.query('select * from public.website_routes where website_id = $1 and path = \'/services\'', [websiteId]);
      expect(liveServices.rows[0].funnel_id).toBe(fnlAbout);
    } finally {
      client.release();
    }
  });
});
