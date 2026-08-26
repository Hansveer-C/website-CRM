import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = process.env.LOCAL_SEO_BATCH_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const migration = readFileSync(resolve(__dirname, '../migrations/20260825000000_create_local_seo_draft_batch.sql'), 'utf8');
const inventoryMigration = readFileSync(resolve(__dirname, '../migrations/20260826000000_add_local_seo_inventory_provenance.sql'), 'utf8');

suite('Local SEO draft batch RPC', () => {
  let pool: pg.Pool; const owner = '11111111-1111-4111-8111-111111111111'; const other = '22222222-2222-4222-8222-222222222222';
  beforeAll(async () => { pool = new pg.Pool({ connectionString: url }); }); afterAll(async () => { await pool?.end(); });
  beforeEach(async () => {
    await pool.query('drop schema if exists private cascade; drop schema if exists public cascade; drop schema if exists auth cascade; create schema public; create schema auth; create schema private;');
    await pool.query(`do $$begin create role anon; exception when duplicate_object then null; end$$; do $$begin create role authenticated; exception when duplicate_object then null; end$$; create extension if not exists pgcrypto; create table public.users(id text primary key); create table public.websites(id uuid primary key, user_id text not null, name text, subdomain text); create table public.funnels(id text primary key,user_id text not null,website_id uuid,name text,status text,service_type text,city text,created_at timestamptz,updated_at timestamptz); create table public.pages(id text primary key,user_id text,funnel_id text,status text); create table public.website_routes(website_id uuid,path text,funnel_id text); create table public.builder_route_drafts(website_id uuid,path text,funnel_id text,action text); create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; create or replace function public.create_builder_page(text,text,text,text) returns jsonb language plpgsql as $$begin insert into public.pages values($4,(select auth.uid())::text,$3,'draft'); return jsonb_build_object('id',$4); end$$; create or replace function public.save_page_sections_document(text,jsonb,bigint,bigint) returns jsonb language sql as $$select '{}'::jsonb$$; create or replace function public.set_builder_route_draft(uuid,text,text,uuid,text,text) returns jsonb language plpgsql as $$begin insert into public.builder_route_drafts values($1,$3,$2,'upsert'); return '{}'::jsonb; end$$; insert into public.users values('${owner}'),('${other}');`);
    await pool.query(migration);
    await pool.query(inventoryMigration);
  });
  const setUser = (id: string) => pool.query(`set "request.jwt.claim.sub" = '${id}'`);
  const website = async (user = owner) => { const id = randomUUID(); await pool.query('insert into public.websites values($1,$2,$3,$4)', [id, user, 'Site', `site-${id}`]); return id; };
  it('creates one owned draft graph with no live route and replays a matching key', async () => { const id = await website(); await setUser(owner); const args = [id, ['Driveway Cleaning'], ['Port Moody'], 'local-seo:1234567890']; const first = (await pool.query('select public.create_local_seo_draft_batch($1,$2,$3,$4) result', args)).rows[0].result; const replay = (await pool.query('select public.create_local_seo_draft_batch($1,$2,$3,$4) result', args)).rows[0].result; expect(first.data.created_count).toBe(1); expect(replay.data.replayed).toBe(true); expect((await pool.query('select * from public.website_routes')).rows).toHaveLength(0); expect((await pool.query('select status from public.pages')).rows[0].status).toBe('draft'); });
  it('fails closed for foreign Websites and rolls back a collision', async () => { const foreign = await website(other); await setUser(owner); await expect(pool.query('select public.create_local_seo_draft_batch($1,$2,$3,$4)', [foreign, ['Wash'], ['City'], 'local-seo:1234567890'])).rejects.toThrow(/Website not found/); const id = await website(); await pool.query('insert into public.website_routes(website_id,path) values($1,$2)', [id, '/wash-city']); await setUser(owner); await expect(pool.query('select public.create_local_seo_draft_batch($1,$2,$3,$4)', [id, ['Wash'], ['City'], 'local-seo:abcdefghijklmno'])).rejects.toThrow(/already exists/); expect((await pool.query('select * from public.funnels')).rows).toHaveLength(0); });
  it('hydrates only the owned Website inventory from durable Local SEO provenance', async () => {
    const a = await website(); const b = await website(); await setUser(owner);
    await pool.query('select public.create_local_seo_draft_batch($1,$2,$3,$4)', [a, ['Roof & Gutter'], ['Port Moody'], 'local-seo:inventory-a']);
    await pool.query('select public.create_local_seo_draft_batch($1,$2,$3,$4)', [b, ['House Washing'], ['Burnaby'], 'local-seo:inventory-b']);
    const result = (await pool.query('select public.get_local_seo_inventory($1) result', [a])).rows[0].result;
    expect(result.data.website_id).toBe(a); expect(result.data.pages).toEqual([expect.objectContaining({ website_id: a, path: '/roof-gutter-port-moody', publication_state: 'draft' })]);
    await setUser(other); await expect(pool.query('select public.get_local_seo_inventory($1)', [a])).rejects.toThrow(/Website not found/);
  });
});
