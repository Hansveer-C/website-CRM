import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const DATABASE_URL =
  process.env.BUILDER_ROUTE_TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL;

const MIGRATION_PATH_6A = resolve(
  __dirname,
  '../migrations/20260817050700_create_builder_site_navigation.sql'
);

const MIGRATION_PATH_6B = resolve(
  __dirname,
  '../migrations/20260817050800_create_builder_navigation_publication_and_runtime.sql'
);

describe.skipIf(!DATABASE_URL)('Builder Navigation Publication Integration Tests (PostgreSQL 17)', () => {
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
          email text unique,
          password_hash text
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
          seo_title text,
          seo_description text,
          seo_keywords text[],
          step_type text,
          step_order integer not null default 0,
          created_at timestamptz not null default now()
        );

        alter table public.pages add column if not exists seo_title text;
        alter table public.pages add column if not exists seo_description text;
        alter table public.pages add column if not exists seo_keywords text[];
        alter table public.pages add column if not exists step_type text;
        alter table public.pages add column if not exists step_order integer not null default 0;

        create table if not exists public.websites (
          id uuid primary key default gen_random_uuid(),
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          domain text unique,
          subdomain text unique,
          homepage_funnel_id text references public.funnels(id) on delete set null,
          draft_homepage_funnel_id text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        alter table public.websites add column if not exists subdomain text;
        alter table public.websites add column if not exists homepage_funnel_id text;
        alter table public.websites add column if not exists draft_homepage_funnel_id text;

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
          primary key (website_id, page_id),
          foreign key (website_id, page_id, published_revision_id)
            references public.builder_published_revisions (website_id, page_id, id)
            on delete no action deferrable initially immediate
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

      // Apply Task 6A migration
      const sql6A = readFileSync(MIGRATION_PATH_6A, 'utf8');
      await client.query(sql6A);

      // Apply Task 6B migration
      const sql6B = readFileSync(MIGRATION_PATH_6B, 'utf8');
      await client.query(sql6B);

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

  async function setAuthUser(client: any, userId: string | null) {
    if (userId === null) {
      await client.query(`set "request.jwt.claim.sub" = ''`);
    } else {
      await client.query(`set "request.jwt.claim.sub" = '${userId}'`);
    }
  }

  async function createFixture(client: any) {
    const userId = randomUUID();
    const otherUserId = randomUUID();
    const siteId = randomUUID();
    const otherSiteId = randomUUID();
    const fnlHome = `fnl-home-${randomUUID()}`;
    const fnlServices = `fnl-srv-${randomUUID()}`;
    const fnlAbout = `fnl-abt-${randomUUID()}`;
    const fnlOther = `fnl-oth-${randomUUID()}`;

    await client.query('insert into public.users (id, email) values ($1, $2), ($3, $4)', [
      userId, `${userId}@example.com`,
      otherUserId, `${otherUserId}@example.com`
    ]);

    await client.query(
      'insert into public.funnels (id, user_id, name) values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)',
      [
        fnlHome, userId, 'Home Funnel',
        fnlServices, userId, 'Services Funnel',
        fnlAbout, userId, 'About Funnel',
        fnlOther, otherUserId, 'Other Funnel'
      ]
    );

    // Create published pages so route publication validations pass
    await client.query(
      'insert into public.pages (id, user_id, funnel_id, name, slug, status, step_order) values ($1, $2, $3, $4, $5, $6, 0), ($7, $8, $9, $10, $11, $12, 1)',
      [
        randomUUID(), userId, fnlServices, 'Services Page', 'services', 'published',
        randomUUID(), userId, fnlAbout, 'About Page', 'about', 'published'
      ]
    );

    await client.query(
      'insert into public.websites (id, user_id, name, subdomain, homepage_funnel_id) values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
      [
        siteId, userId, 'Test Site', `sub-${siteId.slice(0, 8)}`, fnlHome,
        otherSiteId, otherUserId, 'Other Site', `sub-${otherSiteId.slice(0, 8)}`, fnlOther
      ]
    );

    await client.query(
      'insert into public.website_routes (website_id, path, funnel_id) values ($1, $2, $3)',
      [siteId, '/services', fnlServices]
    );

    return { userId, otherUserId, siteId, otherSiteId, fnlHome, fnlServices, fnlAbout, fnlOther };
  }

  it('rejects unauthenticated publication with PT401', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, null);

      await expect(
        client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [f.siteId, 'primary', 0, 1])
      ).rejects.toMatchObject({ code: 'PT401' });
    } finally {
      client.release();
    }
  });

  it('rejects foreign website publication with PT404', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      await expect(
        client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [f.otherSiteId, 'primary', 0, 1])
      ).rejects.toMatchObject({ code: 'PT404' });
    } finally {
      client.release();
    }
  });

  it('rejects publication when no draft exists with PT404', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      await expect(
        client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [f.siteId, 'primary', 0, 1])
      ).rejects.toMatchObject({ code: 'PT404' });
    } finally {
      client.release();
    }
  });

  it('rejects publication with stale base revision with PT409', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ];

      // Stage draft rev 1
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);

      // Publish with mismatched base revision (expected 5 vs current 0)
      await expect(
        client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [f.siteId, 'primary', 5, 1])
      ).rejects.toMatchObject({ code: 'PT409' });
    } finally {
      client.release();
    }
  });

  it('rejects publication with stale draft revision with PT409', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ];

      // Stage draft rev 1
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);
      // Stage draft rev 2
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
        f.siteId, 'primary', JSON.stringify(items), 0, 1
      ]);

      // Publish with stale draft revision 1 vs current 2
      await expect(
        client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [f.siteId, 'primary', 0, 1])
      ).rejects.toMatchObject({ code: 'PT409' });
    } finally {
      client.release();
    }
  });

  it('publishes valid navigation, creates live revision 1 and clears draft atomically', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const u2 = randomUUID();
      const items = [
        { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
        { id: u2, label: 'Services', target_kind: 'internal', target_value: f.fnlServices, position: 1, visible: true, is_cta: false }
      ];

      // Stage draft rev 1
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);

      const pubRes = await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4) as data', [
        f.siteId, 'primary', 0, 1
      ]);
      const data = pubRes.rows[0].data;

      expect(data.success).toBe(true);
      expect(data.live_revision).toBe(1);
      expect(data.is_draft).toBe(false);

      // Check draft row is gone
      const draftCount = (await client.query(
        'select count(*) as count from public.builder_site_navigation_drafts where website_id = $1',
        [f.siteId]
      )).rows[0].count;
      expect(draftCount).toBe('0');

      // Check live row exists
      const liveRow = (await client.query(
        'select * from public.builder_site_navigation_live where website_id = $1',
        [f.siteId]
      )).rows[0];
      expect(liveRow.revision).toBe(1);
      expect(liveRow.items.length).toBe(2);
    } finally {
      client.release();
    }
  });

  it('rejects standalone publication when visible internal target is on a draft-only route', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      // Stage a route draft for /about (destination fnlAbout)
      await client.query(
        'insert into public.builder_route_drafts (website_id, path, funnel_id, action) values ($1, $2, $3, $4)',
        [f.siteId, '/about', f.fnlAbout, 'upsert']
      );

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'About Us', target_kind: 'internal', target_value: f.fnlAbout, position: 0, visible: true, is_cta: false }
      ];

      // Staging navigation draft succeeds (draft routes allowed in preview)
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);

      // Publishing navigation fails with PT422 because /about route is not yet published in live routes!
      await expect(
        client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [f.siteId, 'primary', 0, 1])
      ).rejects.toMatchObject({ code: 'PT422' });
    } finally {
      client.release();
    }
  });

  it('allows publication of hidden internal items targeting draft-only routes', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      // Stage a route draft for /about (destination fnlAbout)
      await client.query(
        'insert into public.builder_route_drafts (website_id, path, funnel_id, action) values ($1, $2, $3, $4)',
        [f.siteId, '/about', f.fnlAbout, 'upsert']
      );

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'About Us (Hidden)', target_kind: 'internal', target_value: f.fnlAbout, position: 0, visible: false, is_cta: false }
      ];

      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);

      const pubRes = await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4) as data', [
        f.siteId, 'primary', 0, 1
      ]);
      expect(pubRes.rows[0].data.success).toBe(true);
    } finally {
      client.release();
    }
  });

  it('allows explicit empty navigation adoption when no canonical live row exists', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      // Stage empty array [] when no live canonical row exists
      const stageRes = await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3) as data', [
        f.siteId, 'primary', JSON.stringify([])
      ]);
      expect(stageRes.rows[0].data.is_draft).toBe(true);
      expect(stageRes.rows[0].data.draft_revision).toBe(1);

      // Publish empty draft
      const pubRes = await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4) as data', [
        f.siteId, 'primary', 0, 1
      ]);
      expect(pubRes.rows[0].data.success).toBe(true);
      expect(pubRes.rows[0].data.live_revision).toBe(1);
      expect(pubRes.rows[0].data.items).toEqual([]);

      // Verify live row exists with empty items
      const liveRow = (await client.query(
        'select * from public.builder_site_navigation_live where website_id = $1',
        [f.siteId]
      )).rows[0];
      expect(liveRow.items).toEqual([]);
      expect(liveRow.revision).toBe(1);
    } finally {
      client.release();
    }
  });

  it('blocks route deletion in publish_builder_routes when visible live navigation depends on destination', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'Services Link', target_kind: 'internal', target_value: f.fnlServices, position: 0, visible: true, is_cta: false }
      ];

      // Publish navigation targeting /services (fnlServices)
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);
      await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
        f.siteId, 'primary', 0, 1
      ]);

      // Now stage a route delete draft for /services
      const routeId = (await client.query('select id from public.website_routes where website_id = $1 and path = $2', [f.siteId, '/services'])).rows[0].id;
      await client.query(
        'insert into public.builder_route_drafts (website_id, route_id, path, funnel_id, action) values ($1, $2, $3, $4, $5)',
        [f.siteId, routeId, '/services', f.fnlServices, 'delete']
      );

      // Attempting to publish route deletion must fail with PT422!
      await expect(
        client.query('select public.publish_builder_routes($1)', [f.siteId])
      ).rejects.toMatchObject({ code: 'PT422' });

      // Verify route was not deleted
      const routeCount = (await client.query('select count(*) as count from public.website_routes where id = $1', [routeId])).rows[0].count;
      expect(routeCount).toBe('1');
    } finally {
      client.release();
    }
  });

  it('allows route deletion after navigation dependency is updated and published', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'Services Link', target_kind: 'internal', target_value: f.fnlServices, position: 0, visible: true, is_cta: false }
      ];

      // Publish nav depending on services
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);
      await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
        f.siteId, 'primary', 0, 1
      ]);

      // Stage route deletion draft
      const routeId = (await client.query('select id from public.website_routes where website_id = $1 and path = $2', [f.siteId, '/services'])).rows[0].id;
      await client.query(
        'insert into public.builder_route_drafts (website_id, route_id, path, funnel_id, action) values ($1, $2, $3, $4, $5)',
        [f.siteId, routeId, '/services', f.fnlServices, 'delete']
      );

      // User updates navigation to remove or hide the services link
      const updatedItems = [
        { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ];
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
        f.siteId, 'primary', JSON.stringify(updatedItems), 1, null
      ]);
      await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
        f.siteId, 'primary', 1, 1
      ]);

      // Now route publication succeeds!
      const routePubRes = await client.query('select public.publish_builder_routes($1) as data', [f.siteId]);
      expect(routePubRes.rows[0].data.success).toBe(true);

      const routeCount = (await client.query('select count(*) as count from public.website_routes where id = $1', [routeId])).rows[0].count;
      expect(routeCount).toBe('0');
    } finally {
      client.release();
    }
  });

  it('restores exact Task 6A draft revision concurrency locking', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ];

      // Tab A and B read baseline (no draft, live rev 0)
      // Tab B stages -> creates draft rev 1
      const stage1 = await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data', [
        f.siteId, 'primary', JSON.stringify(items), 0, null
      ]);
      expect(stage1.rows[0].data.draft_revision).toBe(1);

      // Tab B stages again -> creates draft rev 2
      const stage2 = await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data', [
        f.siteId, 'primary', JSON.stringify(items), 0, 1
      ]);
      expect(stage2.rows[0].data.draft_revision).toBe(2);

      // Tab A tries to stage with stale expected draft revision 1 -> PT409
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          f.siteId, 'primary', JSON.stringify(items), 0, 1
        ])
      ).rejects.toMatchObject({ code: 'PT409' });

      // Tab A tries to stage without draft revision token when draft exists -> PT409
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          f.siteId, 'primary', JSON.stringify(items), 0, null
        ])
      ).rejects.toMatchObject({ code: 'PT409' });

      // Tab B stages with correct expected draft revision 2 -> succeeds, rev 3
      const stage3 = await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data', [
        f.siteId, 'primary', JSON.stringify(items), 0, 2
      ]);
      expect(stage3.rows[0].data.draft_revision).toBe(3);
    } finally {
      client.release();
    }
  });

  it('rejects non-contiguous positions, gaps, duplicates, and fractional positions with PT400', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const u2 = randomUUID();

      // Gap: positions 0 and 2 for 2 items
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify([
            { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
            { id: u2, label: 'Services', target_kind: 'internal', target_value: f.fnlServices, position: 2, visible: true, is_cta: false }
          ])
        ])
      ).rejects.toMatchObject({ code: 'PT400' });

      // Duplicate: positions 0 and 0
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify([
            { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
            { id: u2, label: 'Services', target_kind: 'internal', target_value: f.fnlServices, position: 0, visible: true, is_cta: false }
          ])
        ])
      ).rejects.toMatchObject({ code: 'PT400' });

      // Fractional: position 0.5
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify([
            { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0.5, visible: true, is_cta: false }
          ])
        ])
      ).rejects.toMatchObject({ code: 'PT400' });
    } finally {
      client.release();
    }
  });

  it('allows route deletion if destination still has another live route in post-publication route set', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      // Create a second live route pointing to fnlServices
      const r2Id = randomUUID();
      await client.query(
        'insert into public.website_routes (id, website_id, path, funnel_id) values ($1, $2, $3, $4)',
        [r2Id, f.siteId, '/pressure-washing', f.fnlServices]
      );

      const u1 = randomUUID();
      const items = [
        { id: u1, label: 'Services Link', target_kind: 'internal', target_value: f.fnlServices, position: 0, visible: true, is_cta: false }
      ];

      // Publish navigation targeting fnlServices
      await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
        f.siteId, 'primary', JSON.stringify(items)
      ]);
      await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
        f.siteId, 'primary', 0, 1
      ]);

      // Stage delete draft for /services only (leaving /pressure-washing intact)
      const r1Id = (await client.query('select id from public.website_routes where website_id = $1 and path = $2', [f.siteId, '/services'])).rows[0].id;
      await client.query(
        'insert into public.builder_route_drafts (website_id, route_id, path, funnel_id, action) values ($1, $2, $3, $4, $5)',
        [f.siteId, r1Id, '/services', f.fnlServices, 'delete']
      );

      // Publishing route delete succeeds because /pressure-washing still resolves fnlServices!
      const pubRes = await client.query('select public.publish_builder_routes($1) as data', [f.siteId]);
      expect(pubRes.rows[0].data.success).toBe(true);
    } finally {
      client.release();
    }
  });

  it('supports independent footer menu scope publication and revisions', async () => {
    const client = await pool.connect();
    try {
      const f = await createFixture(client);
      await setAuthUser(client, f.userId);

      const u1 = randomUUID();
      const footerItems = [
        { id: u1, label: 'Privacy', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
      ];

      // Stage footer draft
      const stageRes = await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3) as data', [
        f.siteId, 'footer', JSON.stringify(footerItems)
      ]);
      expect(stageRes.rows[0].data.is_draft).toBe(true);

      // Publish footer draft
      const pubRes = await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4) as data', [
        f.siteId, 'footer', 0, 1
      ]);
      expect(pubRes.rows[0].data.success).toBe(true);
      expect(pubRes.rows[0].data.menu_scope).toBe('footer');
      expect(pubRes.rows[0].data.live_revision).toBe(1);

      // Verify primary scope is unaffected
      const primaryLive = (await client.query(
        'select * from public.builder_site_navigation_live where website_id = $1 and menu_scope = $2',
        [f.siteId, 'primary']
      )).rows;
      expect(primaryLive.length).toBe(0);
    } finally {
      client.release();
    }
  });

  describe('mandatory publication tokens and concurrency authority (Section 1 & 14)', () => {
    it('enforces mandatory publication tokens and rejects missing or stale tokens with PT409', async () => {
      const client = await pool.connect();
      try {
        const f = await createFixture(client);
        await setAuthUser(client, f.userId);

        const u1 = randomUUID();
        const items = [
          { id: u1, label: 'Home', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false }
        ];

        // Stage draft (rev 1, base 0)
        await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify(items)
        ]);

        // 1. Missing base token -> PT409
        await expect(
          client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
            f.siteId, 'primary', null, 1
          ])
        ).rejects.toMatchObject({ code: 'PT409' });

        // 2. Missing draft token -> PT409
        await expect(
          client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
            f.siteId, 'primary', 0, null
          ])
        ).rejects.toMatchObject({ code: 'PT409' });

        // 3. Stale base token -> PT409
        await expect(
          client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
            f.siteId, 'primary', 99, 1
          ])
        ).rejects.toMatchObject({ code: 'PT409' });

        // 4. Stale draft token -> PT409
        await expect(
          client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
            f.siteId, 'primary', 0, 99
          ])
        ).rejects.toMatchObject({ code: 'PT409' });

        // 5. Failed publication leaves live (none) and draft (rev 1) untouched
        const draftCheck = (await client.query(
          'select draft_revision from public.builder_site_navigation_drafts where website_id = $1 and menu_scope = $2',
          [f.siteId, 'primary']
        )).rows[0];
        expect(draftCheck.draft_revision).toBe(1);

        const liveCheck = (await client.query(
          'select revision from public.builder_site_navigation_live where website_id = $1 and menu_scope = $2',
          [f.siteId, 'primary']
        )).rows;
        expect(liveCheck.length).toBe(0);

        // 6. Valid exact tokens publish successfully
        const pubRes = await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4) as data', [
          f.siteId, 'primary', 0, 1
        ]);
        expect(pubRes.rows[0].data.success).toBe(true);
        expect(pubRes.rows[0].data.live_revision).toBe(1);
      } finally {
        client.release();
      }
    });
  });

  describe('server-side canonicalization and auto-clean (Section 3, 4, 5, 6, 15)', () => {
    it('canonicalizes trimmed labels, homepage sentinel, and lowercase email server-side', async () => {
      const client = await pool.connect();
      try {
        const f = await createFixture(client);
        await setAuthUser(client, f.userId);

        const u1 = randomUUID();
        const u2 = randomUUID();
        const u3 = randomUUID();

        const rawItems = [
          { id: u1, label: '   Home Page   ', target_kind: 'homepage', target_value: '', position: 0, visible: true, is_cta: false },
          { id: u2, label: '  Email Us  ', target_kind: 'email', target_value: '  Contact@Example.COM  ', position: 1, visible: true, is_cta: false },
          { id: u3, label: '  Call Us  ', target_kind: 'phone', target_value: '  +1-604-555-0199  ', position: 2, visible: true, is_cta: true }
        ];

        await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify(rawItems)
        ]);

        const storedDraft = (await client.query(
          'select items from public.builder_site_navigation_drafts where website_id = $1 and menu_scope = $2',
          [f.siteId, 'primary']
        )).rows[0].items;

        expect(storedDraft).toEqual([
          { id: u1, label: 'Home Page', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
          { id: u2, label: 'Email Us', target_kind: 'email', target_value: 'contact@example.com', position: 1, visible: true, is_cta: false },
          { id: u3, label: 'Call Us', target_kind: 'phone', target_value: '+1-604-555-0199', position: 2, visible: true, is_cta: true }
        ]);

        // Publish live
        await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
          f.siteId, 'primary', 0, 1
        ]);

        // Staging equivalent items with formatting variants should auto-clean (redundant draft cleared)
        const variantItems = [
          { id: u1, label: 'Home Page', target_kind: 'homepage', target_value: '__homepage__', position: 0, visible: true, is_cta: false },
          { id: u2, label: 'Email Us', target_kind: 'email', target_value: 'CONTACT@EXAMPLE.COM', position: 1, visible: true, is_cta: false },
          { id: u3, label: 'Call Us', target_kind: 'phone', target_value: '+1-604-555-0199', position: 2, visible: true, is_cta: true }
        ];

        const cleanRes = await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data', [
          f.siteId, 'primary', JSON.stringify(variantItems), 1, null
        ]);
        expect(cleanRes.rows[0].data.is_draft).toBe(false);

        const draftsRemaining = (await client.query(
          'select * from public.builder_site_navigation_drafts where website_id = $1 and menu_scope = $2',
          [f.siteId, 'primary']
        )).rows;
        expect(draftsRemaining.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('canonicalizes external URLs matching WHATWG URL standard and performs auto-clean across variants', async () => {
      const client = await pool.connect();
      try {
        const f = await createFixture(client);
        await setAuthUser(client, f.userId);

        const u1 = randomUUID();
        const u2 = randomUUID();
        const u3 = randomUUID();
        const u4 = randomUUID();

        const rawItems = [
          { id: u1, label: 'Root Host', target_kind: 'external', target_value: 'HTTPS://EXAMPLE.COM', position: 0, visible: true, is_cta: false },
          { id: u2, label: 'Default Https Port', target_kind: 'external', target_value: 'https://example.com:443', position: 1, visible: true, is_cta: false },
          { id: u3, label: 'Default Http Port', target_kind: 'external', target_value: 'http://example.com:80/docs', position: 2, visible: true, is_cta: false },
          { id: u4, label: 'Query & Hash', target_kind: 'external', target_value: 'HTTPS://Example.COM:8080/pricing?plan=pro#faq', position: 3, visible: true, is_cta: true }
        ];

        await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify(rawItems)
        ]);

        const storedDraft = (await client.query(
          'select items from public.builder_site_navigation_drafts where website_id = $1 and menu_scope = $2',
          [f.siteId, 'primary']
        )).rows[0].items;

        expect(storedDraft).toEqual([
          { id: u1, label: 'Root Host', target_kind: 'external', target_value: 'https://example.com/', position: 0, visible: true, is_cta: false },
          { id: u2, label: 'Default Https Port', target_kind: 'external', target_value: 'https://example.com/', position: 1, visible: true, is_cta: false },
          { id: u3, label: 'Default Http Port', target_kind: 'external', target_value: 'http://example.com/docs', position: 2, visible: true, is_cta: false },
          { id: u4, label: 'Query & Hash', target_kind: 'external', target_value: 'https://example.com:8080/pricing?plan=pro#faq', position: 3, visible: true, is_cta: true }
        ]);

        // Publish live
        await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
          f.siteId, 'primary', 0, 1
        ]);

        // Staging equivalent external URL variants should auto-clean (redundant draft cleared)
        const variantItems = [
          { id: u1, label: 'Root Host', target_kind: 'external', target_value: 'https://example.com/', position: 0, visible: true, is_cta: false },
          { id: u2, label: 'Default Https Port', target_kind: 'external', target_value: 'HTTPS://Example.COM:443/', position: 1, visible: true, is_cta: false },
          { id: u3, label: 'Default Http Port', target_kind: 'external', target_value: 'HTTP://EXAMPLE.COM:80/docs', position: 2, visible: true, is_cta: false },
          { id: u4, label: 'Query & Hash', target_kind: 'external', target_value: 'https://example.com:8080/pricing?plan=pro#faq', position: 3, visible: true, is_cta: true }
        ];

        const cleanRes = await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data', [
          f.siteId, 'primary', JSON.stringify(variantItems), 1, null
        ]);
        expect(cleanRes.rows[0].data.is_draft).toBe(false);

        const draftsRemaining = (await client.query(
          'select * from public.builder_site_navigation_drafts where website_id = $1 and menu_scope = $2',
          [f.siteId, 'primary']
        )).rows;
        expect(draftsRemaining.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('rejects unsafe external URL schemes, whitespace, and control characters with PT400', async () => {
      const client = await pool.connect();
      try {
        const f = await createFixture(client);
        await setAuthUser(client, f.userId);

        const u1 = randomUUID();

        // 1. JavaScript scheme
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'javascript:alert(1)', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });

        // 2. Data scheme
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'data:text/html,<script>alert(1)</script>', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });

        // 3. Whitespace within URL
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'https://example .com', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });

        // 4. CRLF within URL
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'https://example.com\r\ninvalid', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });

        // 5. Credentials
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'https://user:pass@example.com', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });

        // 6. IPv6 hostnames
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'https://[2001:db8::1]/', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });

        // 7. IDN / punycode hostnames
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'https://xn--mnich-kva.example/', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });

        // 8. Dot-segments in direct SQL
        await expect(
          client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
            f.siteId, 'primary', JSON.stringify([
              { id: u1, label: 'Bad Link', target_kind: 'external', target_value: 'https://example.com/a/../b', position: 0, visible: true, is_cta: false }
            ])
          ])
        ).rejects.toMatchObject({ code: 'PT400' });
      } finally {
        client.release();
      }
    });
  });

  describe('route dependency safety covering destination reassignment (Section 8 & 16)', () => {
    it('rejects publication when only route for destination is reassigned to another funnel', async () => {
      const client = await pool.connect();
      try {
        const f = await createFixture(client);
        await setAuthUser(client, f.userId);

        const u1 = randomUUID();
        const items = [
          { id: u1, label: 'Services', target_kind: 'internal', target_value: f.fnlServices, position: 0, visible: true, is_cta: false }
        ];

        // Publish navigation targeting fnlServices
        await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify(items)
        ]);
        await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
          f.siteId, 'primary', 0, 1
        ]);

        // Existing route /services points to fnlServices
        const r1Id = (await client.query('select id from public.website_routes where website_id = $1 and path = $2', [f.siteId, '/services'])).rows[0].id;

        // Stage draft that reassigns /services to fnlAbout (f.fnlAbout)
        await client.query(
          'insert into public.builder_route_drafts (website_id, route_id, path, funnel_id, action) values ($1, $2, $3, $4, $5)',
          [f.siteId, r1Id, '/services', f.fnlAbout, 'upsert']
        );

        // Publication must be rejected with PT422 because fnlServices is stranded by the reassignment
        await expect(
          client.query('select public.publish_builder_routes($1)', [f.siteId])
        ).rejects.toMatchObject({ code: 'PT422' });
      } finally {
        client.release();
      }
    });

    it('allows reassignment when another route for destination remains', async () => {
      const client = await pool.connect();
      try {
        const f = await createFixture(client);
        await setAuthUser(client, f.userId);

        // Add a second route for fnlServices
        const r2Id = randomUUID();
        await client.query(
          'insert into public.website_routes (id, website_id, path, funnel_id) values ($1, $2, $3, $4)',
          [r2Id, f.siteId, '/clean', f.fnlServices]
        );

        const u1 = randomUUID();
        const items = [
          { id: u1, label: 'Services', target_kind: 'internal', target_value: f.fnlServices, position: 0, visible: true, is_cta: false }
        ];

        await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify(items)
        ]);
        await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
          f.siteId, 'primary', 0, 1
        ]);

        const r1Id = (await client.query('select id from public.website_routes where website_id = $1 and path = $2', [f.siteId, '/services'])).rows[0].id;

        // Reassign /services to fnlAbout
        await client.query(
          'insert into public.builder_route_drafts (website_id, route_id, path, funnel_id, action) values ($1, $2, $3, $4, $5)',
          [f.siteId, r1Id, '/services', f.fnlAbout, 'upsert']
        );

        // Succeeds because /clean still resolves fnlServices!
        const res = await client.query('select public.publish_builder_routes($1) as data', [f.siteId]);
        expect(res.rows[0].data.success).toBe(true);
      } finally {
        client.release();
      }
    });

    it('allows atomic route rename/replacement of destination in the same batch', async () => {
      const client = await pool.connect();
      try {
        const f = await createFixture(client);
        await setAuthUser(client, f.userId);

        const u1 = randomUUID();
        const items = [
          { id: u1, label: 'Services', target_kind: 'internal', target_value: f.fnlServices, position: 0, visible: true, is_cta: false }
        ];

        await client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [
          f.siteId, 'primary', JSON.stringify(items)
        ]);
        await client.query('select public.publish_builder_site_navigation($1, $2, $3, $4)', [
          f.siteId, 'primary', 0, 1
        ]);

        const r1Id = (await client.query('select id from public.website_routes where website_id = $1 and path = $2', [f.siteId, '/services'])).rows[0].id;

        // Draft: Rename /services (r1Id) to /pressure-washing for fnlServices
        await client.query(
          'insert into public.builder_route_drafts (website_id, route_id, path, funnel_id, action) values ($1, $2, $3, $4, $5)',
          [f.siteId, r1Id, '/pressure-washing', f.fnlServices, 'upsert']
        );

        // Succeeded because the route update preserves a live route for fnlServices
        const res = await client.query('select public.publish_builder_routes($1) as data', [f.siteId]);
        expect(res.rows[0].data.success).toBe(true);

        const newRoute = (await client.query('select path from public.website_routes where website_id = $1 and funnel_id = $2', [f.siteId, f.fnlServices])).rows[0];
        expect(newRoute.path).toBe('/pressure-washing');
      } finally {
        client.release();
      }
    });
  });
});
