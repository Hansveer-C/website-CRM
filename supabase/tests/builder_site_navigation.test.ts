import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const DATABASE_URL =
  process.env.BUILDER_ROUTE_TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:postgres@127.0.0.1:5432/postgres';

const MIGRATION_PATH = resolve(
  __dirname,
  '../migrations/20260817050700_create_builder_site_navigation.sql'
);

describe('Builder Site Navigation Hardened Integration Tests (PostgreSQL 17)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    const client = await pool.connect();
    try {
      await client.query('begin');

      // Create base schemas, roles, and dependency tables
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
    if (pool) {
      await pool.end();
    }
  });

  async function setAuthUser(client: any, userId: string | null): Promise<void> {
    if (userId === null) {
      await client.query(`set "request.jwt.claim.sub" = ''`);
    } else {
      await client.query(`set "request.jwt.claim.sub" = '${userId}'`);
    }
  }

  it('denies direct table DML to authenticated users (authority restricted to RPCs)', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const siteId = randomUUID();

    try {
      await client.query('insert into public.users (id, email) values ($1, $2)', [userId, `${userId}@test.com`]);
      await client.query(
        'insert into public.websites (id, user_id, name, subdomain) values ($1, $2, $3, $4)',
        [siteId, userId, 'Security Site', `sub-${siteId}`]
      );

      await client.query('set role authenticated');
      await setAuthUser(client, userId);

      // Direct insert into live table must fail with permission denied
      await expect(
        client.query(
          'insert into public.builder_site_navigation_live (website_id, menu_scope, items, revision) values ($1, $2, $3, $4)',
          [siteId, 'primary', '[]', 1]
        )
      ).rejects.toThrow(/permission denied/);

      // Direct update of live table must fail with permission denied
      await expect(
        client.query(
          'update public.builder_site_navigation_live set items = $1 where website_id = $2',
          ['[]', siteId]
        )
      ).rejects.toThrow(/permission denied/);

      // Direct delete of live table must fail with permission denied
      await expect(
        client.query('delete from public.builder_site_navigation_live where website_id = $1', [siteId])
      ).rejects.toThrow(/permission denied/);

      // Direct insert into drafts table must fail with permission denied
      await expect(
        client.query(
          'insert into public.builder_site_navigation_drafts (website_id, menu_scope, items, base_revision, draft_revision) values ($1, $2, $3, $4, $5)',
          [siteId, 'primary', '[]', 1, 1]
        )
      ).rejects.toThrow(/permission denied/);

      // Direct update of drafts table must fail with permission denied
      await expect(
        client.query(
          'update public.builder_site_navigation_drafts set items = $1 where website_id = $2',
          ['[]', siteId]
        )
      ).rejects.toThrow(/permission denied/);

      // Direct delete of drafts table must fail with permission denied
      await expect(
        client.query('delete from public.builder_site_navigation_drafts where website_id = $1', [siteId])
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.query('reset role');
      client.release();
    }
  });

  it('denies function execution to anon role', async () => {
    const client = await pool.connect();
    const siteId = randomUUID();

    try {
      await client.query('set role anon');
      await setAuthUser(client, null);

      await expect(
        client.query('select public.get_builder_effective_site_navigation($1)', [siteId])
      ).rejects.toThrow(/permission denied/);

      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3)', [siteId, 'primary', '[]'])
      ).rejects.toThrow(/permission denied/);

      await expect(
        client.query('select public.revert_builder_site_navigation_draft($1)', [siteId])
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.query('reset role');
      client.release();
    }
  });

  it('enforces menu_scope validation across get, stage, and revert RPCs', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const siteId = randomUUID();

    try {
      await client.query('insert into public.users (id, email) values ($1, $2)', [userId, `${userId}@test.com`]);
      await client.query(
        'insert into public.websites (id, user_id, name, subdomain) values ($1, $2, $3, $4)',
        [siteId, userId, 'Scope Site', `sub-${siteId}`]
      );

      await setAuthUser(client, userId);

      await expect(
        client.query('select public.get_builder_effective_site_navigation($1, $2)', [siteId, 'invalid_scope'])
      ).rejects.toThrow(/Invalid menu scope/);

      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId,
          'invalid_scope',
          JSON.stringify([]),
          null,
          null
        ])
      ).rejects.toThrow(/Invalid menu scope/);

      await expect(
        client.query('select public.revert_builder_site_navigation_draft($1, $2)', [siteId, 'invalid_scope'])
      ).rejects.toThrow(/Invalid menu scope/);
    } finally {
      client.release();
    }
  });

  it('enforces complete server-side snapshot validation on stage RPC', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const siteId = randomUUID();
    const u1 = randomUUID();
    const u2 = randomUUID();

    try {
      await client.query('insert into public.users (id, email) values ($1, $2)', [userId, `${userId}@test.com`]);
      await client.query(
        'insert into public.websites (id, user_id, name, subdomain) values ($1, $2, $3, $4)',
        [siteId, userId, 'Validation Site', `sub-${siteId}`]
      );
      await setAuthUser(client, userId);

      // 1. Non-array payload
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify({}), null, null
        ])
      ).rejects.toThrow(/must be a JSON array/);

      // 2. Item not an object
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify(["string_item"]), null, null
        ])
      ).rejects.toThrow(/must be a JSON object/);

      // 3. Missing/empty ID or non-UUID ID
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: '', label: 'Home', target_kind: 'external', target_value: 'https://example.com', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/valid UUID format ID/);

      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: 'not-a-uuid', label: 'Home', target_kind: 'external', target_value: 'https://example.com', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/valid UUID format ID/);

      // 4. Duplicate item IDs
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([
            { id: u1, label: 'A', target_kind: 'external', target_value: 'https://a.com', position: 0, visible: true, is_cta: false },
            { id: u1, label: 'B', target_kind: 'external', target_value: 'https://b.com', position: 1, visible: true, is_cta: false }
          ]), null, null
        ])
      ).rejects.toThrow(/Duplicate navigation item ID/);

      // 5. Empty label
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: '   ', target_kind: 'external', target_value: 'https://example.com', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/label cannot be empty/);

      // 6. Label with control characters
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: "Bad\x01Name", target_kind: 'external', target_value: 'https://example.com', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/invalid control characters/);

      // 7. Non-boolean visible (string "false")
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Home', target_kind: 'external', target_value: 'https://example.com', position: 0, visible: "false", is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/visible attribute must be a JSON boolean/);

      // 8. Non-boolean is_cta
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Home', target_kind: 'external', target_value: 'https://example.com', position: 0, visible: true, is_cta: "true" }]), null, null
        ])
      ).rejects.toThrow(/is_cta attribute must be a JSON boolean/);

      // 9. Non-integer position (fractional 0.5 or string)
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Home', target_kind: 'external', target_value: 'https://example.com', position: 0.5, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/whole non-negative integer/);

      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Home', target_kind: 'external', target_value: 'https://example.com', position: "0", visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/whole non-negative integer/);

      // 10. Noncontiguous / gapped positions (e.g. 0, 2)
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([
            { id: u1, label: 'A', target_kind: 'external', target_value: 'https://a.com', position: 0, visible: true, is_cta: false },
            { id: u2, label: 'B', target_kind: 'external', target_value: 'https://b.com', position: 2, visible: true, is_cta: false }
          ]), null, null
        ])
      ).rejects.toThrow(/contiguous indices/);

      // 11. Duplicate positions
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([
            { id: u1, label: 'A', target_kind: 'external', target_value: 'https://a.com', position: 0, visible: true, is_cta: false },
            { id: u2, label: 'B', target_kind: 'external', target_value: 'https://b.com', position: 0, visible: true, is_cta: false }
          ]), null, null
        ])
      ).rejects.toThrow(/Duplicate item position/);

      // 12. External URL safety (rejects javascript:, data:, file:, CR/LF)
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Attack', target_kind: 'external', target_value: 'javascript:alert(1)', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/External navigation URL must be a valid http:\/\/ or https:\/\//);

      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Attack', target_kind: 'external', target_value: 'data:text/html,<script>alert(1)</script>', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/External navigation URL must be a valid http:\/\/ or https:\/\//);

      // 13. Phone safety
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Call', target_kind: 'phone', target_value: 'invalid_phone_text', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/Invalid phone number format/);

      // 14. Email safety
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Email', target_kind: 'email', target_value: 'not-an-email', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/Invalid email address format/);

      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId, 'primary', JSON.stringify([{ id: u1, label: 'Email', target_kind: 'email', target_value: 'user@example.com?subject=Injected', position: 0, visible: true, is_cta: false }]), null, null
        ])
      ).rejects.toThrow(/Invalid email address format/);
    } finally {
      client.release();
    }
  });

  it('enforces internal destination association with current website context', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const otherUserId = randomUUID();
    const siteA = randomUUID();
    const siteB = randomUUID();

    const fnlHomepageA = `fnl-ha-${randomUUID()}`;
    const fnlRouteA = `fnl-ra-${randomUUID()}`;
    const fnlDraftA = `fnl-da-${randomUUID()}`;
    const fnlSiteB = `fnl-b-${randomUUID()}`;
    const fnlOtherUser = `fnl-other-${randomUUID()}`;

    const u1 = randomUUID();
    const u2 = randomUUID();
    const u3 = randomUUID();
    const u4 = randomUUID();
    const u5 = randomUUID();

    try {
      await client.query('insert into public.users (id, email) values ($1, $2), ($3, $4)', [
        userId, `${userId}@test.com`,
        otherUserId, `${otherUserId}@test.com`
      ]);

      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12), ($13, $14, $15)', [
        fnlHomepageA, userId, 'Homepage A',
        fnlRouteA, userId, 'Route A',
        fnlDraftA, userId, 'Draft A',
        fnlSiteB, userId, 'Site B Page',
        fnlOtherUser, otherUserId, 'Foreign Page'
      ]);

      await client.query(
        'insert into public.websites (id, user_id, name, subdomain, homepage_funnel_id) values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
        [
          siteA, userId, 'Site A', `sub-${siteA}`, fnlHomepageA,
          siteB, userId, 'Site B', `sub-${siteB}`, fnlSiteB
        ]
      );

      await client.query(
        'insert into public.website_routes (website_id, path, funnel_id) values ($1, $2, $3)',
        [siteA, '/services', fnlRouteA]
      );

      await client.query(
        'insert into public.builder_route_drafts (website_id, path, funnel_id, action) values ($1, $2, $3, $4)',
        [siteA, '/about', fnlDraftA, 'upsert']
      );

      await setAuthUser(client, userId);

      // Same-site destinations succeed (homepage, live route, draft route)
      const validStage = await client.query(
        'select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data',
        [
          siteA,
          'primary',
          JSON.stringify([
            { id: u1, label: 'Home', target_kind: 'internal', target_value: fnlHomepageA, position: 0, visible: true, is_cta: false },
            { id: u2, label: 'Services', target_kind: 'internal', target_value: fnlRouteA, position: 1, visible: true, is_cta: false },
            { id: u3, label: 'About', target_kind: 'internal', target_value: fnlDraftA, position: 2, visible: true, is_cta: false }
          ]),
          null,
          null
        ]
      );
      expect(validStage.rows[0].data.success).toBe(true);

      // Same-user other-website funnel fails (PT404)
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteA,
          'primary',
          JSON.stringify([
            { id: u4, label: 'Other Site', target_kind: 'internal', target_value: fnlSiteB, position: 0, visible: true, is_cta: false }
          ]),
          null,
          1
        ])
      ).rejects.toThrow(/Internal destination not associated with this website/);

      // Foreign user funnel fails (PT404)
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteA,
          'primary',
          JSON.stringify([
            { id: u5, label: 'Foreign', target_kind: 'internal', target_value: fnlOtherUser, position: 0, visible: true, is_cta: false }
          ]),
          null,
          1
        ])
      ).rejects.toThrow(/Internal destination not found or not owned by user/);
    } finally {
      client.release();
    }
  });

  it('enforces draft_revision concurrency protection between multiple draft editors and prevents tokenless revert when draft exists', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const siteId = randomUUID();
    const fnl1 = `fnl-c-${randomUUID()}`;
    const u1 = randomUUID();

    try {
      await client.query('insert into public.users (id, email) values ($1, $2)', [userId, `${userId}@test.com`]);
      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, $3)', [fnl1, userId, 'Page']);
      await client.query(
        'insert into public.websites (id, user_id, name, subdomain, homepage_funnel_id) values ($1, $2, $3, $4, $5)',
        [siteId, userId, 'Concurrency Site', `sub-${siteId}`, fnl1]
      );

      // Insert live navigation at revision 1
      await client.query(
        'insert into public.builder_site_navigation_live (website_id, menu_scope, items, revision) values ($1, $2, $3, $4)',
        [siteId, 'primary', JSON.stringify([{ id: u1, label: 'Home', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]), 1]
      );

      await setAuthUser(client, userId);

      // Tab A and Tab B both see initial draft_revision = 0
      const initial = await client.query('select public.get_builder_effective_site_navigation($1) as data', [siteId]);
      expect(initial.rows[0].data.draft_revision).toBe(0);
      expect(initial.rows[0].data.live_revision).toBe(1);

      // Calling revert when no draft exists without token is a harmless no-op
      const noOpRevert = await client.query('select public.revert_builder_site_navigation_draft($1, $2) as data', [siteId, 'primary']);
      expect(noOpRevert.rows[0].data.is_draft).toBe(false);

      // Tab B stages draft 1 (expected draft revision 0) -> advances draft_revision to 1
      const tabBStage1 = await client.query(
        'select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data',
        [
          siteId,
          'primary',
          JSON.stringify([{ id: u1, label: 'Home (Tab B)', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]),
          1,
          0
        ]
      );
      expect(tabBStage1.rows[0].data.draft_revision).toBe(1);

      // Tab A attempts to stage against stale draft_revision 0 -> Rejected (PT409)
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)', [
          siteId,
          'primary',
          JSON.stringify([{ id: u1, label: 'Home (Tab A)', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]),
          1,
          0
        ])
      ).rejects.toThrow(/modified elsewhere/);

      // Tab A attempts tokenless revert while draft revision 1 exists -> Rejected (PT409)
      await expect(
        client.query('select public.revert_builder_site_navigation_draft($1, $2)', [siteId, 'primary'])
      ).rejects.toThrow(/Draft revision token is required/);

      // Tab A attempts stale revert with draft_revision 0 -> Rejected (PT409)
      await expect(
        client.query('select public.revert_builder_site_navigation_draft($1, $2, $3)', [siteId, 'primary', 0])
      ).rejects.toThrow(/modified elsewhere/);

      // Revert with matching draft_revision 1 succeeds and cleans draft
      const validRevert = await client.query(
        'select public.revert_builder_site_navigation_draft($1, $2, $3) as data',
        [siteId, 'primary', 1]
      );
      expect(validRevert.rows[0].data.is_draft).toBe(false);
      expect(validRevert.rows[0].data.draft_revision).toBe(0);
    } finally {
      client.release();
    }
  });

  it('safely auto-cleans redundant draft when proposal equals live', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const siteId = randomUUID();
    const fnl1 = `fnl-d-${randomUUID()}`;
    const u1 = randomUUID();

    try {
      await client.query('insert into public.users (id, email) values ($1, $2)', [userId, `${userId}@test.com`]);
      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, $3)', [fnl1, userId, 'Page']);
      await client.query(
        'insert into public.websites (id, user_id, name, subdomain, homepage_funnel_id) values ($1, $2, $3, $4, $5)',
        [siteId, userId, 'Clean Site', `sub-${siteId}`, fnl1]
      );

      const liveItems = [{ id: u1, label: 'Home', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }];

      await client.query(
        'insert into public.builder_site_navigation_live (website_id, menu_scope, items, revision) values ($1, $2, $3, $4)',
        [siteId, 'primary', JSON.stringify(liveItems), 1]
      );

      await setAuthUser(client, userId);

      // Stage an altered draft
      await client.query(
        'select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5)',
        [siteId, 'primary', JSON.stringify([{ id: u1, label: 'Home Modified', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]), 1, 0]
      );

      // Now stage items identical to live -> draft is automatically cleaned
      const cleanRes = await client.query(
        'select public.stage_builder_site_navigation_draft($1, $2, $3, $4, $5) as data',
        [siteId, 'primary', JSON.stringify(liveItems), 1, 1]
      );

      expect(cleanRes.rows[0].data.is_draft).toBe(false);
      expect(cleanRes.rows[0].data.draft_revision).toBe(0);

      const eff = await client.query('select public.get_builder_effective_site_navigation($1) as data', [siteId]);
      expect(eff.rows[0].data.is_draft).toBe(false);
    } finally {
      client.release();
    }
  });
});
