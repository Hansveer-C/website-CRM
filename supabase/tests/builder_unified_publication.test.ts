import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const { Pool } = pg;

const DATABASE_URL =
  process.env.TEST_POSTGRES_URL ||
  process.env.PG_DATABASE_URL ||
  process.env.TEST_DATABASE_URL;

const MIGRATIONS = [
  resolve(__dirname, '../migrations/20260810134911_save_page_sections_document.sql'),
  resolve(__dirname, '../migrations/20260817050400_set_builder_homepage.sql'),
  resolve(__dirname, '../migrations/20260817050500_create_builder_route_drafts.sql'),
  resolve(__dirname, '../migrations/20260817050600_create_builder_route_redirects_and_publication.sql'),
  resolve(__dirname, '../migrations/20260817050700_create_builder_site_navigation.sql'),
  resolve(__dirname, '../migrations/20260817050800_create_builder_navigation_publication_and_runtime.sql'),
  resolve(__dirname, '../migrations/20260817050900_create_builder_unified_website_publication.sql')
];

describe.skipIf(!DATABASE_URL)('Builder Phase 1B / Task 7 — Hardened Unified Publish Website DB Integration Tests (PostgreSQL 17)', () => {
  let pool: pg.Pool;

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
          created_at timestamptz not null default now()
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

        create table if not exists public.builder_publication_targets (
          website_id uuid not null references public.websites(id) on delete cascade,
          page_id text not null references public.pages(id) on delete cascade,
          published_revision_id uuid not null,
          published_at timestamptz not null default now(),
          published_by text,
          primary key (website_id, page_id)
        );

        create or replace function auth.uid() returns uuid as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$ language sql stable;

        grant all on table public.users to authenticated, anon, service_role;
        grant all on table public.funnels to authenticated, anon, service_role;
        grant all on table public.pages to authenticated, anon, service_role;
        grant all on table public.page_sections to authenticated, anon, service_role;
        grant all on table public.websites to authenticated, anon, service_role;
        grant all on table public.website_routes to authenticated, anon, service_role;
        grant all on table public.builder_published_revisions to authenticated, anon, service_role;
        grant all on table public.builder_publication_targets to authenticated, anon, service_role;
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

  async function createTestFixture() {
    const client = await pool.connect();
    const userId = randomUUID();
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

    await client.query('INSERT INTO public.pages (id, user_id, funnel_id, name, slug, status) VALUES ($1, $2, $3, $4, $5, $6)', [
      page1Id, userId, funnel1Id, 'Home Page', 'home', 'published'
    ]);
    await client.query('INSERT INTO public.pages (id, user_id, funnel_id, name, slug, status) VALUES ($1, $2, $3, $4, $5, $6)', [
      page2Id, userId, funnel2Id, 'About Page', 'about', 'published'
    ]);
    await client.query('INSERT INTO public.pages (id, user_id, funnel_id, name, slug, status) VALUES ($1, $2, $3, $4, $5, $6)', [
      page3Id, userId, funnel3Id, 'Services Page', 'services', 'published'
    ]);

    // Save initial page sections via canonical save_page_sections_document
    await client.query(`set "request.jwt.claim.sub" = '${userId}'`);

    const sec1 = [{ id: `sec1-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Welcome' }, styles: {} }];
    const sec2 = [{ id: `sec2-${randomUUID()}`, page_id: page2Id, type: 'hero', order: 0, content: { title: 'About Us' }, styles: {} }];
    const sec3 = [{ id: `sec3-${randomUUID()}`, page_id: page3Id, type: 'hero', order: 0, content: { title: 'Our Services' }, styles: {} }];

    await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 1)', [page1Id, JSON.stringify(sec1)]);
    await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 1)', [page2Id, JSON.stringify(sec2)]);
    await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 1)', [page3Id, JSON.stringify(sec3)]);

    await client.query(`set "request.jwt.claim.sub" = ''`);

    const websiteRes = await client.query(
      `INSERT INTO public.websites (user_id, name, subdomain, homepage_funnel_id, publication_revision)
       VALUES ($1, $2, $3, $4, 1) RETURNING id`,
      [userId, 'Test Clean Website', `sub-${randomUUID().substring(0, 8)}`, funnel1Id]
    );
    const websiteId = websiteRes.rows[0].id;

    // Create root route and /about route
    await client.query('INSERT INTO public.website_routes (website_id, path, funnel_id) VALUES ($1, $2, $3)', [
      websiteId, '/', funnel1Id
    ]);
    const routeAboutRes = await client.query('INSERT INTO public.website_routes (website_id, path, funnel_id) VALUES ($1, $2, $3) RETURNING id', [
      websiteId, '/about', funnel2Id
    ]);
    const routeAboutId = routeAboutRes.rows[0].id;

    // Create initial published revisions and targets for page 1 and page 2 so they start fully synchronized
    const doc1 = {
      schemaVersion: 1,
      page: { id: page1Id, user_id: userId, funnel_id: funnel1Id, name: 'Home Page', slug: 'home', status: 'published', step_order: 0 },
      sections: [{ id: sec1[0].id, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Welcome' }, styles: {} }]
    };
    const rev1Id = randomUUID();
    await client.query(
      `INSERT INTO public.builder_published_revisions (id, website_id, page_id, created_at, created_by, schema_version, document, document_fingerprint)
       VALUES ($1, $2, $3, now(), $4, 1, $5::jsonb, md5($5::text))`,
      [rev1Id, websiteId, page1Id, userId, JSON.stringify(doc1)]
    );
    await client.query(
      `INSERT INTO public.builder_publication_targets (website_id, page_id, published_revision_id, published_at, published_by)
       VALUES ($1, $2, $3, now(), $4)`,
      [websiteId, page1Id, rev1Id, userId]
    );

    const doc2 = {
      schemaVersion: 1,
      page: { id: page2Id, user_id: userId, funnel_id: funnel2Id, name: 'About Page', slug: 'about', status: 'published', step_order: 0 },
      sections: [{ id: sec2[0].id, page_id: page2Id, type: 'hero', order: 0, content: { title: 'About Us' }, styles: {} }]
    };
    const rev2Id = randomUUID();
    await client.query(
      `INSERT INTO public.builder_published_revisions (id, website_id, page_id, created_at, created_by, schema_version, document, document_fingerprint)
       VALUES ($1, $2, $3, now(), $4, 1, $5::jsonb, md5($5::text))`,
      [rev2Id, websiteId, page2Id, userId, JSON.stringify(doc2)]
    );
    await client.query(
      `INSERT INTO public.builder_publication_targets (website_id, page_id, published_revision_id, published_at, published_by)
       VALUES ($1, $2, $3, now(), $4)`,
      [websiteId, page2Id, rev2Id, userId]
    );

    client.release();

    return {
      userId,
      websiteId,
      funnel1Id,
      funnel2Id,
      funnel3Id,
      page1Id,
      page2Id,
      page3Id,
      routeAboutId
    };
  }

  async function setAuth(client: pg.PoolClient, userId: string | null) {
    if (userId) {
      await client.query(`set "request.jwt.claim.sub" = '${userId}'`);
    } else {
      await client.query(`set "request.jwt.claim.sub" = ''`);
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
      await setAuth(client, null);
      client.release();
    }
  });

  it('2. rejects foreign website plan request (PT404)', async () => {
    const fixA = await createTestFixture();
    const fixB = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fixA.userId);
      await expect(
        client.query('SELECT public.get_builder_website_publish_plan($1::uuid)', [fixB.websiteId])
      ).rejects.toThrow(/Website not found/);
    } finally {
      await setAuth(client, null);
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
      await setAuth(client, null);
      client.release();
    }
  });

  it('4. rejects foreign website publish request (PT404)', async () => {
    const fixA = await createTestFixture();
    const fixB = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, fixA.userId);
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [fixB.websiteId, '{}'])
      ).rejects.toThrow(/Website not found/);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('5. published page edited through canonical save boundary: plan reports page pending (A & B)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Baseline: plan should report no changes
      const plan1Res = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan1 = plan1Res.rows[0].plan;
      expect(plan1.has_pending_changes).toBe(false);
      expect(plan1.summary.pages.has_changes).toBe(false);

      // Edit page1 through canonical save boundary
      const updatedSec1 = [
        { id: `sec1-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Updated Welcome Title' }, styles: {} }
      ];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(updatedSec1)]);

      // Now plan should report page1 pending
      const plan2Res = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan2 = plan2Res.rows[0].plan;
      expect(plan2.has_pending_changes).toBe(true);
      expect(plan2.pending_domains).toContain('pages');
      expect(plan2.summary.pages.has_changes).toBe(true);
      expect(plan2.summary.pages.count).toBe(1);
      expect(plan2.summary.pages.items[0].page_id).toBe(page1Id);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('6. content-only unified publish: publishes exact saved BuilderDocument (C)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Edit page1 content
      const updatedSec = [
        { id: `sec1-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Exclusive Special' }, styles: {} }
      ];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(updatedSec)]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      const res = pubRes.rows[0].res;
      expect(res.success).toBe(true);
      expect(res.status).toBe('PUBLISHED');
      expect(res.publication_revision).toBe(2);

      // Verify the new publication target
      const targetRes = await client.query(
        'SELECT bpt.*, bpr.document FROM public.builder_publication_targets bpt JOIN public.builder_published_revisions bpr ON bpr.id = bpt.published_revision_id WHERE bpt.website_id = $1 AND bpt.page_id = $2',
        [websiteId, page1Id]
      );
      expect(targetRes.rows.length).toBe(1);
      expect(targetRes.rows[0].document.sections[0].content.title).toBe('Exclusive Special');
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('7. concurrent page save after plan results in PT409 conflict (D & E)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // 1. Initial edit and plan
      const secA = [{ id: `sec-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Title A' }, styles: {} }];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(secA)]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const staleExpectedState = planRes.rows[0].plan.expected_state;

      // 2. Another tab edits the page content (e.g. revision 3)
      const secB = [{ id: `sec-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Title B' }, styles: {} }];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 3)', [page1Id, JSON.stringify(secB)]);

      // 3. First tab attempts to publish with stale expected_state
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          websiteId,
          JSON.stringify(staleExpectedState)
        ])
      ).rejects.toThrow(/Website changes were updated elsewhere/);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('8. navigation-only unified publish creates ZERO new builder_published_revisions (F)', async () => {
    const { userId, websiteId, funnel1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Count initial published revisions
      const initialRevCountRes = await client.query('SELECT count(*)::integer as count FROM public.builder_published_revisions WHERE website_id = $1', [websiteId]);
      const initialRevCount = initialRevCountRes.rows[0].count;

      // Create primary nav draft
      const navItems = [{ id: randomUUID(), label: 'Home', target_kind: 'homepage', target_value: '', visible: true }];
      await client.query('SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb, 0)', [
        websiteId, 'primary', JSON.stringify(navItems)
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;
      expect(plan.summary.pages.has_changes).toBe(false);
      expect(plan.summary.primary_navigation.has_changes).toBe(true);

      await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);

      // Assert ZERO new builder_published_revisions were created
      const finalRevCountRes = await client.query('SELECT count(*)::integer as count FROM public.builder_published_revisions WHERE website_id = $1', [websiteId]);
      expect(finalRevCountRes.rows[0].count).toBe(initialRevCount);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('9. route-only and homepage-only publish do not republish unchanged page content (G & H)', async () => {
    const { userId, websiteId, funnel2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      const initialRevCountRes = await client.query('SELECT count(*)::integer as count FROM public.builder_published_revisions WHERE website_id = $1', [websiteId]);
      const initialRevCount = initialRevCountRes.rows[0].count;

      // Change draft homepage to funnel2
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2)', [websiteId, funnel2Id]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;
      expect(plan.summary.homepage.changed).toBe(true);
      expect(plan.summary.pages.has_changes).toBe(false);

      await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);

      const finalRevCountRes = await client.query('SELECT count(*)::integer as count FROM public.builder_published_revisions WHERE website_id = $1', [websiteId]);
      expect(finalRevCountRes.rows[0].count).toBe(initialRevCount);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('10. new page + content + route + nav succeeds atomically in ONE transaction (I)', async () => {
    const { userId, websiteId, funnel3Id, page3Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Create route draft for /services -> funnel3
      await client.query('SELECT public.set_builder_route_draft($1::uuid, $2, $3)', [
        websiteId, funnel3Id, '/services'
      ]);

      // Create nav draft pointing to funnel3
      const navItems = [
        { id: randomUUID(), label: 'Home', target_kind: 'homepage', target_value: '', visible: true },
        { id: randomUUID(), label: 'Services', target_kind: 'internal', target_value: funnel3Id, visible: true }
      ];
      await client.query('SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb, 0)', [
        websiteId, 'primary', JSON.stringify(navItems)
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      expect(plan.is_publishable).toBe(true);
      expect(plan.blockers.length).toBe(0);
      expect(plan.summary.pages.has_changes).toBe(true);
      expect(plan.summary.routes.has_changes).toBe(true);
      expect(plan.summary.primary_navigation.has_changes).toBe(true);

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      expect(pubRes.rows[0].res.success).toBe(true);

      // Verify route /services exists and target exists
      const routeCheck = await client.query('SELECT * FROM public.website_routes WHERE website_id = $1 AND path = $2', [websiteId, '/services']);
      expect(routeCheck.rows.length).toBe(1);

      const targetCheck = await client.query('SELECT * FROM public.builder_publication_targets WHERE website_id = $1 AND page_id = $2', [websiteId, page3Id]);
      expect(targetCheck.rows.length).toBe(1);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('11. same route draft ID with mutated path, funnel, or action throws PT409 (20.A, 20.B, 20.C)', async () => {
    const { userId, websiteId, funnel2Id, funnel3Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // 1. Stage route draft /pricing -> funnel2
      const stageRes = await client.query('SELECT public.set_builder_route_draft($1::uuid, $2, $3) as res', [
        websiteId, funnel2Id, '/pricing'
      ]);
      const draftId = stageRes.rows[0].res.draft.id;

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const staleExpectedState = planRes.rows[0].plan.expected_state;

      // 2. In-place mutation of the same draft row to /pricing-plans -> funnel3
      await client.query('UPDATE public.builder_route_drafts SET path = $1, funnel_id = $2 WHERE id = $3', [
        '/pricing-plans', funnel3Id, draftId
      ]);

      // 3. Attempt to publish using stale expected state
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          websiteId,
          JSON.stringify(staleExpectedState)
        ])
      ).rejects.toThrow(/Website changes were updated elsewhere/);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('12. same-path funnel reassignment succeeds without redirect (20.E)', async () => {
    const { userId, websiteId, funnel3Id, routeAboutId } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Directly stage route draft for existing route /about to point to funnel3
      await client.query(
        `INSERT INTO public.builder_route_drafts (website_id, route_id, path, funnel_id, action)
         VALUES ($1, $2, $3, $4, 'upsert')`,
        [websiteId, routeAboutId, '/about', funnel3Id]
      );

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      expect(pubRes.rows[0].res.success).toBe(true);

      // Verify route destination changed
      const routeCheck = await client.query('SELECT * FROM public.website_routes WHERE id = $1', [routeAboutId]);
      expect(routeCheck.rows[0].funnel_id).toBe(funnel3Id);

      // Verify NO redirect was created since path did not change
      const redirCheck = await client.query('SELECT * FROM public.website_route_redirects WHERE website_id = $1', [websiteId]);
      expect(redirCheck.rows.length).toBe(0);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('13. rename + destination change creates redirect and collapses chains (20.F, 20.G, 20.I)', async () => {
    const { userId, websiteId, funnel3Id, routeAboutId } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Pre-existing redirect /company -> /about
      await client.query(
        'INSERT INTO public.website_route_redirects (website_id, from_path, to_path) VALUES ($1, $2, $3)',
        [websiteId, '/company', '/about']
      );

      // Rename route /about -> /our-story with funnel3
      await client.query('SELECT public.set_builder_route_draft($1::uuid, $2, $3, $4::uuid)', [
        websiteId, funnel3Id, '/our-story', routeAboutId
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);

      // Verify live route
      const routeCheck = await client.query('SELECT * FROM public.website_routes WHERE id = $1', [routeAboutId]);
      expect(routeCheck.rows[0].path).toBe('/our-story');
      expect(routeCheck.rows[0].funnel_id).toBe(funnel3Id);

      // Verify redirects:
      // 1. /about -> /our-story
      // 2. /company -> /our-story (collapsed from /company -> /about)
      const redirs = await client.query('SELECT from_path, to_path FROM public.website_route_redirects WHERE website_id = $1 ORDER BY from_path', [websiteId]);
      expect(redirs.rows).toEqual([
        { from_path: '/about', to_path: '/our-story' },
        { from_path: '/company', to_path: '/our-story' }
      ]);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('14. full cross-domain rollback: any invalid component rolls back everything (21)', async () => {
    const { userId, websiteId, page1Id, funnel2Id, funnel3Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // 1. Page edit
      const secA = [{ id: `sec-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Tentative' }, styles: {} }];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(secA)]);

      // 2. Homepage draft
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2)', [websiteId, funnel2Id]);

      // 3. Route draft
      await client.query('SELECT public.set_builder_route_draft($1::uuid, $2, $3)', [
        websiteId, funnel3Id, '/services-new'
      ]);

      // 4. Primary nav pointing to funnel3 (valid while route draft exists)
      const navItems = [
        { id: randomUUID(), label: 'Services Link', target_kind: 'internal', target_value: funnel3Id, visible: true }
      ];
      await client.query('SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb, 0)', [
        websiteId, 'primary', JSON.stringify(navItems)
      ]);

      // 5. Delete the route draft for funnel3 so that the nav item is now UNROUTED
      await client.query('DELETE FROM public.builder_route_drafts WHERE website_id = $1 AND funnel_id = $2', [
        websiteId, funnel3Id
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;
      expect(plan.is_publishable).toBe(false);
      expect(plan.blockers.length).toBeGreaterThan(0);

      // Attempt to publish
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          websiteId,
          JSON.stringify(plan.expected_state)
        ])
      ).rejects.toThrow(/Publication blocked|without a public route/);

      // Verify EVERYTHING remained untouched in live tables
      const webCheck = await client.query('SELECT publication_revision, homepage_funnel_id, draft_homepage_funnel_id FROM public.websites WHERE id = $1', [websiteId]);
      expect(webCheck.rows[0].publication_revision).toBe(1);
      expect(webCheck.rows[0].draft_homepage_funnel_id).toBe(funnel2Id); // Draft preserved

      const pubCountRes = await client.query('SELECT count(*)::integer as count FROM public.builder_website_publications WHERE website_id = $1', [websiteId]);
      expect(pubCountRes.rows[0].count).toBe(0);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('15. no-change retry / history idempotency (22)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Perform a valid publish
      const secA = [{ id: `sec-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'New Edition' }, styles: {} }];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(secA)]);

      const planRes1 = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
        websiteId,
        JSON.stringify(planRes1.rows[0].plan.expected_state)
      ]);

      // Call plan again: has_pending_changes must be false
      const planRes2 = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      expect(planRes2.rows[0].plan.has_pending_changes).toBe(false);

      // If published again with fresh plan: returns NO_CHANGES without incrementing revision or audit row
      const noChangeRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(planRes2.rows[0].plan.expected_state)
      ]);
      expect(noChangeRes.rows[0].res.status).toBe('NO_CHANGES');

      const auditCount = await client.query('SELECT count(*)::integer as count FROM public.builder_website_publications WHERE website_id = $1', [websiteId]);
      expect(auditCount.rows[0].count).toBe(1); // Only 1 audit record exists
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });
});
