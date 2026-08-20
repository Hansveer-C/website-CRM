import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const DATABASE_URL =
  process.env.BUILDER_ROUTE_TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL;

const MIGRATIONS = [
  resolve(__dirname, '../migrations/20260725220000_create_builder_publication_storage.sql'),
  resolve(__dirname, '../migrations/20260817050400_set_builder_homepage.sql'),
  resolve(__dirname, '../migrations/20260817050500_create_builder_route_drafts.sql'),
  resolve(__dirname, '../migrations/20260817050600_create_builder_route_redirects_and_publication.sql'),
  resolve(__dirname, '../migrations/20260817050700_create_builder_site_navigation.sql'),
  resolve(__dirname, '../migrations/20260817050800_create_builder_navigation_publication_and_runtime.sql'),
  resolve(__dirname, '../migrations/20260817050900_create_builder_unified_website_publication.sql')
];

describe.skipIf(!DATABASE_URL)('Builder Phase 1B / Task 7 — Unified Publish Website Transaction DB Integration Tests (PostgreSQL 17)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    const client = await pool.connect();
    try {
      await client.query('begin');

      // Create base schemas, roles, and dependency tables
      await client.query(`
        do $$ begin
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            begin create role anon; exception when others then null; end;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            begin create role authenticated; exception when others then null; end;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'service_role') then
            begin create role service_role; exception when others then null; end;
          end if;
        end $$;
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
          funnel_id text references public.funnels(id) on delete cascade,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          step_order integer not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists public.sections (
          id text primary key,
          page_id text not null references public.pages(id) on delete cascade,
          user_id text not null references public.users(id) on delete cascade,
          type text not null,
          name text not null,
          content jsonb not null default '{}'::jsonb,
          sort_order integer not null default 0,
          is_global boolean not null default false,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists public.websites (
          id uuid primary key default gen_random_uuid(),
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          domain text unique,
          subdomain text not null unique,
          homepage_funnel_id text references public.funnels(id) on delete set null,
          draft_homepage_funnel_id text,
          publication_revision integer not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists public.website_routes (
          id uuid primary key default gen_random_uuid(),
          website_id uuid not null references public.websites(id) on delete cascade,
          path text not null,
          funnel_id text not null references public.funnels(id) on delete cascade,
          created_at timestamptz not null default now(),
          constraint website_routes_website_path_key unique (website_id, path)
        );

        create or replace function auth.uid() returns text as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::text;
        $$ language sql stable;

        grant all on table public.users to authenticated, anon, service_role;
        grant all on table public.funnels to authenticated, anon, service_role;
        grant all on table public.pages to authenticated, anon, service_role;
        grant all on table public.sections to authenticated, anon, service_role;
        grant all on table public.websites to authenticated, anon, service_role;
        grant all on table public.website_routes to authenticated, anon, service_role;
      `);

      // Execute migrations in sequence
      for (const migPath of MIGRATIONS) {
        const sql = readFileSync(migPath, 'utf8');
        await client.query(sql);
      }

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

  async function createTestFixture(userIdPrefix: string = 'user') {
    const client = await pool.connect();
    const userId = `${userIdPrefix}-${randomUUID()}`;
    const userEmail = `${userId}@example.com`;

    await client.query('INSERT INTO public.users (id, email) VALUES ($1, $2)', [userId, userEmail]);

    const funnel1Id = `fn1-${randomUUID()}`;
    const funnel2Id = `fn2-${randomUUID()}`;
    const funnel3Id = `fn3-${randomUUID()}`;

    await client.query('INSERT INTO public.funnels (id, user_id, name) VALUES ($1, $2, $3)', [funnel1Id, userId, 'Home Funnel']);
    await client.query('INSERT INTO public.funnels (id, user_id, name) VALUES ($1, $2, $3)', [funnel2Id, userId, 'About Funnel']);
    await client.query('INSERT INTO public.funnels (id, user_id, name) VALUES ($1, $2, $3)', [funnel3Id, userId, 'Services Funnel']);

    const page1Id = `pg1-${randomUUID()}`;
    const page2Id = `pg2-${randomUUID()}`;
    const page3Id = `pg3-${randomUUID()}`;

    await client.query('INSERT INTO public.pages (id, user_id, funnel_id, name, slug, status, step_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', [page1Id, userId, funnel1Id, 'Home Page', 'home', 'published', 0]);
    await client.query('INSERT INTO public.pages (id, user_id, funnel_id, name, slug, status, step_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', [page2Id, userId, funnel2Id, 'About Page', 'about', 'published', 0]);
    await client.query('INSERT INTO public.pages (id, user_id, funnel_id, name, slug, status, step_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', [page3Id, userId, funnel3Id, 'Services Page', 'services', 'draft', 0]);

    const websiteRes = await client.query(
      'INSERT INTO public.websites (user_id, name, subdomain, homepage_funnel_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, 'Test Site', `site-${randomUUID().slice(0, 8)}`, funnel1Id]
    );
    const websiteId = websiteRes.rows[0].id;

    // Add root route
    await client.query(
      'INSERT INTO public.website_routes (website_id, path, funnel_id) VALUES ($1, $2, $3)',
      [websiteId, '/', funnel1Id]
    );

    // Add /about route
    await client.query(
      'INSERT INTO public.website_routes (website_id, path, funnel_id) VALUES ($1, $2, $3)',
      [websiteId, '/about', funnel2Id]
    );

    // Publish baseline publication targets for page1 and page2
    const rev1 = randomUUID();
    const rev2 = randomUUID();
    await client.query('INSERT INTO public.builder_published_revisions (id, website_id, page_id, created_by, schema_version, document, document_fingerprint) VALUES ($1, $2, $3, $4, 1, \'{}\', \'fp1\')', [rev1, websiteId, page1Id, userId]);
    await client.query('INSERT INTO public.builder_published_revisions (id, website_id, page_id, created_by, schema_version, document, document_fingerprint) VALUES ($1, $2, $3, $4, 1, \'{}\', \'fp2\')', [rev2, websiteId, page2Id, userId]);
    await client.query('INSERT INTO public.builder_publication_targets (website_id, page_id, published_revision_id, published_at, published_by) VALUES ($1, $2, $3, now(), $4)', [websiteId, page1Id, rev1, userId]);
    await client.query('INSERT INTO public.builder_publication_targets (website_id, page_id, published_revision_id, published_at, published_by) VALUES ($1, $2, $3, now(), $4)', [websiteId, page2Id, rev2, userId]);

    client.release();

    return {
      userId,
      websiteId,
      funnel1Id,
      funnel2Id,
      funnel3Id,
      page1Id,
      page2Id,
      page3Id
    };
  }

  async function setAuth(client: any, userId: string | null) {
    if (userId) {
      await client.query(`SET request.jwt.claim.sub = '${userId}'`);
      await client.query(`SET request.jwt.claims = '{"sub":"${userId}"}'`);
      await client.query('SET ROLE authenticated');
    } else {
      await client.query('RESET request.jwt.claim.sub');
      await client.query('RESET request.jwt.claims');
      await client.query('SET ROLE anon');
    }
  }

  it('1. rejects unauthenticated plan request (PT401)', async () => {
    const { websiteId } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, null);
      await expect(
        client.query('SELECT public.get_builder_website_publish_plan($1::uuid)', [websiteId])
      ).rejects.toThrow(/Authentication required|permission denied/);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('2. rejects foreign website plan request (PT404)', async () => {
    const fixA = await createTestFixture('userA');
    const fixB = await createTestFixture('userB');
    const client = await pool.connect();
    try {
      await setAuth(client, fixA.userId);
      await expect(
        client.query('SELECT public.get_builder_website_publish_plan($1::uuid)', [fixB.websiteId])
      ).rejects.toThrow(/Website not found/);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('3. rejects unauthenticated publish request (PT401)', async () => {
    const { websiteId } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, null);
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [websiteId, '{}'])
      ).rejects.toThrow(/Authentication required|permission denied/);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('4. rejects foreign website publish request (PT404)', async () => {
    const fixA = await createTestFixture('userA');
    const fixB = await createTestFixture('userB');
    const client = await pool.connect();
    try {
      await setAuth(client, fixA.userId);
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [fixB.websiteId, '{}'])
      ).rejects.toThrow(/Website not found/);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('5. returns NO_CHANGES when no pending publishable changes exist', async () => {
    const fix = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fix.userId);
      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      const plan = planRes.rows[0].val;

      expect(plan.has_pending_changes).toBe(false);
      expect(plan.is_publishable).toBe(false);

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as val', [
        fix.websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      const result = pubRes.rows[0].val;
      expect(result.status).toBe('NO_CHANGES');
      expect(result.success).toBe(true);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('6. homepage-only unified publish promotes draft homepage and updates root route', async () => {
    const fix = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fix.userId);

      // Set draft homepage to About funnel
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2::text)', [fix.websiteId, fix.funnel2Id]);

      // Get plan
      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      const plan = planRes.rows[0].val;
      expect(plan.has_pending_changes).toBe(true);
      expect(plan.pending_domains).toContain('homepage');

      // Publish
      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as val', [
        fix.websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      const result = pubRes.rows[0].val;
      expect(result.status).toBe('PUBLISHED');
      expect(result.publication_revision).toBe(1);

      // Verify website row
      await client.query('RESET ROLE');
      const siteCheck = await client.query('SELECT homepage_funnel_id, draft_homepage_funnel_id, publication_revision FROM public.websites WHERE id = $1', [fix.websiteId]);
      expect(siteCheck.rows[0].homepage_funnel_id).toBe(fix.funnel2Id);
      expect(siteCheck.rows[0].draft_homepage_funnel_id).toBeNull();
      expect(siteCheck.rows[0].publication_revision).toBe(1);

      // Verify root route points to funnel2Id
      const routeCheck = await client.query('SELECT funnel_id FROM public.website_routes WHERE website_id = $1 AND path = $2', [fix.websiteId, '/']);
      expect(routeCheck.rows[0].funnel_id).toBe(fix.funnel2Id);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('7. cross-domain atomic publish: New Page + Route draft + Primary Navigation succeeds in 1 transaction', async () => {
    const fix = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fix.userId);

      // Stage route draft for /services -> funnel3Id using set_builder_route_draft
      await client.query(
        'SELECT public.set_builder_route_draft($1::uuid, $2::text, $3::text)',
        [fix.websiteId, fix.funnel3Id, '/services']
      );

      // Stage primary navigation draft pointing to funnel3Id
      const navItem = {
        id: randomUUID(),
        label: 'Our Services',
        target_kind: 'internal',
        target_value: fix.funnel3Id,
        position: 0,
        visible: true,
        is_cta: false
      };
      await client.query(
        'SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb)',
        [fix.websiteId, 'primary', JSON.stringify([navItem])]
      );

      // Get plan: projected final route set includes /services, so nav link is VALID!
      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      const plan = planRes.rows[0].val;

      expect(plan.blockers.length).toBe(0);
      expect(plan.is_publishable).toBe(true);
      expect(plan.pending_domains).toContain('routes');
      expect(plan.pending_domains).toContain('primary_navigation');
      expect(plan.pending_domains).toContain('pages');

      // Publish in one atomic transaction
      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as val', [
        fix.websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      const result = pubRes.rows[0].val;
      expect(result.status).toBe('PUBLISHED');

      // Verify live route exists
      await client.query('RESET ROLE');
      const liveRoute = await client.query('SELECT path, funnel_id FROM public.website_routes WHERE website_id = $1 AND path = $2', [fix.websiteId, '/services']);
      expect(liveRoute.rows[0].funnel_id).toBe(fix.funnel3Id);

      // Verify live nav exists
      const liveNav = await client.query('SELECT items, revision FROM public.builder_site_navigation_live WHERE website_id = $1 AND menu_scope = $2', [fix.websiteId, 'primary']);
      expect(liveNav.rows[0].items[0].label).toBe('Our Services');
      expect(liveNav.rows[0].revision).toBe(1);

      // Verify drafts cleared
      const routeDrafts = await client.query('SELECT count(*) FROM public.builder_route_drafts WHERE website_id = $1', [fix.websiteId]);
      expect(Number(routeDrafts.rows[0].count)).toBe(0);

      const navDrafts = await client.query('SELECT count(*) FROM public.builder_site_navigation_drafts WHERE website_id = $1', [fix.websiteId]);
      expect(Number(navDrafts.rows[0].count)).toBe(0);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('8. cross-domain circular resolution: Nav link removal + final route deletion succeeds without deadlock', async () => {
    const fix = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fix.userId);

      // Initially publish nav pointing to /about (funnel2Id)
      const navItem = {
        id: randomUUID(),
        label: 'About Us',
        target_kind: 'internal',
        target_value: fix.funnel2Id,
        position: 0,
        visible: true,
        is_cta: false
      };
      await client.query(
        'SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb)',
        [fix.websiteId, 'primary', JSON.stringify([navItem])]
      );
      const plan1Res = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [fix.websiteId, JSON.stringify(plan1Res.rows[0].val.expected_state)]);

      // Now: stage route draft to delete /about route using delete_builder_route_draft
      const aboutRoute = await client.query('SELECT id FROM public.website_routes WHERE website_id = $1 AND path = $2', [fix.websiteId, '/about']);
      await client.query(
        'SELECT public.delete_builder_route_draft($1::uuid, $2::text, $3::uuid)',
        [fix.websiteId, fix.funnel2Id, aboutRoute.rows[0].id]
      );

      // And stage nav draft removing the item
      await client.query(
        'SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb)',
        [fix.websiteId, 'primary', '[]']
      );

      // Plan should see projected nav has removed the item, so deleting the route is ALLOWED!
      const plan2Res = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      const plan2 = plan2Res.rows[0].val;
      expect(plan2.blockers.length).toBe(0);
      expect(plan2.is_publishable).toBe(true);

      // Publish succeeds
      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as val', [
        fix.websiteId,
        JSON.stringify(plan2.expected_state)
      ]);
      expect(pubRes.rows[0].val.status).toBe('PUBLISHED');

      // Verify route was deleted and nav updated to empty
      await client.query('RESET ROLE');
      const checkRoute = await client.query('SELECT * FROM public.website_routes WHERE website_id = $1 AND path = $2', [fix.websiteId, '/about']);
      expect(checkRoute.rows.length).toBe(0);

      const checkNav = await client.query('SELECT items FROM public.builder_site_navigation_live WHERE website_id = $1 AND menu_scope = $2', [fix.websiteId, 'primary']);
      expect(checkNav.rows[0].items).toEqual([]);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('9. blocks publish and rolls back completely when projected nav target is invalid/unrouted', async () => {
    const fix = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fix.userId);

      // Associate funnel3Id via a temporary route draft first so stage nav succeeds
      await client.query(
        'SELECT public.set_builder_route_draft($1::uuid, $2::text, $3::text)',
        [fix.websiteId, fix.funnel3Id, '/services']
      );

      const invalidNavItem = {
        id: randomUUID(),
        label: 'Unrouted Link',
        target_kind: 'internal',
        target_value: fix.funnel3Id,
        position: 0,
        visible: true,
        is_cta: false
      };
      await client.query(
        'SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb)',
        [fix.websiteId, 'primary', JSON.stringify([invalidNavItem])]
      );

      // Now revert the route draft for /services so funnel3Id has no route in projected state
      await client.query('SELECT public.revert_builder_route_draft($1::uuid, $2::text)', [fix.websiteId, fix.funnel3Id]);

      // Stage valid draft homepage to About
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2::text)', [fix.websiteId, fix.funnel2Id]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      const plan = planRes.rows[0].val;

      expect(plan.is_publishable).toBe(false);
      expect(plan.blockers.length).toBeGreaterThan(0);
      expect(plan.blockers[0].code).toBe('NAV_TARGET_UNROUTED');

      // Attempt publish -> rejected
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          fix.websiteId,
          JSON.stringify(plan.expected_state)
        ])
      ).rejects.toThrow(/Primary navigation link "Unrouted Link" points to a destination without a public route/);

      // Verify 100% rollback: homepage remained live funnel1Id
      await client.query('RESET ROLE');
      const siteCheck = await client.query('SELECT homepage_funnel_id, draft_homepage_funnel_id FROM public.websites WHERE id = $1', [fix.websiteId]);
      expect(siteCheck.rows[0].homepage_funnel_id).toBe(fix.funnel1Id);
      expect(siteCheck.rows[0].draft_homepage_funnel_id).toBe(fix.funnel2Id); // draft preserved!
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('10. strict optimistic concurrency: stale expected_state rejects with PT409', async () => {
    const fix = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fix.userId);

      // Stage a draft
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2::text)', [fix.websiteId, fix.funnel2Id]);
      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      const plan = planRes.rows[0].val;

      // Tamper with expected state (stale publication revision or wrong route draft ID)
      const staleExpectedState = {
        ...plan.expected_state,
        publication_revision: 999
      };

      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          fix.websiteId,
          JSON.stringify(staleExpectedState)
        ])
      ).rejects.toThrow(/Website changes were updated elsewhere/);
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('11. creates immutable publication audit record upon successful publication', async () => {
    const fix = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fix.userId);

      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2::text)', [fix.websiteId, fix.funnel2Id]);
      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as val', [fix.websiteId]);
      const plan = planRes.rows[0].val;

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as val', [
        fix.websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      const pubId = pubRes.rows[0].val.publication_id;

      await client.query('RESET ROLE');
      const auditCheck = await client.query(
        'SELECT * FROM public.builder_website_publications WHERE id = $1',
        [pubId]
      );
      expect(auditCheck.rows.length).toBe(1);
      expect(auditCheck.rows[0].publication_revision).toBe(1);
      expect(auditCheck.rows[0].published_by).toBe(fix.userId);
      expect(auditCheck.rows[0].summary).toBeDefined();
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });
});
