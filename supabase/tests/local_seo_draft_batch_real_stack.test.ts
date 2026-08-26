import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = process.env.LOCAL_SEO_BATCH_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const sql = (name: string) => readFileSync(resolve(__dirname, '../migrations', name), 'utf8');
const migrations = [
  '20260816053507_preserve_legacy_page_section_types.sql',
  '20260817050100_duplicate_builder_page.sql',
  '20260817050500_create_builder_route_drafts.sql',
  '20260822000000_establish_funnel_website_ownership.sql',
  '20260825000000_create_local_seo_draft_batch.sql'
].map(sql);
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

suite('Local SEO real lifecycle migration-stack integration', () => {
  let pool: pg.Pool;
  let grantsBefore: unknown[];
  beforeAll(() => { pool = new pg.Pool({ connectionString: url, max: 8 }); });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await pool.query('drop schema if exists private cascade; drop schema if exists public cascade; drop schema if exists auth cascade; create schema public; create schema private; create schema auth; create extension if not exists pgcrypto;');
    await pool.query(`do $$ begin create role anon; exception when duplicate_object then null; end $$; do $$ begin create role authenticated; exception when duplicate_object then null; end $$; do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      create table public.users(id text primary key);
      create table public.funnels(id text primary key,user_id text not null references public.users(id),website_id uuid,name text not null,status text not null default 'draft',service_type text,city text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
      create table public.pages(id text primary key,user_id text not null references public.users(id),funnel_id text references public.funnels(id),name text not null,slug text not null,status text not null default 'draft',step_order integer not null default 0,step_type text,seo_title text,seo_description text,seo_keywords text[] not null default '{}'::text[],created_at timestamptz not null default now(),updated_at timestamptz not null default now());
      create table public.page_sections(id text primary key,user_id text not null references public.users(id),page_id text not null references public.pages(id),type text not null,content jsonb not null default '{}'::jsonb,order_index integer not null default 0,styles jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
      create table private.page_section_save_revisions(page_id text primary key references public.pages(id),user_id text not null references public.users(id),revision bigint not null,document_hash text not null,updated_at timestamptz not null default now());
      create table public.websites(id uuid primary key,user_id text not null references public.users(id),name text not null,domain text,subdomain text,homepage_funnel_id text,draft_homepage_funnel_id text,publication_revision integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
      create table public.website_routes(id uuid primary key default gen_random_uuid(),website_id uuid not null references public.websites(id),path text not null,funnel_id text not null references public.funnels(id),created_at timestamptz not null default now(),unique(website_id,path));
      create table public.builder_published_revisions(id uuid primary key default gen_random_uuid(),website_id uuid not null,page_id text not null);
      create table public.builder_publication_targets(website_id uuid not null,page_id text not null,published_revision_id uuid not null,primary key(website_id,page_id));
      create function public.create_initial_website_graph(text,text,text,text[],text) returns jsonb language sql as $$select '{}'::jsonb$$;
      insert into public.users values ('${owner}'),('${other}');`);
    for (const migration of migrations.slice(0, -1)) await pool.query(migration);
    grantsBefore = (await pool.query(`select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','private') and table_name in ('funnels','pages','page_sections','builder_route_drafts') order by 1,2,3,4`)).rows;
    await pool.query(migrations.at(-1)!);
  });
  const site = async (user = owner) => { const id = randomUUID(); await pool.query('insert into public.websites(id,user_id,name) values($1,$2,$3)', [id, user, 'Site']); return id; };
  const call = async (website: string, services: string[], cities: string[], key: string, client: pg.Pool | pg.PoolClient = pool) => (await client.query('select public.create_local_seo_draft_batch($1,$2,$3,$4) result', [website, services, cities, key])).rows[0].result;
  const callAs = async (user: string, website: string, services: string[], cities: string[], key: string) => { const client = await pool.connect(); try { await client.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]); return await call(website, services, cities, key, client); } finally { client.release(); } };
  const counts = async () => Object.fromEntries(await Promise.all(['funnels','pages','page_sections','builder_route_drafts'].map(async table => [table, Number((await pool.query(`select count(*) count from public.${table}`)).rows[0].count)])));
  it('creates and reads a real draft graph without live publication', async () => {
    const website = await site();
    const result = await callAs(owner, website, ['Driveway Cleaning'], ['Port Moody'], 'local-seo:real-stack-0001');
    expect(result).toMatchObject({ success: true, data: { website_id: website, created_count: 1, replayed: false } });
    const page = result.data.pages[0];
    expect((await pool.query('select user_id,website_id,status,service_type,city from public.funnels where id=$1', [page.funnel_id])).rows[0]).toMatchObject({ user_id: owner, website_id: website, status: 'draft', service_type: 'Driveway Cleaning', city: 'Port Moody' });
    expect((await pool.query('select user_id,funnel_id,status from public.pages where id=$1', [page.page_id])).rows[0]).toMatchObject({ user_id: owner, funnel_id: page.funnel_id, status: 'draft' });
    expect((await pool.query('select page_id,type,content from public.page_sections where page_id=$1', [page.page_id])).rows[0]).toMatchObject({ page_id: page.page_id, type: 'hero', content: { heading: 'Driveway Cleaning in Port Moody' } });
    expect((await pool.query('select revision from private.page_section_save_revisions where page_id=$1', [page.page_id])).rows[0].revision).toBe('1');
    expect((await pool.query('select path,funnel_id from public.builder_route_drafts where website_id=$1', [website])).rows[0]).toMatchObject({ path: '/driveway-cleaning-port-moody', funnel_id: page.funnel_id });
    expect((await pool.query('select * from public.website_routes where website_id=$1', [website])).rows).toHaveLength(0);
    expect((await pool.query('select * from public.builder_published_revisions where website_id=$1', [website])).rows).toHaveLength(0);
    expect((await pool.query('select * from public.builder_publication_targets where website_id=$1', [website])).rows).toHaveLength(0);
  });

  it('isolates two owned Websites and rejects foreign, missing, and unauthenticated Websites', async () => {
    const a = await site(); const b = await site(); const foreign = await site(other);
    await callAs(owner, a, ['Wash'], ['Alpha'], 'local-seo:owned-site-a');
    await callAs(owner, b, ['Roof'], ['Beta'], 'local-seo:owned-site-b');
    expect((await pool.query('select website_id,count(*)::int count from public.funnels group by website_id order by website_id')).rows).toEqual(expect.arrayContaining([{ website_id: a, count: 1 }, { website_id: b, count: 1 }]));
    const before = await counts();
    await expect(callAs(owner, foreign, ['Attack'], ['City'], 'local-seo:foreign-site')).rejects.toMatchObject({ code: 'PT404' });
    await expect(callAs(owner, randomUUID(), ['Missing'], ['City'], 'local-seo:missing-site')).rejects.toMatchObject({ code: 'PT404' });
    await expect(callAs('', a, ['No Auth'], ['City'], 'local-seo:unauthenticated')).rejects.toMatchObject({ code: 'PT401' });
    expect(await counts()).toEqual(before);
  });

  it('preserves least privilege and introduces no lifecycle table grants', async () => {
    const privileges = (await pool.query(`select has_function_privilege('public','public.create_local_seo_draft_batch(uuid,text[],text[],text)','execute') public_execute,has_function_privilege('anon','public.create_local_seo_draft_batch(uuid,text[],text[],text)','execute') anon_execute,has_function_privilege('authenticated','public.create_local_seo_draft_batch(uuid,text[],text[],text)','execute') authenticated_execute`)).rows[0];
    expect(privileges).toEqual({ public_execute: false, anon_execute: false, authenticated_execute: true });
    const receipt = (await pool.query(`select has_table_privilege('authenticated','private.local_seo_draft_batch_receipts','select') s,has_table_privilege('authenticated','private.local_seo_draft_batch_receipts','insert') i,has_table_privilege('authenticated','private.local_seo_draft_batch_receipts','update') u,has_table_privilege('authenticated','private.local_seo_draft_batch_receipts','delete') d`)).rows[0];
    expect(receipt).toEqual({ s: false, i: false, u: false, d: false });
    const after = (await pool.query(`select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','private') and table_name in ('funnels','pages','page_sections','builder_route_drafts') order by 1,2,3,4`)).rows;
    expect(after).toEqual(grantsBefore);
  });

  it('rolls back the first written combination when the second route collides', async () => {
    const website = await site();
    await pool.query(`insert into public.funnels(id,user_id,website_id,name) values('existing-route','${owner}',$1,'Existing')`, [website]);
    await pool.query(`insert into public.website_routes(website_id,path,funnel_id) values($1,'/zulu-wash-port-moody','existing-route')`, [website]);
    const before = await counts();
    await expect(callAs(owner, website, ['Alpha Wash','Zulu Wash'], ['Port Moody'], 'local-seo:mid-batch-fail')).rejects.toMatchObject({ code: 'PT409' });
    expect(await counts()).toEqual(before);
    expect((await pool.query(`select count(*)::int count from private.local_seo_draft_batch_receipts`)).rows[0].count).toBe(0);
  });

  it('replays sequentially and conflicts on changed payload without new rows', async () => {
    const website = await site(); const key = 'local-seo:sequential-replay';
    const first = await callAs(owner, website, ['Wash'], ['City'], key); const before = await counts();
    const replay = await callAs(owner, website, ['Wash'], ['City'], key);
    expect(first.data.replayed).toBe(false); expect(replay.data.replayed).toBe(true); expect(replay.data.pages).toEqual(first.data.pages); expect(await counts()).toEqual(before);
    await expect(callAs(owner, website, ['Roof'], ['City'], key)).rejects.toMatchObject({ code: 'PT409' }); expect(await counts()).toEqual(before);
  });

  it('serializes concurrent same-key calls and concurrent incompatible payloads', async () => {
    const website = await site();
    const run = async (services: string[], key: string) => { const client = await pool.connect(); try { await client.query(`select set_config('request.jwt.claim.sub',$1,false)`, [owner]); return await call(website, services, ['City'], key, client); } finally { client.release(); } };
    const same = await Promise.all([run(['Wash'], 'local-seo:concurrent-same'), run(['Wash'], 'local-seo:concurrent-same')]);
    expect(same.map(result => result.data.replayed).sort()).toEqual([false, true]);
    expect((await pool.query(`select count(*)::int count from private.local_seo_draft_batch_receipts where idempotency_key='local-seo:concurrent-same'`)).rows[0].count).toBe(1);
    const different = await Promise.allSettled([run(['Roof'], 'local-seo:concurrent-different'), run(['Siding'], 'local-seo:concurrent-different')]);
    expect(different.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(different.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('allows only one concurrent graph for the same route under different keys', async () => {
    const website = await site();
    const run = async (service: string, key: string) => { const client = await pool.connect(); try { await client.query(`select set_config('request.jwt.claim.sub',$1,false)`, [owner]); return await call(website, [service], ['City'], key, client); } finally { client.release(); } };
    const results = await Promise.allSettled([run('Roof & Gutter', 'local-seo:route-race-one'), run('Roof Gutter', 'local-seo:route-race-two')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await pool.query(`select count(*)::int count from public.builder_route_drafts where website_id=$1`, [website])).rows[0].count).toBe(1);
  });

  it.each([
    [[], ['City'], 'local-seo:invalid-zero-services'], [['Wash'], [], 'local-seo:invalid-zero-cities'],
    [Array.from({length:13},(_,i)=>`S${i}`), ['City'], 'local-seo:invalid-services-max'],
    [['Wash'], Array.from({length:13},(_,i)=>`C${i}`), 'local-seo:invalid-cities-max'],
    [Array.from({length:7},(_,i)=>`S${i}`), Array.from({length:7},(_,i)=>`C${i}`), 'local-seo:invalid-combinations'],
    [['x'.repeat(81)], ['City'], 'local-seo:invalid-service-length'], [['Wash'], ['x'.repeat(121)], 'local-seo:invalid-city-length'],
    [['Wash','wash'], ['City'], 'local-seo:invalid-duplicate'], [[' '], ['City'], 'local-seo:invalid-blank'], [['Wash'], ['City'], 'short']
  ])('rejects unsafe direct RPC input without mutation', async (services, cities, key) => {
    const website = await site(); const before = await counts(); await expect(callAs(owner, website, services, cities, key)).rejects.toBeDefined(); expect(await counts()).toEqual(before);
  });
});
