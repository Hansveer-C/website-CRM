import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const { Pool } = pg;

const DB_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:54322/postgres';
const shouldRunDbTests = Boolean(process.env.TEST_DATABASE_URL || process.env.CI);

const suite = shouldRunDbTests ? describe : describe.skip;

suite('PostgreSQL 17 Integration: Builder Route Publication & Redirect Lifecycle (Task 5B)', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL, max: 10 });
    const client = await pool.connect();
    try {
      // Apply prerequisite and new migrations
      const schemaSql = readFileSync(resolve(__dirname, '../schema.sql'), 'utf-8');
      await client.query(schemaSql);

      const draftMigration = readFileSync(
        resolve(__dirname, '../migrations/20260817050500_create_builder_route_drafts.sql'),
        'utf-8'
      );
      await client.query(draftMigration);

      const pubMigration = readFileSync(
        resolve(__dirname, '../migrations/20260817050600_create_builder_route_redirects_and_publication.sql'),
        'utf-8'
      );
      await client.query(pubMigration);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  async function setAuthUser(client: pg.PoolClient, userId: string) {
    await client.query(`set session "request.jwt.claim.sub" = '${userId}'`);
    await client.query(`set session "request.jwt.claims" = '{"sub":"${userId}"}'`);
    await client.query(`set session role = 'authenticated'`);
  }

  async function clearAuthUser(client: pg.PoolClient) {
    await client.query(`reset role`);
    await client.query(`reset "request.jwt.claim.sub"`);
    await client.query(`reset "request.jwt.claims"`);
  }

  async function createTestFixture(userId: string) {
    const client = await pool.connect();
    try {
      const websiteId = randomUUID();
      const fnlHome = randomUUID();
      const fnlServices = randomUUID();
      const fnlAbout = randomUUID();

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
      await clearAuthUser(client);
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
