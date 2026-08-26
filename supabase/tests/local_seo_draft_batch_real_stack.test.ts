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
  type CallSpec = { user: string; website: string; services: string[]; cities: string[]; key: string };
  const raceCalls = async (specs: CallSpec[]) => {
    const clients = await Promise.all(specs.map(() => pool.connect()));
    try {
      await Promise.all(clients.map((client, index) => client.query(
        `select set_config('request.jwt.claim.sub',$1,false), set_config('lock_timeout','5000',false), set_config('statement_timeout','15000',false)`,
        [specs[index].user]
      )));
      let release!: () => void;
      const barrier = new Promise<void>(resolve => { release = resolve; });
      const pending = specs.map((spec, index) => (async () => {
        await barrier;
        return call(spec.website, spec.services, spec.cities, spec.key, clients[index]);
      })());
      release();
      return await Promise.allSettled(pending);
    } finally {
      clients.forEach(client => client.release());
    }
  };
  const counts = async () => ({
    ...Object.fromEntries(await Promise.all(['funnels','pages','page_sections','builder_route_drafts'].map(async table => [table, Number((await pool.query(`select count(*) count from public.${table}`)).rows[0].count)]))),
    receipts: Number((await pool.query('select count(*) count from private.local_seo_draft_batch_receipts')).rows[0].count)
  });
  const graph = async (website: string) => {
    const [funnels, pages, sections, routes, receipts] = await Promise.all([
      pool.query('select id,user_id,website_id,service_type,city from public.funnels where website_id=$1 order by id', [website]),
      pool.query('select p.id,p.funnel_id,p.status from public.pages p join public.funnels f on f.id=p.funnel_id where f.website_id=$1 order by p.id', [website]),
      pool.query('select s.id,s.page_id,s.type from public.page_sections s join public.pages p on p.id=s.page_id join public.funnels f on f.id=p.funnel_id where f.website_id=$1 order by s.id', [website]),
      pool.query('select funnel_id,path from public.builder_route_drafts where website_id=$1 order by path', [website]),
      pool.query(`select user_id,idempotency_key,payload,result from private.local_seo_draft_batch_receipts where payload->>'website_id'=$1 order by idempotency_key`, [website])
    ]);
    return { funnels: funnels.rows, pages: pages.rows, sections: sections.rows, routes: routes.rows, receipts: receipts.rows };
  };
  const successes = (results: PromiseSettledResult<any>[]) => results.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled');
  const failures = (results: PromiseSettledResult<any>[]) => results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  const expectSingleGraph = async (website: string, page: any) => {
    const persisted = await graph(website);
    expect(persisted.funnels).toHaveLength(1);
    expect(persisted.pages).toHaveLength(1);
    expect(persisted.sections).toHaveLength(1);
    expect(persisted.routes).toHaveLength(1);
    expect(persisted.receipts).toHaveLength(1);
    expect(persisted.funnels[0].id).toBe(page.funnel_id);
    expect(persisted.pages[0]).toMatchObject({ id: page.page_id, funnel_id: page.funnel_id, status: 'draft' });
    expect(persisted.sections[0]).toMatchObject({ page_id: page.page_id, type: 'hero' });
    expect(persisted.routes[0]).toMatchObject({ funnel_id: page.funnel_id, path: page.path });
    expect(persisted.receipts[0].result.data.pages).toEqual([page]);
    return persisted;
  };
  it('creates and reads a real draft graph without live publication', async () => {
    const website = await site();
    const result = await callAs(owner, website, ['Driveway Cleaning'], ['Port Moody'], 'local-seo:real-stack-0001');
    expect(result).toMatchObject({ success: true, data: { website_id: website, created_count: 1, replayed: false } });
    const page = result.data.pages[0];
    expect((await pool.query('select user_id,website_id,status,service_type,city from public.funnels where id=$1', [page.funnel_id])).rows[0]).toMatchObject({ user_id: owner, website_id: website, status: 'draft', service_type: 'Driveway Cleaning', city: 'Port Moody' });
    expect((await pool.query('select user_id,funnel_id,status from public.pages where id=$1', [page.page_id])).rows[0]).toMatchObject({ user_id: owner, funnel_id: page.funnel_id, status: 'draft' });
    expect((await pool.query('select page_id,type,content from public.page_sections where page_id=$1', [page.page_id])).rows[0]).toMatchObject({ page_id: page.page_id, type: 'hero', content: { heading: 'Driveway Cleaning in Port Moody' } });
    const installedDefinition = (await pool.query(`select pg_get_functiondef('public.create_local_seo_draft_batch(uuid,text[],text[],text)'::regprocedure) definition`)).rows[0].definition;
    expect(installedDefinition).toContain(`perform public.save_page_sections_document(v_page->>'id', v_sections, 1, 0);`);
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
    const persisted = await expectSingleGraph(website, first.data.pages[0]);
    expect(persisted.receipts[0]).toMatchObject({ user_id: owner, idempotency_key: key });
    expect(persisted.receipts[0].result.data.pages).toEqual(first.data.pages);
    await expect(callAs(owner, website, ['Roof'], ['City'], key)).rejects.toMatchObject({ code: 'PT409' }); expect(await counts()).toEqual(before);
  });

  it('serializes concurrent same-key same-payload calls into one authoritative graph and replay', async () => {
    const website = await site();
    const spec = { user: owner, website, services: ['Wash'], cities: ['City'], key: 'local-seo:concurrent-same' };
    const results = await raceCalls([spec, spec]);
    expect(failures(results)).toHaveLength(0);
    const created = successes(results).map(result => result.value);
    expect(created).toHaveLength(2);
    expect(created.map(result => result.data.replayed).sort()).toEqual([false, true]);
    expect(created[1].data.pages).toEqual(created[0].data.pages);
    const persisted = await expectSingleGraph(website, created[0].data.pages[0]);
    expect(persisted.receipts[0]).toMatchObject({ user_id: owner, idempotency_key: spec.key });
  });

  it('serializes concurrent same-key different-payload calls into one graph and one PT409', async () => {
    const website = await site(); const key = 'local-seo:concurrent-different';
    const specs = [
      { user: owner, website, services: ['Roof'], cities: ['City'], key },
      { user: owner, website, services: ['Siding'], cities: ['City'], key }
    ];
    const results = await raceCalls(specs);
    const winners = successes(results); const losers = failures(results);
    expect(winners).toHaveLength(1); expect(losers).toHaveLength(1);
    expect(losers[0].reason).toMatchObject({ code: 'PT409' });
    expect(losers[0].reason.code).not.toBe('40P01');
    const page = winners[0].value.data.pages[0];
    const persisted = await expectSingleGraph(website, page);
    expect(persisted.funnels[0]).toMatchObject({ service_type: page.service, city: page.city });
    expect(persisted.receipts[0]).toMatchObject({ user_id: owner, idempotency_key: key });
    expect(persisted.receipts[0].payload).toMatchObject({ website_id: website, services: [page.service], cities: [page.city] });
  });

  it('returns one PT409 and one complete graph for repeated concurrent same-route races', async () => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const website = await site();
      const cities = [`City ${iteration}`];
      const specs = [
        { user: owner, website, services: ['Roof & Gutter'], cities, key: `local-seo:route-race-${iteration}-one` },
        { user: owner, website, services: ['Roof Gutter'], cities, key: `local-seo:route-race-${iteration}-two` }
      ];
      const results = await raceCalls(specs);
      const winners = successes(results); const losers = failures(results);
      expect(winners).toHaveLength(1); expect(losers).toHaveLength(1);
      expect(losers[0].reason).toMatchObject({ code: 'PT409' });
      expect(losers[0].reason.code).not.toBe('40P01');
      const winnerIndex = results.findIndex(result => result.status === 'fulfilled');
      const page = winners[0].value.data.pages[0];
      const persisted = await expectSingleGraph(website, page);
      expect(persisted.receipts[0].idempotency_key).toBe(specs[winnerIndex].key);
      expect(persisted.receipts[0].result.data.pages).toEqual([page]);
      expect(persisted.receipts.some(receipt => receipt.idempotency_key === specs[1 - winnerIndex].key)).toBe(false);
    }
  });

  it('separates concurrent identical idempotency keys by authenticated user', async () => {
    const websiteA = await site(owner); const websiteB = await site(other); const key = 'local-seo:cross-user-same-key';
    const results = await raceCalls([
      { user: owner, website: websiteA, services: ['Wash A'], cities: ['City A'], key },
      { user: other, website: websiteB, services: ['Wash B'], cities: ['City B'], key }
    ]);
    expect(failures(results)).toHaveLength(0);
    const created = successes(results).map(result => result.value);
    expect(created).toHaveLength(2);
    expect(created.every(result => result.data.replayed === false)).toBe(true);
    const graphA = await expectSingleGraph(websiteA, created[0].data.pages[0]);
    const graphB = await expectSingleGraph(websiteB, created[1].data.pages[0]);
    expect(graphA.receipts[0]).toMatchObject({ user_id: owner, idempotency_key: key });
    expect(graphB.receipts[0]).toMatchObject({ user_id: other, idempotency_key: key });
    expect(graphA.funnels[0].id).not.toBe(graphB.funnels[0].id);
    expect(graphA.pages[0].id).not.toBe(graphB.pages[0].id);
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
