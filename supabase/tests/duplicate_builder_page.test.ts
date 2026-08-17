import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const databaseUrl = process.env.PAGE_DUPLICATE_TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:54333/postgres';

const userA = '00000000-0000-0000-0000-00000000000a';
const userB = '00000000-0000-0000-0000-00000000000b';

const duplicateMigration = readFileSync(
  new URL('../migrations/20260817050100_duplicate_builder_page.sql', import.meta.url),
  'utf8'
);

async function connect(): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function seedSourcePage(client: Client): Promise<void> {
  await client.query(`
    insert into public.pages (
      id, user_id, name, slug, status, seo_title, seo_description, seo_keywords, schema_markup, funnel_id, step_type, step_order
    ) values (
      'pg-source-1', '${userA}', 'Full Page', 'full-page', 'published',
      'SEO Title', 'SEO Desc', array['one', 'two'], '<script>ld+json</script>',
      'fnl-user-a', 'landing', 1
    ) on conflict (id) do nothing;

    insert into public.page_sections (
      id, user_id, page_id, type, content, styles, order_index
    ) values
      ('sec-1', '${userA}', 'pg-source-1', 'hero', '{"title": "Hero Title", "__builder_variant": "centered"}', '{"bg": "red"}', 0),
      ('sec-2', '${userA}', 'pg-source-1', 'services', '{"items": ["A", "B"]}', '{"pad": 10}', 1)
    on conflict (id) do nothing;
  `);
}

