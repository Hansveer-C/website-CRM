import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.PAGE_DUPLICATE_TEST_DATABASE_URL || process.env.PAGE_SECTION_RACE_DATABASE_URL;
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

describeDatabase('duplicate_builder_page RPC database tests', () => {
  beforeAll(async () => {
    const client = await connect();
    try {
      await client.query(duplicateMigration);
    } finally {
      await client.end();
    }
  });

  it('rejects unauthenticated calls with PT401', async () => {
    const client = await connect();
    try {
      await client.query('begin');
      await client.query('set local role anon');
      await expect(
        client.query('select public.duplicate_builder_page($1) as result', ['some-page'])
      ).rejects.toMatchObject({ code: 'PT401' });
      await client.query('rollback');
    } finally {
      await client.end();
    }
  });

  it('rejects cross-tenant duplication with PT404 without leaking existence', async () => {
    const client = await connect();
    try {
      await client.query('begin');
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userB]);
      await expect(
        client.query('select public.duplicate_builder_page($1) as result', ['page-owned-by-user-a'])
      ).rejects.toMatchObject({ code: 'PT404' });
      await client.query('rollback');
    } finally {
      await client.end();
    }
  });
});
