import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.PAGE_REORDER_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const MIGRATION_PATH = resolve(__dirname, '../migrations/20260817050300_reorder_builder_pages.sql');

const userId = '00000000-0000-0000-0000-000000000091';
const funnelId = 'f-reorder-validation';
const page1 = 'p-reorder-validation-1';
const page2 = 'p-reorder-validation-2';

describeDatabase('reorder_builder_pages expected-order validation (PostgreSQL 17)', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`
        do $$ begin create role anon; exception when duplicate_object then null; end $$;
        do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
        do $$ begin create schema auth; exception when duplicate_schema then null; end $$;

        create table if not exists public.users (
          id text primary key,
          email text,
          created_at timestamptz default now()
        );

        create table if not exists public.funnels (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          status text not null default 'draft',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          service_type text,
          city text
        );

        create table if not exists public.pages (
          id text primary key,
          user_id text not null references public.users(id) on delete cascade,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          seo_title text,
          seo_description text,
          seo_keywords text[],
          created_at timestamptz not null default now(),
          funnel_id text references public.funnels(id) on delete cascade,
          step_type text,
          step_order integer
        );

        create or replace function auth.uid() returns uuid as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$ language sql stable;
      `);
      await client.query(readFileSync(MIGRATION_PATH, 'utf8'));
      await client.query(`
        insert into public.users(id, email)
        values ('${userId}', 'reorder-validation@test.invalid')
        on conflict (id) do nothing;
        insert into public.funnels(id, user_id, name)
        values ('${funnelId}', '${userId}', 'Validation Funnel')
        on conflict (id) do nothing;
        insert into public.pages(id, user_id, name, slug, funnel_id, step_order)
        values
          ('${page1}', '${userId}', 'Validation 1', 'validation-1', '${funnelId}', 0),
          ('${page2}', '${userId}', 'Validation 2', 'validation-2', '${funnelId}', 1)
        on conflict (id) do update set step_order = excluded.step_order;
      `);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  async function expectPt400(query: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`set local request.jwt.claim.sub = '${userId}'`);
      await expect(client.query(query)).rejects.toMatchObject({ code: 'PT400' });
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  }

  it('rejects NULL elements in both ordered and expected arrays', async () => {
    await expectPt400(`select public.reorder_builder_pages('${funnelId}', array[null::text, '${page2}'], array['${page1}', '${page2}'])`);
    await expectPt400(`select public.reorder_builder_pages('${funnelId}', array['${page1}', '${page2}'], array[null::text, '${page2}'])`);
  });

  it('rejects empty and whitespace-only IDs in both arrays', async () => {
    const malformedQueries = [
      `select public.reorder_builder_pages('${funnelId}', array['', '${page2}'], array['${page1}', '${page2}'])`,
      `select public.reorder_builder_pages('${funnelId}', array['   ', '${page2}'], array['${page1}', '${page2}'])`,
      `select public.reorder_builder_pages('${funnelId}', array['${page1}', '${page2}'], array['', '${page2}'])`,
      `select public.reorder_builder_pages('${funnelId}', array['${page1}', '${page2}'], array['   ', '${page2}'])`
    ];
    for (const query of malformedQueries) await expectPt400(query);
  });

  it('rejects duplicate IDs in the expected snapshot', async () => {
    await expectPt400(`select public.reorder_builder_pages('${funnelId}', array['${page1}', '${page2}'], array['${page1}', '${page1}'])`);
  });

  it('malformed expected NULL cannot bypass optimistic concurrency and causes zero writes', async () => {
    const before = await pool.query(
      `select id, step_order from public.pages where funnel_id = $1 order by id`,
      [funnelId]
    );

    await expectPt400(`select public.reorder_builder_pages('${funnelId}', array['${page2}', '${page1}'], array[null::text, '${page2}'])`);

    const after = await pool.query(
      `select id, step_order from public.pages where funnel_id = $1 order by id`,
      [funnelId]
    );
    expect(after.rows).toEqual(before.rows);
  });
});
