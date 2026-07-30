import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8')) as { routes: Array<Record<string, string>> };
const migration = readFileSync(new URL('supabase/migrations/20260730210000_create_initial_website_graph.sql', root), 'utf8');
const main = readFileSync(new URL('src/main.ts', root), 'utf8');

function resolveConfiguredPath(path: string, files: Set<string>): string {
  if (files.has(path)) return path;
  if (/^\/api(?:\/.*)?$/.test(path)) return '/api/not-found';
  return '/index.html';
}

describe('Phase 0 deployment boundaries', () => {
  it('checks the Vercel filesystem before the SPA fallback', () => expect(vercel.routes[0]).toEqual({ handle: 'filesystem' }));
  it('keeps unknown API paths out of index.html', () => expect(vercel.routes[1]).toMatchObject({ src: expect.stringContaining('/api'), dest: '/api/not-found' }));
  it('keeps a final SPA fallback', () => expect(vercel.routes.at(-1)?.dest).toBe('/index.html'));
  it('serves built static assets through the filesystem phase', () => expect(resolveConfiguredPath('/assets/app.js', new Set(['/assets/app.js']))).toBe('/assets/app.js'));
  it('falls normal CRM navigation back to the SPA', () => expect(resolveConfiguredPath('/clients/123', new Set())).toBe('/index.html'));
  it('keeps customer public-site navigation on the SPA renderer', () => expect(resolveConfiguredPath('/site/acme', new Set())).toBe('/index.html'));
  it('routes unknown APIs to the JSON not-found function', () => expect(resolveConfiguredPath('/api/unknown', new Set())).toBe('/api/not-found'));
  it('installs browser interception only behind the fixture flag', () => expect(main).toContain('if (browserFixturesEnabled) window.fetch = browserFixtureFetch'));
  it('makes fixture mode impossible in production', () => expect(main).toContain('!builderPublicationProduction'));
  it('uses a security-definer function with an empty search path', () => expect(migration).toMatch(/security definer\s+set search_path = ''/i));
  it('locks per user inside the transaction', () => expect(migration).toContain('pg_advisory_xact_lock'));
  it('stores durable idempotency receipts privately', () => expect(migration).toContain('private.website_creation_receipts'));
  it('revokes anonymous RPC execution', () => expect(migration).toMatch(/revoke all on function[\s\S]+from public, anon/i));
  it('grants RPC execution only to authenticated', () => expect(migration).toMatch(/grant execute on function[\s\S]+to authenticated/i));
  it('creates the minimum graph in one function', () => {
    for (const table of ['funnels', 'pages', 'websites', 'website_routes', 'website_settings', 'page_sections']) expect(migration).toContain(`insert into public.${table}`);
  });
});
