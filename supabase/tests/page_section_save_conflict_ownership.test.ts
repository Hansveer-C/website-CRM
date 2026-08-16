import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.PAGE_SECTION_RACE_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const userA = '00000000-0000-0000-0000-00000000000a';
const userB = '00000000-0000-0000-0000-00000000000b';
const oldMigration = readFileSync(new URL('../migrations/20260810050518_save_page_sections_document.sql', import.meta.url), 'utf8');
const hardeningMigration = readFileSync(new URL('../migrations/20260816030645_harden_page_section_save_conflict_ownership.sql', import.meta.url), 'utf8');

function section(id: string, pageId: string, marker: string, order = 0) {
  return { id, page_id: pageId, type: 'hero', content: { marker }, order, styles: { marker } };
}

async function connect(): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function saveAs(userId: string, pageId: string, sections: unknown[], expectedRevision: number | null = 0) {
  const client = await connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await client.query(
      'select public.save_page_sections_document($1, $2::jsonb, $3, $4) as result',
      [pageId, JSON.stringify(sections), 1, expectedRevision]
    );
    await client.query('commit');
    return result.rows[0].result as { revision: number; saved_count: number };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

async function revision(pageId: string): Promise<number> {
  const client = await connect();
  try {
    const result = await client.query('select revision from private.page_section_save_revisions where page_id = $1', [pageId]);
    return Number(result.rows[0].revision);
  } finally {
    await client.end();
  }
}

async function row(id: string) {
  const client = await connect();
  try {
    const result = await client.query('select id, user_id, page_id, type, content, order_index, styles from public.page_sections where id = $1', [id]);
    return result.rows[0] as Record<string, unknown> | undefined;
  } finally {
    await client.end();
  }
}

async function runCollision(
  first: { userId: string; pageId: string; marker: string; expectedRevision?: number },
  second: { userId: string; pageId: string; marker: string; expectedRevision?: number },
  collisionId: string
) {
  const controller = await connect();
  await controller.query('select pg_advisory_lock(860816030645)');
  const firstSave = saveAs(first.userId, first.pageId, [section(collisionId, first.pageId, first.marker)], first.expectedRevision ?? 0);
  const secondSave = saveAs(second.userId, second.pageId, [section(collisionId, second.pageId, second.marker)], second.expectedRevision ?? 0);
  try {
    let waiting = 0;
    for (let attempt = 0; attempt < 100 && waiting < 2; attempt += 1) {
      const status = await controller.query(`
        select count(*)::integer as waiting
        from pg_stat_activity
        where pid <> pg_backend_pid()
          and query like 'select public.save_page_sections_document%'
          and wait_event_type = 'Lock'
          and wait_event = 'advisory'
      `);
      waiting = status.rows[0].waiting;
      if (waiting < 2) await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(2);
  } finally {
    await controller.query('select pg_advisory_unlock(860816030645)');
    await controller.end();
  }
  return Promise.allSettled([firstSave, secondSave]);
}

describeDatabase('page section save conflict ownership on PostgreSQL 17', () => {
  beforeAll(async () => {
    const client = await connect();
    try {
      await client.query(`
        create role anon nologin;
        create role authenticated nologin;
        create schema auth;
        create or replace function auth.uid() returns uuid language sql stable as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        create table public.users (id text primary key);
        create table public.pages (id text primary key, user_id text not null references public.users(id));
        create table public.page_sections (
          id text primary key,
          user_id text not null references public.users(id),
          page_id text not null references public.pages(id),
          type text not null,
          content jsonb not null,
          order_index integer not null,
          styles jsonb not null,
          created_at timestamptz not null default now()
        );
        insert into public.users(id) values ('${userA}'), ('${userB}');
        insert into public.pages(id, user_id) values
          ('normal-a', '${userA}'), ('revision-a', '${userA}'),
          ('same-owner-a', '${userA}'), ('same-owner-b', '${userA}'),
          ('cross-user-a', '${userA}'), ('cross-user-b', '${userB}'),
          ('foreign-a', '${userA}'), ('foreign-b', '${userB}'),
          ('retry-b', '${userB}');
      `);
      await client.query(oldMigration);
      await client.query(hardeningMigration);
      await client.query(`
        create function public.test_page_section_insert_barrier() returns trigger
        language plpgsql set search_path = '' as $$
        begin
          if new.id like 'race-%' then
            perform pg_catalog.pg_advisory_xact_lock_shared(860816030645);
          end if;
          return new;
        end;
        $$;
        create trigger test_page_section_insert_barrier
        before insert on public.page_sections
        for each row execute function public.test_page_section_insert_barrier();
      `);
    } finally {
      await client.end();
    }
  }, 30_000);

  afterAll(async () => {
    if (!databaseUrl) return;
    const client = await connect();
    try {
      await client.query('drop trigger if exists test_page_section_insert_barrier on public.page_sections');
      await client.query('drop function if exists public.test_page_section_insert_barrier()');
    } finally {
      await client.end();
    }
  });

  it('preserves normal same-owner, same-page replacement', async () => {
    const result = await saveAs(userA, 'normal-a', [section('normal-section', 'normal-a', 'one')]);
    expect(result).toMatchObject({ revision: 1, saved_count: 1 });
    await expect(saveAs(userA, 'normal-a', [section('normal-section', 'normal-a', 'two')], 1)).resolves.toMatchObject({ revision: 2 });
    expect((await row('normal-section'))?.content).toEqual({ marker: 'two' });
  });

  it('preserves established expected-revision conflicts', async () => {
    await saveAs(userA, 'revision-a', [section('revision-section', 'revision-a', 'one')]);
    await expect(saveAs(userA, 'revision-a', [section('revision-section', 'revision-a', 'stale')], 0)).rejects.toMatchObject({ code: 'PT409' });
    expect((await row('revision-section'))?.content).toEqual({ marker: 'one' });
    expect(await revision('revision-a')).toBe(1);
  });

  it('rejects same-owner cross-page concurrent collisions after both preflights', async () => {
    await saveAs(userA, 'same-owner-a', [section('old-same-a', 'same-owner-a', 'old-a')]);
    await saveAs(userA, 'same-owner-b', [section('old-same-b', 'same-owner-b', 'old-b')]);
    const results = await runCollision(
      { userId: userA, pageId: 'same-owner-a', marker: 'winner-a', expectedRevision: 1 },
      { userId: userA, pageId: 'same-owner-b', marker: 'winner-b', expectedRevision: 1 },
      'race-same-owner'
    );
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'PT403' } });
    const winner = await row('race-same-owner');
    const winnerIndex = results.findIndex(result => result.status === 'fulfilled');
    const winnerInput = winnerIndex === 0
      ? { pageId: 'same-owner-a', marker: 'winner-a' }
      : { pageId: 'same-owner-b', marker: 'winner-b' };
    const loserPage = winnerIndex === 0 ? 'same-owner-b' : 'same-owner-a';
    const loserOld = winnerIndex === 0 ? 'old-same-b' : 'old-same-a';
    expect(winner).toMatchObject({ user_id: userA, page_id: winnerInput.pageId, content: { marker: winnerInput.marker }, styles: { marker: winnerInput.marker } });
    expect(await row(loserOld)).toBeDefined();
    expect(await revision(loserPage)).toBe(1);
  }, 30_000);

  it('rejects cross-user concurrent collisions without tenant overwrite', async () => {
    const results = await runCollision(
      { userId: userA, pageId: 'cross-user-a', marker: 'tenant-a' },
      { userId: userB, pageId: 'cross-user-b', marker: 'tenant-b' },
      'race-cross-user'
    );
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'PT403' } });
    const winner = await row('race-cross-user');
    expect([
      { user_id: userA, page_id: 'cross-user-a', content: { marker: 'tenant-a' } },
      { user_id: userB, page_id: 'cross-user-b', content: { marker: 'tenant-b' } }
    ]).toContainEqual({ user_id: winner?.user_id, page_id: winner?.page_id, content: winner?.content });
    const loserPage = winner?.page_id === 'cross-user-a' ? 'cross-user-b' : 'cross-user-a';
    expect(await revision(String(loserPage))).toBe(0);
  }, 30_000);

  it('rejects an existing foreign section ID without changing its owner', async () => {
    await saveAs(userA, 'foreign-a', [section('foreign-owned', 'foreign-a', 'original')]);
    await expect(saveAs(userB, 'foreign-b', [section('foreign-owned', 'foreign-b', 'attack')])).rejects.toMatchObject({ code: 'PT403' });
    expect(await row('foreign-owned')).toMatchObject({ user_id: userA, page_id: 'foreign-a', content: { marker: 'original' } });
    expect(await revision('foreign-b')).toBe(0);
  });

  it('rolls back an entire multi-section document when one ID belongs to a foreign page', async () => {
    await expect(saveAs(userB, 'foreign-b', [
      section('new-before-foreign', 'foreign-b', 'new', 0),
      section('foreign-owned', 'foreign-b', 'attack', 1)
    ])).rejects.toMatchObject({ code: 'PT403' });
    expect(await row('new-before-foreign')).toBeUndefined();
    expect(await row('foreign-owned')).toMatchObject({ user_id: userA, page_id: 'foreign-a', content: { marker: 'original' } });
    expect(await revision('foreign-b')).toBe(0);
  });

  it('allows a valid retry with a new collision-resistant ID', async () => {
    await expect(saveAs(userB, 'retry-b', [section('foreign-owned', 'retry-b', 'attack')])).rejects.toMatchObject({ code: 'PT403' });
    await expect(saveAs(userB, 'retry-b', [section('sec-123e4567-e89b-12d3-a456-426614174000', 'retry-b', 'valid')])).resolves.toMatchObject({ revision: 1 });
  });

  it('denies anonymous execution', async () => {
    const client = await connect();
    try {
      await client.query('set role anon');
      await expect(client.query(
        'select public.save_page_sections_document($1, $2::jsonb, 1, 0)',
        ['normal-a', JSON.stringify([section('anonymous', 'normal-a', 'anonymous')])]
      )).rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.end();
    }
  });

  it('denies cross-tenant page ownership', async () => {
    await expect(saveAs(userB, 'normal-a', [section('cross-page', 'normal-a', 'attack')], 2)).rejects.toMatchObject({ code: 'PT403' });
  });

  it('preserves SECURITY DEFINER, empty search_path, and least-privilege execution', async () => {
    const client = await connect();
    try {
      const result = await client.query(`
        select p.prosecdef,
               p.proconfig,
               has_function_privilege('anon', p.oid, 'execute') as anon_execute,
               has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
        from pg_proc p
        where p.oid = 'public.save_page_sections_document(text,jsonb,bigint,bigint)'::regprocedure
      `);
      expect(result.rows[0]).toMatchObject({
        prosecdef: true,
        proconfig: ['search_path=""'],
        anon_execute: false,
        authenticated_execute: true
      });
    } finally {
      await client.end();
    }
  });
});
