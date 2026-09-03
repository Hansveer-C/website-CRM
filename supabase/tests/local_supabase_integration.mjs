import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const CONFIG_PATH = resolve('supabase/config.toml');
const LINK_MARKERS = [resolve('supabase/.temp/project-ref'), resolve('supabase/.temp/linked-project.json')];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertLocalGuard() {
  const activeConfig = readFileSync(CONFIG_PATH, 'utf8').split(/\r?\n/).map((line) => line.replace(/#.*$/, '')).join('\n');
  assert(/^project_id\s*=\s*"washops-crm-local"\s*$/m.test(activeConfig), 'local project_id must be washops-crm-local');
  assert(!/sb_secret_|service_role_key|supabase\.co/i.test(activeConfig), 'local config contains a hosted credential or URL');
  for (const marker of LINK_MARKERS) assert(!existsSync(marker), `refusing linked Supabase marker: ${marker}`);
}

function readStatus() {
  assertLocalGuard();
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['--yes', 'supabase@2.116.0', 'status', '-o', 'json'], { encoding: 'utf8' });
  assert(result.status === 0, `local Supabase status failed: ${result.stderr.trim()}`);
  const start = result.stdout.indexOf('{');
  const end = result.stdout.lastIndexOf('}');
  assert(start >= 0 && end > start, 'local Supabase status did not return JSON');
  return JSON.parse(result.stdout.slice(start, end + 1));
}

function localUrl(value, label) {
  assert(value, `${label} is missing`);
  const parsed = new URL(value);
  assert(['127.0.0.1', 'localhost'].includes(parsed.hostname), `${label} must target localhost`);
  return value;
}

async function request(url, key, token, init = {}) {
  return fetch(url, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
}

async function json(response) {
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function run() {
  if (process.argv.includes('--guard-local')) {
    assertLocalGuard();
    console.log('local Supabase guard: pass');
    return;
  }
  const status = readStatus();
  const api = localUrl(status.API_URL, 'API_URL');
  localUrl(status.DB_URL, 'DB_URL');
  const publicKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const serviceKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
  assert(publicKey && serviceKey, 'local runtime credentials are missing');

  const suffix = randomUUID();
  const password = `Local-${randomUUID()}-9a!`;
  const emails = [`infra-a-${suffix}@example.test`, `infra-b-${suffix}@example.test`];
  const users = [];
  const contacts = [`infra-contact-a-${suffix}`, `infra-contact-b-${suffix}`];
  const objectPath = `tenant-a-${suffix}/invoice-${suffix}.pdf`;
  const payload = Buffer.from('%PDF-1.4\n% WashOps local smoke\n%%EOF\n');
  let objectCreated = false;

  try {
    for (const email of emails) {
      const response = await request(`${api}/auth/v1/admin/users`, serviceKey, serviceKey, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const data = await json(response);
      assert(response.ok && data?.id, `Auth fixture creation failed (${response.status})`);
      users.push(data.id);
    }
    const profiles = await request(`${api}/rest/v1/users?select=id&id=in.(${users.join(',')})`, serviceKey, serviceKey);
    assert(profiles.ok && (await json(profiles)).length === 2, 'Auth profiles were not provisioned');

    const tokens = [];
    for (const email of emails) {
      const response = await request(`${api}/auth/v1/token?grant_type=password`, publicKey, publicKey, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const data = await json(response);
      assert(response.ok && data?.access_token, `Auth sign-in failed (${response.status})`);
      tokens.push(data.access_token);
    }

    const fixture = await request(`${api}/rest/v1/contacts`, serviceKey, serviceKey, {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify([{ id: contacts[0], user_id: users[0], name: 'Infra tenant A' }, { id: contacts[1], user_id: users[1], name: 'Infra tenant B' }]),
    });
    assert(fixture.ok, `contact fixture creation failed (${fixture.status})`);
    const filter = `id=in.(${contacts.join(',')})`;
    const aRead = await request(`${api}/rest/v1/contacts?select=id,user_id&${filter}`, publicKey, tokens[0]);
    const bRead = await request(`${api}/rest/v1/contacts?select=id,user_id&${filter}`, publicKey, tokens[1]);
    const anonRead = await request(`${api}/rest/v1/contacts?select=id,user_id&${filter}`, publicKey, publicKey);
    assert(aRead.ok && (await json(aRead)).map((row) => row.id).join() === contacts[0], 'tenant A RLS isolation failed');
    assert(bRead.ok && (await json(bRead)).map((row) => row.id).join() === contacts[1], 'tenant B RLS isolation failed');
    assert(!anonRead.ok || (await json(anonRead)).length === 0, 'anonymous contact access was not denied');

    const commercial = await request(`${api}/storage/v1/bucket/commercial-documents`, serviceKey, serviceKey);
    const commercialData = await json(commercial);
    assert(commercial.ok && commercialData?.public === false, 'commercial-documents must exist and be private');

    const anonUpload = await request(`${api}/storage/v1/object/commercial-documents/anonymous-${suffix}.pdf`, publicKey, publicKey, { method: 'POST', headers: { 'content-type': 'application/pdf', 'x-upsert': 'false' }, body: payload });
    assert(!anonUpload.ok, 'anonymous commercial-document upload was not denied');
    const authUpload = await request(`${api}/storage/v1/object/commercial-documents/tenant-${suffix}.pdf`, publicKey, tokens[0], { method: 'POST', headers: { 'content-type': 'application/pdf', 'x-upsert': 'false' }, body: payload });
    assert(!authUpload.ok, 'authenticated commercial-document upload was not denied');
    const serverUpload = await request(`${api}/storage/v1/object/commercial-documents/${objectPath}`, serviceKey, serviceKey, { method: 'POST', headers: { 'content-type': 'application/pdf', 'x-upsert': 'false' }, body: payload });
    assert(serverUpload.ok, `server upload failed (${serverUpload.status})`);
    objectCreated = true;

    const crossTenant = await request(`${api}/storage/v1/object/authenticated/commercial-documents/${objectPath}`, publicKey, tokens[1]);
    assert(!crossTenant.ok, 'cross-tenant document read was not denied');
    const publicRead = await fetch(`${api}/storage/v1/object/public/commercial-documents/${objectPath}`);
    assert(!publicRead.ok, 'public URL exposed a private commercial document');
    const serverRead = await request(`${api}/storage/v1/object/authenticated/commercial-documents/${objectPath}`, serviceKey, serviceKey);
    assert(serverRead.ok && Buffer.compare(Buffer.from(await serverRead.arrayBuffer()), payload) === 0, 'server document read failed');

    const media = await request(`${api}/storage/v1/bucket/media`, serviceKey, serviceKey);
    const mediaData = await json(media);
    assert(media.ok && mediaData?.public === true, 'media bucket public state changed');
    assert(mediaData.file_size_limit === 8_388_608, 'media size limit changed');
    assert([...mediaData.allowed_mime_types].sort().join() === ['image/jpeg', 'image/png', 'image/webp'].sort().join(), 'media MIME restrictions changed');

    const cleanup = await request(`${api}/storage/v1/object/commercial-documents`, serviceKey, serviceKey, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [objectPath] }) });
    assert(cleanup.ok, `server Storage cleanup failed (${cleanup.status})`);
    objectCreated = false;
    console.log('local Auth fixtures: pass');
    console.log('database RLS isolation: pass');
    console.log('commercial-document Storage boundaries: pass');
    console.log('media bucket regression: pass');
  } finally {
    if (objectCreated) await request(`${api}/storage/v1/object/commercial-documents`, serviceKey, serviceKey, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [objectPath] }) });
    await request(`${api}/rest/v1/contacts?id=in.(${contacts.join(',')})`, serviceKey, serviceKey, { method: 'DELETE' });
    for (const id of users) await request(`${api}/auth/v1/admin/users/${id}`, serviceKey, serviceKey, { method: 'DELETE' });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
