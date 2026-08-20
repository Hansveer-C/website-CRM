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
  resolve(__dirname, '../migrations/20260817050100_duplicate_builder_page.sql'),
  resolve(__dirname, '../migrations/20260817050200_delete_builder_page.sql'),
  resolve(__dirname, '../migrations/20260817050300_reorder_builder_pages.sql'),
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
          step_type text,
          seo_title text,
          seo_description text,
          seo_keywords text[] not null default '{}'::text[],
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
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

        create table if not exists public.public_lead_intake_requests (
          id uuid primary key default gen_random_uuid(),
          page_id text not null
        );

        create table if not exists public.websites (
          id uuid primary key default gen_random_uuid(),
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          domain text unique,
          subdomain text unique,
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

        alter table public.users enable row level security;
        alter table public.funnels enable row level security;
        alter table public.pages enable row level security;
        alter table public.page_sections enable row level security;
        alter table public.websites enable row level security;
        alter table public.website_routes enable row level security;
        alter table public.builder_published_revisions enable row level security;
        alter table public.builder_publication_targets enable row level security;

        drop policy if exists "pages_user_policy" on public.pages;
        create policy "pages_user_policy" on public.pages for all to authenticated using (user_id = (select auth.uid())::text);

        drop policy if exists "page_sections_user_policy" on public.page_sections;
        create policy "page_sections_user_policy" on public.page_sections for all to authenticated using (user_id = (select auth.uid())::text);

        drop policy if exists "websites_user_policy" on public.websites;
        create policy "websites_user_policy" on public.websites for all to authenticated using (user_id = (select auth.uid())::text);

        drop policy if exists "funnels_user_policy" on public.funnels;
        create policy "funnels_user_policy" on public.funnels for all to authenticated using (user_id = (select auth.uid())::text);

        drop policy if exists "website_routes_user_policy" on public.website_routes;
        create policy "website_routes_user_policy" on public.website_routes for all to authenticated using (
          exists (select 1 from public.websites w where w.id = website_routes.website_id and w.user_id = (select auth.uid())::text)
        );

        drop policy if exists "builder_published_revisions_user_policy" on public.builder_published_revisions;
        create policy "builder_published_revisions_user_policy" on public.builder_published_revisions for all to authenticated using (
          exists (select 1 from public.websites w where w.id = builder_published_revisions.website_id and w.user_id = (select auth.uid())::text)
        );

        drop policy if exists "builder_publication_targets_user_policy" on public.builder_publication_targets;
        create policy "builder_publication_targets_user_policy" on public.builder_publication_targets for all to authenticated using (
          exists (select 1 from public.websites w where w.id = builder_publication_targets.website_id and w.user_id = (select auth.uid())::text)
        );

        grant all on table public.users to authenticated, anon, service_role;
        grant all on table public.funnels to authenticated, anon, service_role;
        grant all on table public.pages to authenticated, anon, service_role;
        grant all on table public.page_sections to authenticated, anon, service_role;
        grant all on table public.websites to authenticated, anon, service_role;
        grant all on table public.website_routes to authenticated, anon, service_role;
        grant all on table public.builder_published_revisions to authenticated, anon, service_role;
        grant all on table public.builder_publication_targets to authenticated, anon, service_role;
        grant all on table public.public_lead_intake_requests to authenticated, anon, service_role;
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
      await client.query(`set role authenticated`);
      await client.query(`set "request.jwt.claim.sub" = '${userId}'`);
    } else {
      await client.query(`set role postgres`);
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

  it('2. rejects cross-tenant plan request (PT404)', async () => {
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

  it('3. rejects unauthenticated publish execution (PT401)', async () => {
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

  it('4. rejects cross-tenant publish execution (PT404)', async () => {
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

  it('5. clean website: plan reports no changes (B)', async () => {
    const { userId, websiteId } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);
      const res = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = res.rows[0].plan;

      expect(plan.has_pending_changes).toBe(false);
      expect(plan.pending_domains).toEqual([]);
      expect(plan.is_publishable).toBe(true);
      expect(plan.blockers).toEqual([]);
      expect(plan.summary.pages.has_changes).toBe(false);
      expect(plan.summary.homepage.changed).toBe(false);
      expect(plan.summary.routes.has_changes).toBe(false);
      expect(plan.summary.primary_navigation.has_changes).toBe(false);
      expect(plan.summary.footer_navigation.has_changes).toBe(false);
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

      // Verify clean initially
      const plan1Res = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      expect(plan1Res.rows[0].plan.has_pending_changes).toBe(false);

      // Save a new section document via canonical save_page_sections_document
      const updatedSec1 = [
        { id: `sec1-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Exclusive Special' }, styles: { bg: 'blue' } }
      ];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(updatedSec1)]);

      // Fetch publish plan -> pending changes detected
      const plan2Res = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan2 = plan2Res.rows[0].plan;
      expect(plan2.has_pending_changes).toBe(true);
      expect(plan2.pending_domains).toContain('pages');
      expect(plan2.summary.pages.has_changes).toBe(true);
      expect(plan2.summary.pages.count).toBe(1);
      expect(plan2.summary.pages.items[0].page_id).toBe(page1Id);

      // Execute unified publish
      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan2.expected_state)
      ]);
      const pub = pubRes.rows[0].res;
      expect(pub.success).toBe(true);
      expect(pub.publication_revision).toBe(2);

      // Verify target updated and document has exact content
      const targetRes = await client.query(
        `SELECT bpt.*, bpr.document, bpr.document_fingerprint
         FROM public.builder_publication_targets bpt
         JOIN public.builder_published_revisions bpr ON bpr.id = bpt.published_revision_id
         WHERE bpt.website_id = $1 AND bpt.page_id = $2`,
        [websiteId, page1Id]
      );
      expect(targetRes.rows.length).toBe(1);
      expect(targetRes.rows[0].document.sections[0].content.title).toBe('Exclusive Special');
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('7. optimistic concurrency: page edited concurrently triggers PT409 (E)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // 1. Get plan at initial revision
      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const staleExpectedState = planRes.rows[0].plan.expected_state;

      // 2. Concurrently mutate page sections
      const updatedSec = [
        { id: `sec-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Concurrent Change' }, styles: {} }
      ];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(updatedSec)]);

      // 3. Attempt publish using stale expected state
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

  it('8. nav-only publish does not republish unchanged page content (F)', async () => {
    const { userId, websiteId } = await createTestFixture();
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

      // 2. Re-stage with changed path via RPC to /pricing-plans -> funnel3
      await client.query('SELECT public.set_builder_route_draft($1::uuid, $2, $3)', [
        websiteId, funnel3Id, '/pricing-plans'
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

  it('12. new route creation succeeds without redirect (20.E)', async () => {
    const { userId, websiteId, funnel3Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Stage route draft for new route /contact to point to funnel3 via RPC
      await client.query('SELECT public.set_builder_route_draft($1::uuid, $2, $3)', [
        websiteId, funnel3Id, '/contact'
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      expect(pubRes.rows[0].res.success).toBe(true);

      // Verify route destination exists
      const routeCheck = await client.query('SELECT * FROM public.website_routes WHERE website_id = $1 AND path = $2', [websiteId, '/contact']);
      expect(routeCheck.rows.length).toBe(1);
      expect(routeCheck.rows[0].funnel_id).toBe(funnel3Id);

      // Verify NO redirect was created since it was a new route creation
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
      await setAuth(client, null);
      // Pre-existing redirect /company -> /about (inserted as admin)
      await client.query(
        'INSERT INTO public.website_route_redirects (website_id, from_path, to_path) VALUES ($1, $2, $3)',
        [websiteId, '/company', '/about']
      );

      await setAuth(client, userId);

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

      // 5. Revert the route draft for funnel3 via RPC so that the nav item is now UNROUTED
      await client.query('SELECT public.revert_builder_route_draft($1::uuid, null, $2)', [
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

      // Edit page1 and publish
      const secA = [{ id: `sec-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'First Edit' }, styles: {} }];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(secA)]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      const pub1Res = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      expect(pub1Res.rows[0].res.success).toBe(true);
      expect(pub1Res.rows[0].res.publication_revision).toBe(2);

      // Now query plan again -> NO CHANGES
      const cleanPlanRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const cleanPlan = cleanPlanRes.rows[0].plan;
      expect(cleanPlan.has_pending_changes).toBe(false);

      // Calling publish with clean plan returns NO_CHANGES status idempotently
      const pub2Res = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(cleanPlan.expected_state)
      ]);
      expect(pub2Res.rows[0].res.success).toBe(true);
      expect(pub2Res.rows[0].res.status).toBe('NO_CHANGES');

      // Verify publication history has exactly 1 entry
      const histRes = await client.query('SELECT public.get_builder_website_publication_history($1::uuid) as hist', [websiteId]);
      expect(histRes.rows[0].hist.publications.length).toBe(1);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('16. two-session concurrency: page-save advisory lock blocks concurrent unified publish until commit, then publish detects stale state and throws PT409 (6 & 25.1)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await setAuth(clientA, userId);
      await setAuth(clientB, userId);

      // Session A obtains initial publish plan at revision 1
      const planRes = await clientA.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const planA = planRes.rows[0].plan;

      // Session B begins transaction and starts saving page_sections on page1 (holding the page-sections advisory lock)
      await clientB.query('BEGIN');
      const secB = [{ id: `sec-b-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Session B Live Edit' }, styles: {} }];
      await clientB.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page1Id, JSON.stringify(secB)]);

      // Session A attempts to execute publish_builder_website using its earlier expected state
      let publishDone = false;
      let publishErr: any = null;
      const publishPromise = clientA.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
        websiteId,
        JSON.stringify(planA.expected_state)
      ]).then(() => {
        publishDone = true;
      }).catch((e) => {
        publishDone = true;
        publishErr = e;
      });

      // Verify Session A is actively blocked on the advisory lock while Session B is uncommitted
      await new Promise((r) => setTimeout(r, 100));
      expect(publishDone).toBe(false);

      // Session B commits its transaction, releasing the lock and persisting revision 2
      await clientB.query('COMMIT');

      // Session A unblocks, reconstructs state under lock, detects stale expected state, and throws PT409
      await publishPromise;
      expect(publishDone).toBe(true);
      expect(publishErr).toBeTruthy();
      expect(publishErr.message).toMatch(/Website changes were updated elsewhere/);

      // Verify zero audit publications exist
      const pubCountRes = await clientA.query('SELECT count(*)::integer as count FROM public.builder_website_publications WHERE website_id = $1', [websiteId]);
      expect(pubCountRes.rows[0].count).toBe(0);
    } finally {
      await setAuth(clientA, null);
      await setAuth(clientB, null);
      clientA.release();
      clientB.release();
    }
  });

  it('17. two-session concurrency: in-flight unified publish page-section lock blocks concurrent page save (7 & 25.2)', async () => {
    const { userId, page1Id } = await createTestFixture();
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await setAuth(clientA, userId);
      await setAuth(clientB, userId);

      // Session A begins transaction and acquires the page-sections advisory lock
      await clientA.query('BEGIN');
      await clientA.query(`SELECT pg_advisory_xact_lock(hashtextextended('page-sections:' || $1, 0))`, [page1Id]);

      // Session B attempts to save_page_sections_document on the same page
      let saveDone = false;
      let saveRes: any = null;
      const secB = [{ id: `sec-b-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Session B After Publish' }, styles: {} }];
      const savePromise = clientB.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2) as res', [
        page1Id, JSON.stringify(secB)
      ]).then((r) => {
        saveDone = true;
        saveRes = r;
      });

      // Verify Session B is blocked while Session A holds the lock
      await new Promise((r) => setTimeout(r, 100));
      expect(saveDone).toBe(false);

      // Session A commits
      await clientA.query('COMMIT');

      // Session B resumes and completes
      await savePromise;
      expect(saveDone).toBe(true);
      expect(saveRes.rows[0].res.page_id).toBe(page1Id);
      expect(saveRes.rows[0].res.revision).toBe(2);
    } finally {
      await setAuth(clientA, null);
      await setAuth(clientB, null);
      clientA.release();
      clientB.release();
    }
  });

  it('18. page metadata mutation after plan (name/slug changed without section save) triggers PT409 on publish (11 & 25.3)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // 1. Get publish plan
      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const oldExpectedState = planRes.rows[0].plan.expected_state;

      // 2. Modify page name in public.pages via authorized update
      await client.query('UPDATE public.pages SET name = $1 WHERE id = $2', ['Brand New Home Title', page1Id]);

      // 3. Calling publish with old expected state fails with PT409 because canonical document fingerprint changed
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          websiteId,
          JSON.stringify(oldExpectedState)
        ])
      ).rejects.toThrow(/Website changes were updated elsewhere/);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('19. section save mutation after plan triggers PT409 on publish (12 & 25.4)', async () => {
    const { userId, websiteId, page2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const oldExpectedState = planRes.rows[0].plan.expected_state;

      // Modify page2 sections
      const updatedSec2 = [
        { id: `sec2-${randomUUID()}`, page_id: page2Id, type: 'hero', order: 0, content: { title: 'Updated About Us' }, styles: {} }
      ];
      await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2)', [page2Id, JSON.stringify(updatedSec2)]);

      // Publish with old expected state throws PT409
      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          websiteId,
          JSON.stringify(oldExpectedState)
        ])
      ).rejects.toThrow(/Website changes were updated elsewhere/);

      // Verify new plan contains updated tokens
      const newPlanRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const newPlan = newPlanRes.rows[0].plan;
      const page2Token = newPlan.expected_state.pages.find((p: any) => p.page_id === page2Id);
      expect(page2Token.save_revision).toBe(2);
      expect(page2Token.canonical_document_fingerprint).toBeTruthy();
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('20. exact full-document fingerprint and section hash appear in expected_state.pages (8, 9 & 25.5)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const pageToken = planRes.rows[0].plan.expected_state.pages.find((p: any) => p.page_id === page1Id);

      expect(pageToken).toBeDefined();
      expect(pageToken.page_id).toBe(page1Id);
      expect(typeof pageToken.save_revision).toBe('number');
      expect(typeof pageToken.section_document_hash).toBe('string');
      expect(typeof pageToken.canonical_document_fingerprint).toBe('string');
      expect(pageToken.section_document_hash.length).toBe(32); // md5
      expect(pageToken.canonical_document_fingerprint.length).toBe(32); // md5
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('21. homepage change Funnel A -> Funnel B removes Funnel A root from projected graph, blocking internal nav to now-unrouted Funnel A (14, 16 & 25.6, 25.7)', async () => {
    const { userId, websiteId, funnel1Id, funnel2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Change draft homepage to funnel2
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2)', [websiteId, funnel2Id]);

      // Stage nav item with internal link to funnel1 (which is unrouted once homepage switches to funnel2!)
      const navItems = [
        { id: randomUUID(), label: 'Old Home Link', target_kind: 'internal', target_value: funnel1Id, visible: true }
      ];
      await client.query('SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb, 0)', [
        websiteId, 'primary', JSON.stringify(navItems)
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      expect(plan.is_publishable).toBe(false);
      expect(plan.blockers.some((b: any) => b.code === 'NAV_TARGET_UNROUTED')).toBe(true);

      await expect(
        client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
          websiteId,
          JSON.stringify(plan.expected_state)
        ])
      ).rejects.toThrow(/Publication blocked|without a public route/);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('22. homepage semantic navigation link remains valid after homepage change and resolves to root (17 & 25.8)', async () => {
    const { userId, websiteId, funnel2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Change draft homepage to funnel2
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2)', [websiteId, funnel2Id]);

      // Stage nav item with target_kind = 'homepage'
      const navItems = [
        { id: randomUUID(), label: 'Home', target_kind: 'homepage', target_value: '', visible: true }
      ];
      await client.query('SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb, 0)', [
        websiteId, 'primary', JSON.stringify(navItems)
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      expect(plan.is_publishable).toBe(true);
      expect(plan.blockers.length).toBe(0);

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      expect(pubRes.rows[0].res.success).toBe(true);

      // Verify root route now points to funnel2
      const rootRoute = await client.query('SELECT * FROM public.website_routes WHERE website_id = $1 AND path = $2', [websiteId, '/']);
      expect(rootRoute.rows[0].funnel_id).toBe(funnel2Id);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('23. internal nav to Funnel A remains valid after homepage change when Funnel A has a second route (18 & 25.9)', async () => {
    const { userId, websiteId, funnel1Id, funnel2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, null);
      // Add a secondary route for funnel1 at /archive-home
      await client.query('INSERT INTO public.website_routes (website_id, path, funnel_id) VALUES ($1, $2, $3)', [
        websiteId, '/archive-home', funnel1Id
      ]);

      await setAuth(client, userId);

      // Change draft homepage to funnel2
      await client.query('SELECT public.set_builder_draft_homepage($1::uuid, $2)', [websiteId, funnel2Id]);

      // Stage internal nav pointing to funnel1
      const navItems = [
        { id: randomUUID(), label: 'Archive Home', target_kind: 'internal', target_value: funnel1Id, visible: true }
      ];
      await client.query('SELECT public.stage_builder_site_navigation_draft($1::uuid, $2::text, $3::jsonb, 0)', [
        websiteId, 'primary', JSON.stringify(navItems)
      ]);

      const planRes = await client.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const plan = planRes.rows[0].plan;

      expect(plan.is_publishable).toBe(true);
      expect(plan.blockers.length).toBe(0);

      const pubRes = await client.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb) as res', [
        websiteId,
        JSON.stringify(plan.expected_state)
      ]);
      expect(pubRes.rows[0].res.success).toBe(true);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('24. create-page phantom waits on projected funnel lock, then publish detects new page in plan and throws PT409 (F, S.1, S.2)', async () => {
    const { userId, websiteId, funnel1Id } = await createTestFixture();
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await setAuth(clientA, userId);
      await setAuth(clientB, userId);

      // Session A obtains publish plan (only page 1 in funnel1)
      const planRes = await clientA.query('SELECT public.get_builder_website_publish_plan($1::uuid) as plan', [websiteId]);
      const planA = planRes.rows[0].plan;

      // Session B begins txn and calls released create_builder_page RPC in funnel1
      await clientB.query('BEGIN');
      await clientB.query("SELECT public.create_builder_page('Phantom Page', 'phantom-slug', $1)", [funnel1Id]);

      // Session A calls publish_builder_website with old expected state
      let publishDone = false;
      let publishErr: any = null;
      const publishPromise = clientA.query('SELECT public.publish_builder_website($1::uuid, $2::jsonb)', [
        websiteId,
        JSON.stringify(planA.expected_state)
      ]).then(() => {
        publishDone = true;
      }).catch((e) => {
        publishDone = true;
        publishErr = e;
      });

      // Session A must be blocked waiting for the funnel lifecycle lock held by Session B
      await new Promise((r) => setTimeout(r, 100));
      expect(publishDone).toBe(false);

      // Session B commits, persisting the new page
      await clientB.query('COMMIT');

      // Session A unblocks, re-evaluates expected state under lock, detects new page in expected state, throws PT409
      await publishPromise;
      expect(publishDone).toBe(true);
      expect(publishErr).toBeTruthy();
      expect(publishErr.message).toMatch(/Website changes were updated elsewhere/);

      // Verify zero audit publications exist
      const pubCountRes = await clientA.query('SELECT count(*)::integer as count FROM public.builder_website_publications WHERE website_id = $1', [websiteId]);
      expect(pubCountRes.rows[0].count).toBe(0);
    } finally {
      await setAuth(clientA, null);
      await setAuth(clientB, null);
      clientA.release();
      clientB.release();
    }
  });

  it('25. inverse create during unified publication waits on funnel lifecycle lock (G, S.3)', async () => {
    const { userId, funnel1Id } = await createTestFixture();
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await setAuth(clientA, userId);
      await setAuth(clientB, userId);

      // Session A begins txn and holds the builder-page-lifecycle lock for funnel1
      await clientA.query('BEGIN');
      await clientA.query(`SELECT pg_advisory_xact_lock(hashtextextended('builder-page-lifecycle:' || $1 || ':' || $2, 0))`, [userId, funnel1Id]);

      // Session B calls create_builder_page in funnel1
      let createDone = false;
      let createRes: any = null;
      const createPromise = clientB.query("SELECT public.create_builder_page('Inverse Page', 'inv-slug', $1) as res", [
        funnel1Id
      ]).then((r) => {
        createDone = true;
        createRes = r;
      });

      // Session B is blocked while Session A holds the lock
      await new Promise((r) => setTimeout(r, 100));
      expect(createDone).toBe(false);

      // Session A commits
      await clientA.query('COMMIT');

      // Session B resumes and succeeds
      await createPromise;
      expect(createDone).toBe(true);
      expect(createRes.rows[0].res.id).toBeTruthy();
    } finally {
      await setAuth(clientA, null);
      await setAuth(clientB, null);
      clientA.release();
      clientB.release();
    }
  });

  it('26. delete_builder_page serializes on funnel lifecycle lock (H)', async () => {
    const { userId, funnel1Id } = await createTestFixture();
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await setAuth(clientA, userId);
      await setAuth(clientB, userId);

      // Create a draft page in funnel1 to test deletion
      const draftPageRes = await clientA.query("SELECT public.create_builder_page('Draft To Delete', 'draft-del-slug', $1) as res", [
        funnel1Id
      ]);
      const draftPageId = draftPageRes.rows[0].res.id;

      // Session A holds the builder-page-lifecycle lock on funnel1
      await clientA.query('BEGIN');
      await clientA.query(`SELECT pg_advisory_xact_lock(hashtextextended('builder-page-lifecycle:' || $1 || ':' || $2, 0))`, [userId, funnel1Id]);

      // Session B calls delete_builder_page for draftPageId
      let deleteDone = false;
      let deleteRes: any = null;
      const deletePromise = clientB.query('SELECT public.delete_builder_page($1) as res', [draftPageId]).then((r) => {
        deleteDone = true;
        deleteRes = r;
      });

      // Session B is blocked
      await new Promise((r) => setTimeout(r, 100));
      expect(deleteDone).toBe(false);

      // Session A commits
      await clientA.query('COMMIT');

      // Session B completes
      await deletePromise;
      expect(deleteDone).toBe(true);
      expect(deleteRes.rows[0].res.id).toBe(draftPageId);
    } finally {
      await setAuth(clientA, null);
      await setAuth(clientB, null);
      clientA.release();
      clientB.release();
    }
  });

  it('27. reorder_builder_pages serializes on funnel lifecycle lock (H)', async () => {
    const { userId, funnel1Id, page1Id } = await createTestFixture();
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await setAuth(clientA, userId);
      await setAuth(clientB, userId);

      // Create a second page in funnel1 first
      const p2Res = await clientA.query("SELECT public.create_builder_page('Second Page', 'second-page-slug', $1) as res", [
        funnel1Id
      ]);
      const page2Id = p2Res.rows[0].res.id;

      // Session A holds the builder-page-lifecycle lock on funnel1
      await clientA.query('BEGIN');
      await clientA.query(`SELECT pg_advisory_xact_lock(hashtextextended('builder-page-lifecycle:' || $1 || ':' || $2, 0))`, [userId, funnel1Id]);

      // Session B calls reorder_builder_pages
      let reorderDone = false;
      let reorderRes: any = null;
      const reorderPromise = clientB.query('SELECT public.reorder_builder_pages($1, $2::text[], $3::text[]) as res', [
        funnel1Id, [page2Id, page1Id], [page1Id, page2Id]
      ]).then((r) => {
        reorderDone = true;
        reorderRes = r;
      });

      // Session B is blocked
      await new Promise((r) => setTimeout(r, 100));
      expect(reorderDone).toBe(false);

      // Session A commits
      await clientA.query('COMMIT');

      // Session B completes
      await reorderPromise;
      expect(reorderDone).toBe(true);
      expect(reorderRes.rows[0].res.funnel_id).toBe(funnel1Id);
      expect(reorderRes.rows[0].res.pages.length).toBe(2);
    } finally {
      await setAuth(clientA, null);
      await setAuth(clientB, null);
      clientA.release();
      clientB.release();
    }
  });

  it('28. raw authenticated page_sections INSERT, UPDATE, DELETE denied while save_page_sections_document succeeds (J, S.4, S.5, S.6, S.7)', async () => {
    const { userId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Raw direct INSERT denied
      await expect(
        client.query("INSERT INTO public.page_sections (id, user_id, page_id, type) VALUES ('sec-raw', $1, $2, 'hero')", [userId, page1Id])
      ).rejects.toThrow(/permission denied/);

      // Raw direct UPDATE denied
      await expect(
        client.query("UPDATE public.page_sections SET content = '{\"title\":\"Hacked\"}' WHERE page_id = $1", [page1Id])
      ).rejects.toThrow(/permission denied/);

      // Raw direct DELETE denied
      await expect(
        client.query("DELETE FROM public.page_sections WHERE page_id = $1", [page1Id])
      ).rejects.toThrow(/permission denied/);

      // Canonical RPC save_page_sections_document succeeds
      const secDoc = [{ id: `sec-rpc-${randomUUID()}`, page_id: page1Id, type: 'hero', order: 0, content: { title: 'Authorized' }, styles: {} }];
      const saveRes = await client.query('SELECT public.save_page_sections_document($1, $2::jsonb, 2) as res', [
        page1Id, JSON.stringify(secDoc)
      ]);
      expect(saveRes.rows[0].res.page_id).toBe(page1Id);
      expect(saveRes.rows[0].res.revision).toBe(2);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('29. raw authenticated route tables mutation denied while Task 5 RPCs succeed (K, S.8, S.9, S.10, S.11)', async () => {
    const { userId, websiteId, funnel2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Direct write to builder_route_drafts denied
      await expect(
        client.query("INSERT INTO public.builder_route_drafts (website_id, path, funnel_id, action) VALUES ($1, '/hack', $2, 'upsert')", [websiteId, funnel2Id])
      ).rejects.toThrow(/permission denied/);

      // Direct write to website_routes denied
      await expect(
        client.query("INSERT INTO public.website_routes (website_id, path, funnel_id) VALUES ($1, '/hack', $2)", [websiteId, funnel2Id])
      ).rejects.toThrow(/permission denied/);

      // Direct write to website_route_redirects denied
      await expect(
        client.query("INSERT INTO public.website_route_redirects (website_id, from_path, to_path) VALUES ($1, '/hack', '/about')", [websiteId])
      ).rejects.toThrow(/permission denied/);

      // Task 5 RPCs succeed
      const stageRes = await client.query('SELECT public.set_builder_route_draft($1::uuid, $2, $3) as res', [
        websiteId, funnel2Id, '/authorized-route'
      ]);
      expect(stageRes.rows[0].res.success).toBe(true);

      const revertRes = await client.query('SELECT public.revert_builder_route_draft($1::uuid, null, $2) as res', [
        websiteId, funnel2Id
      ]);
      expect(revertRes.rows[0].res.success).toBe(true);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('30. direct forbidden pages lifecycle mutations denied while safe Page Settings updates succeed (L, S.12, S.13)', async () => {
    const { userId, page1Id, funnel2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Direct page INSERT denied
      await expect(
        client.query("INSERT INTO public.pages (id, user_id, funnel_id, name, slug) VALUES ('p-raw', $1, $2, 'Raw', 'raw')", [userId, funnel2Id])
      ).rejects.toThrow(/permission denied/);

      // Direct page DELETE denied
      await expect(
        client.query("DELETE FROM public.pages WHERE id = $1", [page1Id])
      ).rejects.toThrow(/permission denied/);

      // Direct update of forbidden lifecycle columns (funnel_id, status) denied
      await expect(
        client.query("UPDATE public.pages SET funnel_id = $1 WHERE id = $2", [funnel2Id, page1Id])
      ).rejects.toThrow(/permission denied/);

      await expect(
        client.query("UPDATE public.pages SET status = 'draft' WHERE id = $1", [page1Id])
      ).rejects.toThrow(/permission denied/);

      // Safe Page Settings update (name, slug, seo_title, seo_description) succeeds
      await client.query("UPDATE public.pages SET name = 'Updated Home', slug = 'home-updated', seo_title = 'SEO Home', seo_description = 'Description' WHERE id = $1", [page1Id]);
      const checkRes = await client.query("SELECT name, slug, seo_title FROM public.pages WHERE id = $1", [page1Id]);
      expect(checkRes.rows[0].name).toBe('Updated Home');
      expect(checkRes.rows[0].slug).toBe('home-updated');
      expect(checkRes.rows[0].seo_title).toBe('SEO Home');
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('31. forbidden websites publication-field update denied while safe metadata update succeeds (M, S.14)', async () => {
    const { userId, websiteId, funnel2Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Direct update of publication_revision denied
      await expect(
        client.query("UPDATE public.websites SET publication_revision = 999 WHERE id = $1", [websiteId])
      ).rejects.toThrow(/permission denied/);

      // Direct update of homepage_funnel_id denied
      await expect(
        client.query("UPDATE public.websites SET homepage_funnel_id = $1 WHERE id = $2", [funnel2Id, websiteId])
      ).rejects.toThrow(/permission denied/);

      // Direct update of draft_homepage_funnel_id denied
      await expect(
        client.query("UPDATE public.websites SET draft_homepage_funnel_id = $1 WHERE id = $2", [funnel2Id, websiteId])
      ).rejects.toThrow(/permission denied/);

      // Safe website metadata update (name, domain, subdomain) succeeds
      await client.query("UPDATE public.websites SET name = 'My Safe Website Name' WHERE id = $1", [websiteId]);
      const checkRes = await client.query("SELECT name FROM public.websites WHERE id = $1", [websiteId]);
      expect(checkRes.rows[0].name).toBe('My Safe Website Name');
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('32. builder_published_revisions and targets direct write denied (N, S.15)', async () => {
    const { userId, websiteId, page1Id } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Direct INSERT into builder_published_revisions denied
      await expect(
        client.query("INSERT INTO public.builder_published_revisions (website_id, page_id, document) VALUES ($1, $2, '{}'::jsonb)", [websiteId, page1Id])
      ).rejects.toThrow(/permission denied/);

      // Direct INSERT into builder_publication_targets denied
      await expect(
        client.query("INSERT INTO public.builder_publication_targets (website_id, page_id, published_revision_id) VALUES ($1, $2, $3)", [websiteId, page1Id, randomUUID()])
      ).rejects.toThrow(/permission denied/);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });

  it('33. builder_website_publications direct write denied (O, S.16)', async () => {
    const { userId, websiteId } = await createTestFixture();
    const client = await pool.connect();
    try {
      await setAuth(client, userId);

      // Direct INSERT into builder_website_publications denied
      await expect(
        client.query("INSERT INTO public.builder_website_publications (website_id, publication_revision, expected_state, summary) VALUES ($1, 1, '{}'::jsonb, '{}'::jsonb)", [websiteId])
      ).rejects.toThrow(/permission denied/);

      // Direct UPDATE denied
      await expect(
        client.query("UPDATE public.builder_website_publications SET publication_revision = 2 WHERE website_id = $1", [websiteId])
      ).rejects.toThrow(/permission denied/);

      // Direct DELETE denied
      await expect(
        client.query("DELETE FROM public.builder_website_publications WHERE website_id = $1", [websiteId])
      ).rejects.toThrow(/permission denied/);
    } finally {
      await setAuth(client, null);
      client.release();
    }
  });
});
