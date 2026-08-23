import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.FUNNEL_WEBSITE_OWNERSHIP_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const migration = readFileSync(resolve(__dirname, '../migrations/20260822000000_establish_funnel_website_ownership.sql'), 'utf8');
const owner = 'owner';
const otherOwner = 'other-owner';

describeDatabase('funnel Website ownership migration (PostgreSQL 17)', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    await pool.query(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;`);
  });

  afterAll(async () => { await pool?.end(); });

  beforeEach(async () => {
    await pool.query('drop schema if exists private cascade; drop schema if exists public cascade; create schema public;');
    await pool.query(`
      create table public.users (id text primary key, email text not null);
      create table public.funnels (id text primary key, user_id text not null references public.users(id), name text not null, status text not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
      create table public.websites (id uuid primary key, user_id text not null references public.users(id), name text not null, subdomain text not null unique, homepage_funnel_id text, draft_homepage_funnel_id text, created_at timestamptz default now(), updated_at timestamptz default now());
      create table public.website_routes (id uuid primary key, website_id uuid not null references public.websites(id), path text not null, funnel_id text not null references public.funnels(id), created_at timestamptz default now(), unique(website_id, path));
      create table public.builder_route_drafts (id uuid primary key, website_id uuid not null references public.websites(id), route_id uuid, path text not null, funnel_id text not null references public.funnels(id), action text not null default 'upsert', created_at timestamptz default now(), updated_at timestamptz default now(), unique(website_id, funnel_id));
      create or replace function public.create_initial_website_graph(text,text,text,text[],text) returns jsonb language plpgsql as $$
      declare v_website_id uuid := '00000000-0000-0000-0000-000000000001'; v_funnel_id text := 'bootstrap-funnel';
      begin
        insert into public.users(id,email) values ('bootstrap-owner','bootstrap@example.test') on conflict do nothing;
        insert into public.funnels(id,user_id,name) values (v_funnel_id,'bootstrap-owner','Bootstrap') on conflict do nothing;
        insert into public.websites(id,user_id,name,subdomain,homepage_funnel_id) values (v_website_id,'bootstrap-owner','Bootstrap','bootstrap',v_funnel_id) on conflict do nothing;
        insert into public.website_routes(id,website_id,path,funnel_id) values ('00000000-0000-0000-0000-000000000002',v_website_id,'/',v_funnel_id) on conflict do nothing;
        return jsonb_build_object('data', jsonb_build_object('website', jsonb_build_object('id', v_website_id), 'funnel', jsonb_build_object('id', v_funnel_id)));
      end $$;
    `);
    await pool.query('insert into public.users(id,email) values ($1,$2),($3,$4)', [owner, 'owner@example.test', otherOwner, 'other@example.test']);
  });

  async function website(userId = owner) {
    const id = randomUUID();
    await pool.query('insert into public.websites(id,user_id,name,subdomain) values ($1,$2,$3,$4)', [id, userId, `Website ${id}`, `site-${id}`]);
    return id;
  }

  async function funnel(userId = owner, websiteId: string | null = null) {
    const id = `funnel-${randomUUID()}`;
    if (websiteId) {
      await pool.query('insert into public.funnels(id,user_id,website_id,name) values ($1,$2,$3,$4)', [id, userId, websiteId, `Funnel ${id}`]);
    } else {
      await pool.query('insert into public.funnels(id,user_id,name) values ($1,$2,$3)', [id, userId, `Funnel ${id}`]);
    }
    return id;
  }

  async function route(websiteId: string, funnelId: string) {
    await pool.query('insert into public.website_routes(id,website_id,path,funnel_id) values ($1,$2,$3,$4)', [randomUUID(), websiteId, `/${randomUUID()}`, funnelId]);
  }

  async function migrate() { await pool.query(migration); }

  it('backfills route, homepage-only, draft-homepage-only, and repeated same-Website associations', async () => {
    const a = await website();
    const routed = await funnel(); await route(a, routed);
    const homepageWebsite = await website();
    const homepage = await funnel(); await pool.query('update public.websites set homepage_funnel_id = $1 where id = $2', [homepage, homepageWebsite]);
    const draftWebsite = await website();
    const draft = await funnel(); await pool.query('update public.websites set draft_homepage_funnel_id = $1 where id = $2', [draft, draftWebsite]);
    const repeated = await funnel(); await route(a, repeated); await pool.query('update public.websites set homepage_funnel_id = $1 where id = $2', [repeated, a]);
    await migrate();
    const rows = await pool.query('select id, website_id from public.funnels where id = any($1::text[])', [[routed, homepage, draft, repeated]]);
    expect(Object.fromEntries(rows.rows.map(row => [row.id, row.website_id]))).toEqual({ [routed]: a, [homepage]: homepageWebsite, [draft]: draftWebsite, [repeated]: a });
  });

  it('fails migration rather than selecting an arbitrary Website for an ambiguous Funnel', async () => {
    const a = await website(); const b = await website(); const ambiguous = await funnel();
    await route(a, ambiguous); await route(b, ambiguous);
    await expect(migrate()).rejects.toThrow(/cannot backfill/);
  });

  it('fails migration for a tenant-mismatched legacy reference', async () => {
    const a = await website(); const foreign = await funnel(otherOwner); await route(a, foreign);
    await expect(migrate()).rejects.toThrow(/cannot backfill/);
  });

  it('fails migration for a missing legacy homepage Funnel reference', async () => {
    const a = await website(); await pool.query('update public.websites set homepage_funnel_id = $1 where id = $2', ['missing-funnel', a]);
    await expect(migrate()).rejects.toThrow(/cannot backfill/);
  });

  it('leaves unassociated marketing Funnels NULL and permits an unrouted canonical Website Funnel', async () => {
    const a = await website(); const marketing = await funnel();
    await migrate();
    expect((await pool.query('select website_id from public.funnels where id = $1', [marketing])).rows[0].website_id).toBeNull();
    const owned = await funnel(owner, a);
    expect((await pool.query('select website_id from public.funnels where id = $1', [owned])).rows[0].website_id).toBe(a);
  });

  it('enforces the composite Website FK and permits a canonical Funnel to receive its first same-Website route', async () => {
    const a = await website(); await migrate();
    await expect(pool.query('insert into public.funnels(id,user_id,website_id,name) values ($1,$2,$3,$4)', [`funnel-${randomUUID()}`, owner, randomUUID(), 'Bad FK'])).rejects.toThrow();
    const otherSite = await website(otherOwner);
    await expect(pool.query('insert into public.funnels(id,user_id,website_id,name) values ($1,$2,$3,$4)', [`funnel-${randomUUID()}`, owner, otherSite, 'Tenant mismatch'])).rejects.toThrow();
    const owned = await funnel(owner, a); await expect(route(a, owned)).resolves.toBeUndefined();
  });

  it('rejects same-tenant cross-Website routes and cross-tenant routes', async () => {
    const a = await website(); const b = await website(); const foreignWebsite = await website(otherOwner); await migrate();
    const ownedA = await funnel(owner, a); await expect(route(b, ownedA)).rejects.toThrow(/Funnel must belong/);
    const foreign = await funnel(otherOwner, foreignWebsite); await expect(route(a, foreign)).rejects.toThrow(/Funnel must belong/);
  });

  it('enforces homepage, draft homepage, and builder route-draft ownership invariants', async () => {
    const a = await website(); const b = await website(); await migrate();
    const ownedA = await funnel(owner, a);
    await expect(pool.query('update public.websites set homepage_funnel_id = $1 where id = $2', [ownedA, b])).rejects.toThrow(/Funnel must belong/);
    await expect(pool.query('update public.websites set draft_homepage_funnel_id = $1 where id = $2', [ownedA, b])).rejects.toThrow(/Funnel must belong/);
    await expect(pool.query('insert into public.builder_route_drafts(id,website_id,path,funnel_id) values ($1,$2,$3,$4)', [randomUUID(), b, '/draft', ownedA])).rejects.toThrow(/Funnel must belong/);
  });

  it('prevents Funnel ownership mutations from invalidating existing route, homepage, draft, and route-draft references', async () => {
    const a = await website(); const b = await website(); const otherSite = await website(otherOwner); await migrate();
    const routeFunnel = await funnel(owner, a); await route(a, routeFunnel);
    const homepageFunnel = await funnel(owner, a); await pool.query('update public.websites set homepage_funnel_id = $1 where id = $2', [homepageFunnel, a]);
    const draftFunnel = await funnel(owner, a); await pool.query('update public.websites set draft_homepage_funnel_id = $1 where id = $2', [draftFunnel, a]);
    const draftRouteFunnel = await funnel(owner, a); await pool.query('insert into public.builder_route_drafts(id,website_id,path,funnel_id) values ($1,$2,$3,$4)', [randomUUID(), a, '/draft', draftRouteFunnel]);
    await expect(pool.query('update public.funnels set website_id = $1 where id = $2', [b, routeFunnel])).rejects.toThrow(/Funnel must belong/);
    await expect(pool.query('update public.funnels set website_id = null where id = $1', [routeFunnel])).rejects.toThrow(/Funnel must belong/);
    await expect(pool.query('update public.funnels set website_id = $1 where id = $2', [b, homepageFunnel])).rejects.toThrow(/Funnel must belong/);
    await expect(pool.query('update public.funnels set website_id = $1 where id = $2', [b, draftFunnel])).rejects.toThrow(/Funnel must belong/);
    await expect(pool.query('update public.funnels set website_id = $1 where id = $2', [b, draftRouteFunnel])).rejects.toThrow(/Funnel must belong/);
    await expect(pool.query('update public.funnels set user_id = $1, website_id = $2 where id = $3', [otherOwner, otherSite, routeFunnel])).rejects.toThrow(/Funnel must belong/);
  });

  it('wraps bootstrap creation, assigns canonical ownership, and preserves the intended execute contract', async () => {
    await migrate();
    const result = await pool.query(`select public.create_initial_website_graph('Business','555','City',array['wash'],'key') as graph`);
    const graph = result.rows[0].graph; const websiteId = graph.data.website.id; const funnelId = graph.data.funnel.id;
    expect((await pool.query('select website_id from public.funnels where id = $1', [funnelId])).rows[0].website_id).toBe(websiteId);
    expect((await pool.query('select homepage_funnel_id from public.websites where id = $1', [websiteId])).rows[0].homepage_funnel_id).toBe(funnelId);
    const privilege = await pool.query(`select has_function_privilege('anon', 'public.create_initial_website_graph(text,text,text,text[],text)', 'execute') as anon, has_function_privilege('authenticated', 'public.create_initial_website_graph(text,text,text,text[],text)', 'execute') as authenticated, has_function_privilege('anon', 'public.create_initial_website_graph_legacy(text,text,text,text[],text)', 'execute') as legacy_anon`);
    expect(privilege.rows[0]).toMatchObject({ anon: false, authenticated: true, legacy_anon: false });
  });
});
