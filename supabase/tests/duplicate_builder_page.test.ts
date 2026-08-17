import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const databaseUrl = process.env.PAGE_DUPLICATE_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

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
      id, user_id, name, slug, status, seo_title, seo_description, seo_keywords, funnel_id, step_type, step_order
    ) values (
      'pg-source-1', '${userA}', 'Full Page', 'full-page', 'published',
      'SEO Title', 'SEO Desc', array['one', 'two'],
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

describeDatabase('PostgreSQL 17 duplicate_builder_page and create_builder_page RPC validation', () => {
  beforeAll(async () => {
    const client = await connect();
    try {
      // 1. Setup exact production-parity schema and mock auth
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
          status text not null default 'draft',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          service_type text,
          city text
        );

        -- Exact deployed production public.pages shape (NO schema_markup)
        create table if not exists public.pages (
          id text primary key,
          user_id text not null,
          name text not null,
          slug text not null,
          status text not null default 'draft',
          seo_title text,
          seo_description text,
          seo_keywords text[] default '{}'::text[],
          created_at timestamptz not null default now(),
          funnel_id text references public.funnels(id),
          step_type text,
          step_order integer
        );

        -- Exact deployed production public.page_sections shape (NO funnel_id)
        create table if not exists public.page_sections (
          id text primary key,
          user_id text not null,
          page_id text not null references public.pages(id) on delete cascade,
          type text not null,
          content jsonb not null default '{}'::jsonb,
          order_index integer not null default 0,
          styles jsonb not null default '{}'::jsonb,
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
      // Drop any failure injection triggers
      await client.query(`
        drop trigger if exists trg_inject_section_failure on public.page_sections;
        drop trigger if exists trg_inject_section_collision on public.page_sections;
        truncate table public.page_sections, public.pages cascade;
      `);
    } finally {
      await client.end();
    }
  });

  it('1. verifies migration installs successfully and functions are registered', async () => {
    const client = await connect();
    try {
      const res = await client.query(`
        select routine_name
        from information_schema.columns c
        join information_schema.routines r on r.routine_schema = 'public'
        where r.routine_name in ('create_builder_page', 'duplicate_builder_page')
        limit 2;
      `);
      expect(res.rows.length).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });

  it('2. production-shape regression assertion: public.pages does NOT contain schema_markup', async () => {
    const client = await connect();
    try {
      const res = await client.query(`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'pages'
          and column_name = 'schema_markup';
      `);
      expect(res.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  it('3. unauthenticated duplicate call rejects with PT401', async () => {
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

  it('4. unauthenticated create call rejects with PT401', async () => {
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

  it('5. cross-tenant source duplicate rejects with PT404 without existence leakage', async () => {
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

  it('6. cross-tenant create funnel rejects with PT403', async () => {
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

  it('7. corrupt owned-page / foreign-funnel relationship rejects duplicate with PT403 with 0 new rows', async () => {
    const client = await connect();
    try {
      // Create corrupt page: owned by User A, but funnel is User B's funnel
      await client.query(`
        insert into public.pages (id, user_id, name, slug, funnel_id, status)
        values ('pg-corrupt-1', '${userA}', 'Corrupt Page', 'corrupt-page', 'fnl-user-b', 'published')
        on conflict (id) do nothing;
      `);

      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      const pageCountBefore = await client.query('select count(*) from public.pages');

      await expect(
        client.query('select public.duplicate_builder_page($1) as res', ['pg-corrupt-1'])
      ).rejects.toMatchObject({ code: 'PT403' });

      const pageCountAfter = await client.query('select count(*) from public.pages');
      expect(pageCountAfter.rows[0].count).toBe(pageCountBefore.rows[0].count);
    } finally {
      await client.end();
    }
  });

  it('8. valid authenticated create succeeds with DB-computed step_order and null step_type', async () => {
    const client = await connect();
    try {
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      const res = await client.query(
        'select public.create_builder_page($1, $2, $3) as res',
        ['Created Page', 'created-page', 'fnl-user-a']
      );
      const created = res.rows[0].res;
      expect(created.id).toMatch(/^pg_/);
      expect(created.user_id).toBe(userA);
      expect(created.name).toBe('Created Page');
      expect(created.slug).toBe('created-page');
      expect(created.status).toBe('draft');
      expect(created.funnel_id).toBe('fnl-user-a');
      expect(created.step_type).toBeNull();
      expect(created.step_order).toBe(0); // First page in funnel gets step_order 0
      expect(created.schema_markup).toBeUndefined();
    } finally {
      await client.end();
    }
  });

  it('9. create idempotency: same create request + same p_id returns existing page; different request rejects PT409', async () => {
    const client = await connect();
    try {
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      const id = 'pg_idempotent_123';

      // First call
      const res1 = await client.query(
        'select public.create_builder_page($1, $2, $3, $4) as res',
        ['Idempotent Page', 'idempotent-page', 'fnl-user-a', id]
      );
      const created1 = res1.rows[0].res;

      // Second identical call (same p_id)
      const res2 = await client.query(
        'select public.create_builder_page($1, $2, $3, $4) as res',
        ['Idempotent Page', 'idempotent-page', 'fnl-user-a', id]
      );
      const created2 = res2.rows[0].res;

      expect(created2).toEqual(created1);

      // Verify only 1 row exists
      const dbRows = await client.query('select * from public.pages where id = $1', [id]);
      expect(dbRows.rows).toHaveLength(1);

      // Different request with same ID rejects PT409
      await expect(
        client.query(
          'select public.create_builder_page($1, $2, $3, $4) as res',
          ['Different Name', 'different-slug', 'fnl-user-a', id]
        )
      ).rejects.toMatchObject({ code: 'PT409' });
    } finally {
      await client.end();
    }
  });

  it('10. hardens create name and slug validation against invalid and reserved values', async () => {
    const client = await connect();
    try {
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);

      // Reserved slugs
      const reservedSlugs = ['home', 'api', 'builder', 'functions', 'login', 'preview', 'website-dashboard'];
      for (const slug of reservedSlugs) {
        await expect(
          client.query('select public.create_builder_page($1, $2, $3) as res', ['Page', slug, 'fnl-user-a'])
        ).rejects.toMatchObject({ code: 'PT422' });
      }

      // Invalid slug characters (internal slash, dots, symbols)
      const invalidSlugs = ['bad/slug', 'bad..slug', 'bad?slug', 'bad#slug', 'bad:slug'];
      for (const slug of invalidSlugs) {
        await expect(
          client.query('select public.create_builder_page($1, $2, $3) as res', ['Page', slug, 'fnl-user-a'])
        ).rejects.toMatchObject({ code: 'PT422' });
      }

      // Control characters in name
      await expect(
        client.query('select public.create_builder_page($1, $2, $3) as res', ['Page\x01Name', 'valid-slug', 'fnl-user-a'])
      ).rejects.toMatchObject({ code: 'PT422' });
    } finally {
      await client.end();
    }
  });

  it('11. authenticated duplicate succeeds, deep-cloning all sections losslessly with new IDs and preserving order, metadata, and step_type', async () => {
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
      expect(dup.page.status).toBe('draft');
      expect(dup.page.seo_title).toBe('SEO Title');
      expect(dup.page.seo_description).toBe('SEO Desc');
      expect(dup.page.seo_keywords).toEqual(['one', 'two']);
      expect(dup.page.funnel_id).toBe('fnl-user-a');
      expect(dup.page.step_type).toBe('landing'); // Preserved from source page
      expect(dup.page.step_order).toBe(2);
      expect(dup.page.schema_markup).toBeUndefined();

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
      expect(dup.sections[1].type).toBe('services');
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

  it('12. handles max-length 120-char name and slug reserving suffix capacity', async () => {
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

  it('13. concurrent Create/Create in same funnel produces distinct sequential step_order values', async () => {
    const client1 = await connect();
    const client2 = await connect();
    try {
      await client1.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      await client2.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);

      const [res1, res2] = await Promise.all([
        client1.query('select public.create_builder_page($1, $2, $3) as res', ['Page 1', 'page-one', 'fnl-user-a']),
        client2.query('select public.create_builder_page($1, $2, $3) as res', ['Page 2', 'page-two', 'fnl-user-a'])
      ]);

      const c1 = res1.rows[0].res;
      const c2 = res2.rows[0].res;

      expect(c1.id).not.toBe(c2.id);
      expect(c1.step_order).not.toBe(c2.step_order);
      const orders = [c1.step_order, c2.step_order].sort();
      expect(orders).toEqual([0, 1]);
    } finally {
      await client1.end();
      await client2.end();
    }
  });

  it('14. concurrent Duplicate/Duplicate in same funnel produces distinct names, slugs, and step_order values', async () => {
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

  it('15. concurrent Create and Duplicate in same funnel serialize on shared lifecycle lock producing distinct step_orders', async () => {
    const client1 = await connect();
    const client2 = await connect();
    try {
      await seedSourcePage(client1);
      await client1.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);
      await client2.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);

      const [createRes, dupRes] = await Promise.all([
        client1.query('select public.create_builder_page($1, $2, $3) as res', ['New Page', 'new-page', 'fnl-user-a']),
        client2.query('select public.duplicate_builder_page($1) as res', ['pg-source-1'])
      ]);

      const created = createRes.rows[0].res;
      const duplicated = dupRes.rows[0].res;

      expect(created.id).not.toBe(duplicated.page.id);
      expect(created.step_order).not.toBe(duplicated.page.step_order);
      const orders = [created.step_order, duplicated.page.step_order].sort();
      expect(orders).toEqual([2, 3]); // source had order 1, so concurrent create & duplicate get 2 and 3
    } finally {
      await client1.end();
      await client2.end();
    }
  });

  it('16. real post-Page-insert Section failure rollback: transaction failure after Page insert rolls back Page too', async () => {
    const client = await connect();
    try {
      await seedSourcePage(client);
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);

      const pageCountBefore = await client.query('select count(*) from public.pages');
      const sectionCountBefore = await client.query('select count(*) from public.page_sections');

      // Install failure injection trigger that raises only on new duplicate section inserts (not source sections)
      await client.query(`
        create or replace function public.__test_fail_section_insert()
        returns trigger as $$
        begin
          if new.page_id <> 'pg-source-1' then
            raise exception 'Injected section copy error';
          end if;
          return new;
        end;
        $$ language plpgsql;

        create trigger trg_inject_section_failure
        before insert on public.page_sections
        for each row execute function public.__test_fail_section_insert();
      `);

      // Duplicate should fail during section insertion after Page insert has already occurred
      await expect(
        client.query('select public.duplicate_builder_page($1) as res', ['pg-source-1'])
      ).rejects.toThrow('Injected section copy error');

      // Assert complete rollback: 0 new pages, 0 new sections
      const pageCountAfter = await client.query('select count(*) from public.pages');
      const sectionCountAfter = await client.query('select count(*) from public.page_sections');

      expect(pageCountAfter.rows[0].count).toBe(pageCountBefore.rows[0].count);
      expect(sectionCountAfter.rows[0].count).toBe(sectionCountBefore.rows[0].count);

      // Verify source is unchanged
      const srcCheck = await client.query('select * from public.pages where id = $1', ['pg-source-1']);
      expect(srcCheck.rows[0].name).toBe('Full Page');
    } finally {
      await client.query('drop trigger if exists trg_inject_section_failure on public.page_sections');
      await client.query('drop function if exists public.__test_fail_section_insert');
      await client.end();
    }
  });

  it('17. forced global Section-ID collision rolls back entire transaction leaving existing section untouched', async () => {
    const client = await connect();
    try {
      await seedSourcePage(client);
      await client.query(`select set_config('request.jwt.claim.sub', '${userA}', false)`);

      // Pre-seed an existing section on another page/tenant
      await client.query(`
        insert into public.pages (id, user_id, name, slug, funnel_id)
        values ('pg-other', '${userB}', 'Other Page', 'other-page', 'fnl-user-b')
        on conflict (id) do nothing;

        insert into public.page_sections (id, user_id, page_id, type, content)
        values ('sec-colliding-target', '${userB}', 'pg-other', 'hero', '{"original": true}')
        on conflict (id) do nothing;
      `);

      const pageCountBefore = await client.query('select count(*) from public.pages');

      // Install trigger forcing duplicated section to collide with 'sec-colliding-target'
      await client.query(`
        create or replace function public.__test_collide_section_id()
        returns trigger as $$
        begin
          if new.page_id <> 'pg-source-1' and new.page_id <> 'pg-other' then
            new.id := 'sec-colliding-target';
          end if;
          return new;
        end;
        $$ language plpgsql;

        create trigger trg_inject_section_collision
        before insert on public.page_sections
        for each row execute function public.__test_collide_section_id();
      `);

      // Duplicate should fail with primary key collision
      await expect(
        client.query('select public.duplicate_builder_page($1) as res', ['pg-source-1'])
      ).rejects.toMatchObject({ code: '23505' });

      // Verify complete rollback and existing section preserved
      const pageCountAfter = await client.query('select count(*) from public.pages');
      expect(pageCountAfter.rows[0].count).toBe(pageCountBefore.rows[0].count);

      const targetCheck = await client.query('select * from public.page_sections where id = $1', ['sec-colliding-target']);
      expect(targetCheck.rows[0].page_id).toBe('pg-other');
      expect(targetCheck.rows[0].content).toEqual({ original: true });
    } finally {
      await client.query('drop trigger if exists trg_inject_section_collision on public.page_sections');
      await client.query('drop function if exists public.__test_collide_section_id');
      await client.end();
    }
  });
});
