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
          id uuid primary key default gen_random_uuid(),
          user_id text not null references public.users(id) on delete cascade,
          funnel_id text references public.funnels(id) on delete set null,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          created_at timestamptz not null default now()
        );

        create table if not exists public.builder_publication_targets (
          id uuid primary key default gen_random_uuid(),
          website_id uuid not null,
          page_id uuid not null,
          published_revision_id uuid not null,
          published_at timestamptz not null default now()
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

        alter table public.websites add column if not exists subdomain text;
        alter table public.websites add column if not exists homepage_funnel_id text;
        alter table public.websites add column if not exists draft_homepage_funnel_id text;

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
      'insert into public.pages (id, user_id, funnel_id, name, slug, status) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)',
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
});