describe('PostgreSQL 17 duplicate_builder_page and create_builder_page RPC validation', () => {
  beforeAll(async () => {
    const client = await connect();
    try {
      // 1. Setup mock auth schema and functions for testing
      await client.query(`
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            create role anon;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            create role authenticated;
          end if;
        end $$;

        create schema if not exists auth;
        create or replace function auth.uid() returns uuid as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$ language sql stable;

        create table if not exists public.funnels (
          id text primary key,
          user_id text not null,
          name text not null,
          status text default 'draft',
          created_at timestamptz default now()
        );

        create table if not exists public.pages (
          id text primary key,
          user_id text not null,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          seo_title text,
          seo_description text,
          seo_keywords text[] default '{}'::text[],
          schema_markup text,
          created_at timestamptz not null default now(),
          funnel_id text references public.funnels(id),
          step_type text default 'page',
          step_order integer
        );

        create table if not exists public.page_sections (
          id text primary key,
          user_id text not null,
          page_id text not null references public.pages(id) on delete cascade,
          type text not null,
          content jsonb not null default '{}'::jsonb,
          styles jsonb not null default '{}'::jsonb,
          order_index integer not null default 0,
          created_at timestamptz not null default now()
        );
      `);

      // 2. Install migration
      await client.query(duplicateMigration);

      // 3. Populate base fixtures
      await client.query(`
        insert into public.funnels (id, user_id, name)
        values
          ('fnl-user-a', '${userA}', 'User A Funnel'),
          ('fnl-user-b', '${userB}', 'User B Funnel')
        on conflict (id) do nothing;
      `);
    } finally {
      await client.end();
    }
  });

  beforeEach(async () => {
    const client = await connect();
    try {
      await client.query('truncate table public.page_sections, public.pages cascade');
    } finally {
      await client.end();
    }
  });

  afterAll(async () => {
    // Teardown can be skipped for disposable container
  });

  it('1. verifies migration installs successfully and functions are registered', async () => {
    const client = await connect();
    try {
      const res = await client.query(`
        select routine_name
        from information_schema.routines
        where routine_schema = 'public'
          and routine_name in ('create_builder_page', 'duplicate_builder_page')
      `);
      expect(res.rows.map(r => r.routine_name)).toEqual(
        expect.arrayContaining(['create_builder_page', 'duplicate_builder_page'])
      );
    } finally {
      await client.end();
    }
  });

  it('2. unauthenticated duplicate call rejects with PT401', async () => {
    const client = await connect();
    try {
      await client.query("select set_config('request.jwt.claim.sub', '', false)");
      await expect(
        client.query('select public.duplicate_builder_page($1) as res', ['any-page'])
      ).rejects.toMatchObject({ code: 'PT401' });
    } finally {
      await client.end();
    }
  });

  it('3. cross-tenant source duplicate rejects with PT404 without existence leakage', async () => {
    const client = await connect();
    try {
      await client.query(`
        insert into public.pages (id, user_id, name, slug, funnel_id)
        values ('pg-secret-a', '${userA}', 'Secret Page', 'secret-page', 'fnl-user-a')
        on conflict (id) do nothing;
      `);

      // Acting as user B
      await client.query(`select set_config('request.jwt.claim.sub', '${userB}', false)`);
      await expect(
        client.query('select public.duplicate_builder_page($1) as res', ['pg-secret-a'])
      ).rejects.toMatchObject({ code: 'PT404' });
    } finally {
      await client.end();
    }
  });

  it('4. authenticated duplicate succeeds, deep-cloning all sections losslessly with new IDs and preserving order & metadata', async () => {
    const client = await connect();
    try {
      await seedSourcePage(client);
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      const res = await client.query('select public.duplicate_builder_page($1) as res', ['pg-source-1']);
      const dup = res.rows[0].res;

      // Duplicate Page assertions
      expect(dup.page.id).toMatch(/^pg_/);
      expect(dup.page.id).not.toBe('pg-source-1');
      expect(dup.page.user_id).toBe(userA);
      expect(dup.page.name).toBe('Full Page (Copy)');
      expect(dup.page.slug).toBe('full-page-copy');
      expect(dup.page.status).toBe('draft'); // Must be draft!
      expect(dup.page.seo_title).toBe('SEO Title');
      expect(dup.page.seo_description).toBe('SEO Desc');
      expect(dup.page.seo_keywords).toEqual(['one', 'two']);
      expect(dup.page.schema_markup).toBe('<script>ld+json</script>');
      expect(dup.page.funnel_id).toBe('fnl-user-a');
      expect(dup.page.step_order).toBe(2);

      // Duplicate Sections assertions
      expect(dup.sections).toHaveLength(2);
      expect(dup.sections[0].id).toMatch(/^sec_/);
      expect(dup.sections[0].id).not.toBe('sec-1');
      expect(dup.sections[0].page_id).toBe(dup.page.id);
      expect(dup.sections[0].type).toBe('hero');
      expect(dup.sections[0].variant).toBe('centered');
      expect(dup.sections[0].content).toEqual({ title: 'Hero Title', __builder_variant: 'centered' });
      expect(dup.sections[0].styles).toEqual({ bg: 'red' });
      expect(dup.sections[0].order).toBe(0);

      expect(dup.sections[1].id).toMatch(/^sec_/);
      expect(dup.sections[1].id).not.toBe('sec-2');
      expect(dup.sections[1].type).toBe('services'); // legacy type preserved!
      expect(dup.sections[1].content).toEqual({ items: ['A', 'B'] });
      expect(dup.sections[1].order).toBe(1);

      // Verify source unchanged in DB
      const srcCheck = await client.query('select * from public.pages where id = $1', ['pg-source-1']);
      expect(srcCheck.rows[0].status).toBe('published');
      expect(srcCheck.rows[0].name).toBe('Full Page');
    } finally {
      await client.end();
    }
  });

  it('5. concurrent duplication produces distinct names, slugs, and step_order values without collision', async () => {
    const client1 = await connect();
    const client2 = await connect();
    try {
      await seedSourcePage(client1);
      await client1.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      await client2.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);

      const [res1, res2] = await Promise.all([
        client1.query('select public.duplicate_builder_page($1) as res', ['pg-source-1']),
        client2.query('select public.duplicate_builder_page($1) as res', ['pg-source-1'])
      ]);

      const dup1 = res1.rows[0].res;
      const dup2 = res2.rows[0].res;

      expect(dup1.page.id).not.toBe(dup2.page.id);
      expect(dup1.page.name).not.toBe(dup2.page.name);
      expect(dup1.page.slug).not.toBe(dup2.page.slug);
      expect(dup1.page.step_order).not.toBe(dup2.page.step_order);
    } finally {
      await client1.end();
      await client2.end();
    }
  });

  it('6. handles max-length 120-char name and slug reserving suffix capacity', async () => {
    const client = await connect();
    try {
      const longName = 'X'.repeat(120);
      const longSlug = 'y'.repeat(120);

      await client.query(`
        insert into public.pages (id, user_id, name, slug, funnel_id, step_order)
        values ('pg-maxlen', '${userA}', '${longName}', '${longSlug}', 'fnl-user-a', 10)
        on conflict (id) do nothing;
      `);

      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      const res = await client.query('select public.duplicate_builder_page($1) as res', ['pg-maxlen']);
      const dup = res.rows[0].res;

      expect(dup.page.name.length).toBe(120);
      expect(dup.page.name).toBe(`${'X'.repeat(113)} (Copy)`);

      expect(dup.page.slug.length).toBe(120);
      expect(dup.page.slug).toBe(`${'y'.repeat(115)}-copy`);
    } finally {
      await client.end();
    }
  });

  it('7. global ID collision cannot overwrite an existing page', async () => {
    const client = await connect();
    try {
      await seedSourcePage(client);
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      await expect(
        client.query('select public.duplicate_builder_page($1, $2) as res', ['pg-source-1', 'pg-source-1'])
      ).rejects.toMatchObject({ code: 'PT409' });
    } finally {
      await client.end();
    }
  });

  it('8. create_builder_page: authenticated creation succeeds and verifies owned funnel', async () => {
    const client = await connect();
    try {
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      const res = await client.query(
        'select public.create_builder_page($1, $2, $3, $4, $5) as res',
        ['Created Page', 'created-page', 'fnl-user-a', null, 5]
      );
      const created = res.rows[0].res;
      expect(created.id).toMatch(/^pg_/);
      expect(created.user_id).toBe(userA);
      expect(created.name).toBe('Created Page');
      expect(created.slug).toBe('created-page');
      expect(created.status).toBe('draft');
      expect(created.funnel_id).toBe('fnl-user-a');
      expect(created.step_order).toBe(5);
    } finally {
      await client.end();
    }
  });

  it('9. create_builder_page: unauthenticated rejects PT401', async () => {
    const client = await connect();
    try {
      await client.query("select set_config('request.jwt.claim.sub', '', false)");
      await expect(
        client.query(
          'select public.create_builder_page($1, $2, $3) as res',
          ['Unauth Page', 'unauth-page', 'fnl-user-a']
        )
      ).rejects.toMatchObject({ code: 'PT401' });
    } finally {
      await client.end();
    }
  });

  it('10. create_builder_page: foreign funnel rejects PT403', async () => {
    const client = await connect();
    try {
      // User A attempting to create page in User B's funnel
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      await expect(
        client.query(
          'select public.create_builder_page($1, $2, $3) as res',
          ['Foreign Page', 'foreign-page', 'fnl-user-b']
        )
      ).rejects.toMatchObject({ code: 'PT403' });
    } finally {
      await client.end();
    }
  });

  it('11. create_builder_page: duplicate slug in account rejects PT409', async () => {
    const client = await connect();
    try {
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      await client.query(
        'select public.create_builder_page($1, $2, $3) as res',
        ['Existing Page', 'created-page', 'fnl-user-a']
      );

      await expect(
        client.query(
          'select public.create_builder_page($1, $2, $3) as res',
          ['Another Created Page', 'created-page', 'fnl-user-a']
        )
      ).rejects.toMatchObject({ code: 'PT409' });
    } finally {
      await client.end();
    }
  });

  it('12. transaction rollback: zero partial rows if any failure occurs during execution', async () => {
    const client = await connect();
    try {
      await seedSourcePage(client);
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      const countBefore = await client.query('select count(*) from public.pages');

      // Attempt invalid duplicate call (duplicate with an existing ID)
      await expect(
        client.query('select public.duplicate_builder_page($1, $2) as res', ['pg-source-1', 'pg-source-1'])
      ).rejects.toMatchObject({ code: 'PT409' });

      const countAfter = await client.query('select count(*) from public.pages');
      expect(countAfter.rows[0].count).toBe(countBefore.rows[0].count);
    } finally {
      await client.end();
    }
  });
});
