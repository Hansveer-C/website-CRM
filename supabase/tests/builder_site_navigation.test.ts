import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.BUILDER_ROUTE_TEST_DATABASE_URL || process.env.DATABASE_URL;
const MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050700_create_builder_site_navigation.sql');

describe.skipIf(!DATABASE_URL)('Builder Site Navigation RPC Integration Tests (PostgreSQL 17)', () => {
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

        create or replace function auth.uid() returns uuid as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$ language sql stable;
      `);

      // Apply Task 6A migration
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');
      await client.query(migrationSql);

      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects unauthenticated calls to get/stage/revert navigation', async () => {
    const client = await pool.connect();
    try {
      await setAuthUser(client, null);
      const fakeSiteId = randomUUID();

      await expect(
        client.query('select public.get_builder_effective_site_navigation($1)', [fakeSiteId])
      ).rejects.toThrow(/Authentication required/);

      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4)', [
          fakeSiteId,
          'primary',
          JSON.stringify([]),
          null
        ])
      ).rejects.toThrow(/Authentication required/);

      await expect(
        client.query('select public.revert_builder_site_navigation_draft($1)', [fakeSiteId])
      ).rejects.toThrow(/Authentication required/);
    } finally {
      client.release();
    }
  });

  it('isolates tenants and rejects cross-tenant navigation operations', async () => {
    const client = await pool.connect();
    const userA = randomUUID();
    const userB = randomUUID();
    const siteA = randomUUID();
    const fnlA = `fnl-a-${randomUUID()}`;

    try {
      await client.query('insert into public.users (id, email) values ($1, $2), ($3, $4)', [
        userA, `${userA}@test.com`, userB, `${userB}@test.com`
      ]);

      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, $3)', [
        fnlA, userA, 'Funnel A'
      ]);

      await client.query(
        'insert into public.websites (id, user_id, name, subdomain) values ($1, $2, $3, $4)',
        [siteA, userA, 'Site A', `sub-${siteA}`]
      );

      // User B attempts to read site A navigation -> PT404
      await setAuthUser(client, userB);
      await expect(
        client.query('select public.get_builder_effective_site_navigation($1)', [siteA])
      ).rejects.toThrow(/Website not found/);

      // User B attempts to stage navigation on site A -> PT404
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4)', [
          siteA,
          'primary',
          JSON.stringify([]),
          null
        ])
      ).rejects.toThrow(/Website not found/);

      // User A attempts to target a funnel belonging to User B -> PT404
      const fnlB = `fnl-b-${randomUUID()}`;
      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, $3)', [
        fnlB, userB, 'Funnel B'
      ]);

      await setAuthUser(client, userA);
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4)', [
          siteA,
          'primary',
          JSON.stringify([
            { id: '1', label: 'Other Tenant', target_kind: 'internal', target_value: fnlB, position: 0, visible: true, is_cta: false }
          ]),
          null
        ])
      ).rejects.toThrow(/Internal destination not found or not owned/);
    } finally {
      client.release();
    }
  });

  it('stages, reorders, hides, and reverts draft navigation lifecycle', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const siteId = randomUUID();
    const fnl1 = `fnl-1-${randomUUID()}`;
    const fnl2 = `fnl-2-${randomUUID()}`;

    try {
      await client.query('insert into public.users (id, email) values ($1, $2)', [userId, `${userId}@test.com`]);
      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, $3), ($4, $5, $6)', [
        fnl1, userId, 'Services', fnl2, userId, 'About'
      ]);
      await client.query(
        'insert into public.websites (id, user_id, name, subdomain) values ($1, $2, $3, $4)',
        [siteId, userId, 'Nav Test Site', `sub-${siteId}`]
      );

      await setAuthUser(client, userId);

      // 1. Initial effective navigation is empty
      const initRes = await client.query('select public.get_builder_effective_site_navigation($1) as data', [siteId]);
      expect(initRes.rows[0].data.items).toEqual([]);
      expect(initRes.rows[0].data.is_draft).toBe(false);
      expect(initRes.rows[0].data.base_revision).toBe(0);

      // 2. Stage draft navigation
      const itemsStage1 = [
        { id: 'item-1', label: 'Services', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false },
        { id: 'item-2', label: 'About', target_kind: 'internal', target_value: fnl2, position: 1, visible: true, is_cta: false },
        { id: 'item-3', label: 'Call Us', target_kind: 'phone', target_value: '+15551234567', position: 2, visible: true, is_cta: true }
      ];

      const stageRes = await client.query(
        'select public.stage_builder_site_navigation_draft($1, $2, $3, $4) as data',
        [siteId, 'primary', JSON.stringify(itemsStage1), 0]
      );
      expect(stageRes.rows[0].data.is_draft).toBe(true);

      // 3. Effective returns draft state
      const effRes = await client.query('select public.get_builder_effective_site_navigation($1) as data', [siteId]);
      expect(effRes.rows[0].data.is_draft).toBe(true);
      expect(effRes.rows[0].data.items.length).toBe(3);

      // 4. Revert returns empty live state
      const revertRes = await client.query('select public.revert_builder_site_navigation_draft($1) as data', [siteId]);
      expect(revertRes.rows[0].data.is_draft).toBe(false);
      expect(revertRes.rows[0].data.items).toEqual([]);
    } finally {
      client.release();
    }
  });

  it('enforces optimistic concurrency and rejects stale base revisions', async () => {
    const client = await pool.connect();
    const userId = randomUUID();
    const siteId = randomUUID();
    const fnl1 = `fnl-c-${randomUUID()}`;

    try {
      await client.query('insert into public.users (id, email) values ($1, $2)', [userId, `${userId}@test.com`]);
      await client.query('insert into public.funnels (id, user_id, name) values ($1, $2, $3)', [fnl1, userId, 'Page']);
      await client.query(
        'insert into public.websites (id, user_id, name, subdomain) values ($1, $2, $3, $4)',
        [siteId, userId, 'Concurrency Site', `sub-${siteId}`]
      );

      // Insert live navigation at revision 1
      await client.query(
        'insert into public.builder_site_navigation_live (website_id, menu_scope, items, revision) values ($1, $2, $3, $4)',
        [siteId, 'primary', JSON.stringify([{ id: '1', label: 'Home', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]), 1]
      );

      await setAuthUser(client, userId);

      // Attempt write with stale base revision 0 -> PT409
      await expect(
        client.query('select public.stage_builder_site_navigation_draft($1, $2, $3, $4)', [
          siteId,
          'primary',
          JSON.stringify([{ id: '1', label: 'New Label', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]),
          0
        ])
      ).rejects.toThrow(/modified elsewhere/);

      // Write with correct base revision 1 succeeds
      const stageSuccess = await client.query(
        'select public.stage_builder_site_navigation_draft($1, $2, $3, $4) as data',
        [
          siteId,
          'primary',
          JSON.stringify([{ id: '1', label: 'New Label', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]),
          1
        ]
      );
      expect(stageSuccess.rows[0].data.is_draft).toBe(true);

      // Writing identical snapshot to live clears draft automatically
      const sameAsLive = await client.query(
        'select public.stage_builder_site_navigation_draft($1, $2, $3, $4) as data',
        [
          siteId,
          'primary',
          JSON.stringify([{ id: '1', label: 'Home', target_kind: 'internal', target_value: fnl1, position: 0, visible: true, is_cta: false }]),
          1
        ]
      );
      expect(sameAsLive.rows[0].data.is_draft).toBe(false);
      expect(sameAsLive.rows[0].data.message).toContain('redundant draft cleared');
    } finally {
      client.release();
    }
  });
});
