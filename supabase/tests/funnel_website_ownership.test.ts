import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.FUNNEL_WEBSITE_OWNERSHIP_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const migration = readFileSync(resolve(__dirname, '../migrations/20260822000000_establish_funnel_website_ownership.sql'), 'utf8');

describeDatabase('funnel Website ownership migration (PostgreSQL 17)', () => {
  let pool: pg.Pool;
  let websiteA: string;
  let websiteB: string;
  const owner = `owner-${randomUUID()}`;
  const otherOwner = `other-${randomUUID()}`;
  const routedFunnel = `routed-${randomUUID()}`;
  const unroutedFunnel = `unrouted-${randomUUID()}`;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    try {
      await client.query(`
        do $$ begin create role anon; exception when duplicate_object then null; end $$;
        do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
        create extension if not exists pgcrypto;
        create table if not exists public.users (id text primary key, email text);
        create table if not exists public.funnels (id text primary key, user_id text not null references public.users(id), name text not null, status text not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
        create table if not exists public.websites (id uuid primary key default gen_random_uuid(), user_id text not null references public.users(id), name text not null, subdomain text not null unique, homepage_funnel_id text, draft_homepage_funnel_id text, created_at timestamptz default now(), updated_at timestamptz default now());
        create table if not exists public.website_routes (id uuid primary key default gen_random_uuid(), website_id uuid not null references public.websites(id), path text not null, funnel_id text not null references public.funnels(id), created_at timestamptz default now(), unique(website_id, path));
        create table if not exists public.builder_route_drafts (id uuid primary key default gen_random_uuid(), website_id uuid not null references public.websites(id), route_id uuid, path text not null, funnel_id text not null references public.funnels(id), action text not null default 'upsert', created_at timestamptz default now(), updated_at timestamptz default now(), unique(website_id, funnel_id));
        create or replace function public.create_initial_website_graph(text,text,text,text[],text) returns jsonb language sql as $$ select '{"data":{"website":{"id":"00000000-0000-0000-0000-000000000000"},"funnel":{"id":"stub"}}}'::jsonb $$;
      `);
      await client.query('insert into public.users(id,email) values ($1,$2),($3,$4)', [owner, `${owner}@test`, otherOwner, `${otherOwner}@test`]);
      const a = await client.query(`insert into public.websites(user_id,name,subdomain) values ($1,'A',$2) returning id`, [owner, `a-${randomUUID()}`]);
      const b = await client.query(`insert into public.websites(user_id,name,subdomain) values ($1,'B',$2) returning id`, [owner, `b-${randomUUID()}`]);
      websiteA = a.rows[0].id; websiteB = b.rows[0].id;
      await client.query(`insert into public.funnels(id,user_id,name) values ($1,$2,'Routed'),($3,$2,'Unrouted')`, [routedFunnel, owner, unroutedFunnel]);
      await client.query(`insert into public.website_routes(website_id,path,funnel_id) values ($1,'/routed',$2)`, [websiteA, routedFunnel]);
      await client.query(migration);
    } finally { client.release(); }
  });

  afterAll(async () => { await pool?.end(); });

  it('backfills a deterministic route association and leaves marketing funnels NULL', async () => {
    const rows = await pool.query('select id, website_id from public.funnels where id = any($1::text[]) order by id', [[routedFunnel, unroutedFunnel]]);
    expect(rows.rows.find(row => row.id === routedFunnel)?.website_id).toBe(websiteA);
    expect(rows.rows.find(row => row.id === unroutedFunnel)?.website_id).toBeNull();
  });

  it('permits a same-Website unrouted funnel and rejects same-tenant cross-Website and cross-tenant routes', async () => {
    const local = await pool.connect();
    const ownedUnrouted = `owned-${randomUUID()}`;
    const foreign = `foreign-${randomUUID()}`;
    try {
      await local.query('insert into public.funnels(id,user_id,website_id,name) values ($1,$2,$3,$4),($5,$6,$3,$7)', [ownedUnrouted, owner, websiteA, 'Owned', foreign, otherOwner, 'Foreign']);
      await local.query('insert into public.website_routes(website_id,path,funnel_id) values ($1,$2,$3)', [websiteA, `/owned-${randomUUID()}`, ownedUnrouted]);
      await expect(local.query('insert into public.website_routes(website_id,path,funnel_id) values ($1,$2,$3)', [websiteB, `/wrong-${randomUUID()}`, ownedUnrouted])).rejects.toThrow();
      await expect(local.query('insert into public.website_routes(website_id,path,funnel_id) values ($1,$2,$3)', [websiteA, `/foreign-${randomUUID()}`, foreign])).rejects.toThrow();
    } finally { local.release(); }
  });
});
