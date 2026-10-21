// Run only against a named, disposable, network-isolated local Docker database.
// No host database URL, production credential or provider is read.
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const container = process.argv[2];
assert(process.argv.includes('--local-only'), '--local-only acknowledgement is required');
assert(/^washops-[a-z0-9-]+$/.test(container ?? ''), 'a named disposable washops container is required');
const host = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .HostConfig}}', container], { encoding: 'utf8' }));
assert.equal(host.NetworkMode, 'none', 'database must be isolated from networks');
assert(!host.PortBindings || Object.keys(host.PortBindings).length === 0, 'published database ports are forbidden');

function query(sql, application = 'washops-location-check') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-e', `PGAPPNAME=${application}`, container,
      'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atc', sql]);
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
async function must(sql) {
  const result = await query(sql);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}
async function observe(application, condition) {
  const until = Date.now() + 4000;
  do {
    const count = await must(`select count(*) from pg_stat_activity where application_name='${application}' and ${condition}`);
    if (count === '1') return;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < until);
  throw new Error(`did not observe required database wait for ${application}`);
}

const owner = randomUUID(), contact = `location-race-${randomUUID()}`;
const propertyA = randomUUID(), propertyB = randomUUID();
const quotes = Array.from({ length: 4 }, () => randomUUID());
const auth = `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`;
const assign = (quote, property, key) => `select public.set_crm_quote_service_property('${quote}',1,'${property}','${key}')`;
const accept = (quote, key) => `select public.accept_crm_quote('${quote}',1,'${key}','Local Concurrent Signer',null,true)`;
const outputs = result => result.stdout.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line));

async function pair(label, firstSql, secondSql) {
  const firstName = `wo-location-first-${randomUUID()}`;
  const secondName = `wo-location-second-${randomUUID()}`;
  const first = query(`${auth} begin; ${firstSql}; select pg_sleep(2); commit;`, firstName);
  let second;
  try {
    await observe(firstName, "wait_event='PgSleep'");
    second = query(`${auth} begin; ${secondSql}; commit;`, secondName);
    await observe(secondName, "wait_event_type='Lock'");
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.code, 0, `${label}: first operation failed: ${a.stderr}`);
    return [a, b];
  } finally {
    await Promise.allSettled([first, ...(second ? [second] : [])]);
  }
}

try {
  await must(`insert into public.users(id,email,password_hash) values('${owner}','${owner}@example.test','synthetic');
    insert into public.contacts(id,user_id,name,address) values('${contact}','${owner}','Local race fixture','Billing only');
    insert into public.properties(id,user_id,contact_id,service_address_line1,locality,country_code,request_key,request_fingerprint) values
      ('${propertyA}','${owner}','${contact}','Frozen race location','Springfield','US','${randomUUID()}','{}'),
      ('${propertyB}','${owner}','${contact}','Alternative race location','Springfield','US','${randomUUID()}','{}');
    ${quotes.map((q, i) => `insert into public.quotes(id,user_id,contact_id,request_key,request_fingerprint,status,total_amount,selected_tier,property_id)
      values('${q}','${owner}','${contact}','${randomUUID()}','race','sent',75,'premium',${i === 3 ? `'${propertyA}'` : 'null'});
      insert into public.quote_items(user_id,quote_id,service_name,quantity,unit_price,tier,order_index) values
      ('${owner}','${q}','Basic option',1,20,'basic',0),('${owner}','${q}','Premium option',1,75,'premium',1);`).join('\n')}`);

  const sameKey = randomUUID();
  const [created, replay] = await pair('same-key assignment', assign(quotes[0], propertyA, sameKey), assign(quotes[0], propertyA, sameKey));
  assert.equal(replay.code, 0, replay.stderr);
  assert.equal(outputs(created)[0].replayed, false);
  assert.equal(outputs(replay)[0].replayed, true);
  assert.equal(await must(`select revision from public.quotes where id='${quotes[0]}'`), '2');
  assert.equal(await must(`select count(*) from public.quote_property_assignment_requests where quote_id='${quotes[0]}'`), '1');
  console.log('PASS same-key concurrent assignment: observed lock wait, one mutation/one replay');

  const [, competing] = await pair('competing assignments', assign(quotes[1], propertyA, randomUUID()), assign(quotes[1], propertyB, randomUUID()));
  assert.notEqual(competing.code, 0);
  assert.match(competing.stderr, /40001.*quote revision conflict/);
  assert.equal(await must(`select property_id from public.quotes where id='${quotes[1]}'`), propertyA);
  assert.equal(await must(`select count(*) from public.quote_property_assignment_requests where quote_id='${quotes[1]}'`), '1');
  console.log('PASS competing assignments: observed lock wait, stale loser rejected without ledger row');

  const [, staleAcceptance] = await pair('association wins', assign(quotes[2], propertyA, randomUUID()), accept(quotes[2], randomUUID()));
  assert.notEqual(staleAcceptance.code, 0);
  assert.match(staleAcceptance.stderr, /40001.*quote revision conflict/);
  assert.equal(await must(`select count(*) from public.quote_acceptances where quote_id='${quotes[2]}'`), '0');
  assert.equal(await must(`select status||':'||revision from public.quotes where id='${quotes[2]}'`), 'sent:2');
  console.log('PASS association-before-acceptance: stale signing rejected, no acceptance created');

  const [, staleAssignment] = await pair('acceptance wins', accept(quotes[3], randomUUID()), assign(quotes[3], propertyB, randomUUID()));
  assert.notEqual(staleAssignment.code, 0);
  assert.match(staleAssignment.stderr, /40001.*quote revision conflict/);
  assert.equal(await must(`select quote_snapshot->'service_location'->>'property_id' from public.quote_acceptances where quote_id='${quotes[3]}'`), propertyA);
  assert.equal(await must(`select revision from public.quotes where id='${quotes[3]}'`), '2');
  assert.equal(await must(`select count(*) from public.quote_property_assignment_requests where quote_id='${quotes[3]}'`), '0');
  console.log('PASS acceptance-before-association: frozen original location retained, stale assignment rejected');
} finally {
  await must(`delete from public.quote_acceptances where user_id='${owner}';
    delete from public.quotes where user_id='${owner}'; delete from public.properties where user_id='${owner}';
    delete from public.contacts where user_id='${owner}'; delete from public.users where id='${owner}';`);
}
