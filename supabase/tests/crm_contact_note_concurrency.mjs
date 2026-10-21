import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

if(process.env.WASHOPS_NOTE_SQL_QA!=='true')throw Error('Explicit disposable local SQL opt-in required');
const url=new URL(process.env.WASHOPS_NOTE_LOCAL_DATABASE_URL ?? 'invalid:');
if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||url.port!=='56422'||url.pathname!=='/postgres'||url.search||url.hash)
  throw Error('Refusing non-owned-loopback database');
const clients=new Set(),owner=randomUUID(),prefix=`note-race-${randomUUID()}`;
async function connection(){const c=new Client({connectionString:url.href});await c.connect();clients.add(c);await c.query("set statement_timeout='8000ms'");return c;}
const admin=await connection();
async function actor(){const c=await connection();await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);return c;}
const call=(c,key,contact,text='Synthetic note')=>c.query('select public.create_crm_contact_note($1,$2,$3) as result',[key,contact,text]);
const outcome=promise=>promise.then(value=>({value}),error=>({error}));
async function contact(suffix){const id=`${prefix}-${suffix}`;await admin.query('insert into public.contacts(id,user_id,name) values($1,$2,$3)',[id,owner,'Synthetic race only']);return id;}
async function waitBlocked(client){
  for(let i=0;i<100;i++){
    const r=await admin.query('select wait_event_type from pg_stat_activity where pid=$1',[client.processID]);
    if(r.rows[0]?.wait_event_type==='Lock')return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('Expected real concurrent lock wait was not observed');
}
try {
  await admin.query('insert into public.users(id,email,password_hash) values($1,$2,$3)',[owner,`${prefix}@example.test`,'synthetic']);
  for(const changed of [false,true]){
    const id=await contact(changed?'conflict':'replay'),key=randomUUID(),first=await actor(),second=await actor();
    const created=(await call(first,key,id)).rows[0].result;
    const pending=outcome(call(second,key,id,changed?'Changed payload':'Synthetic note'));
    await waitBlocked(second);await first.query('commit');const result=await pending;
    if(changed){assert.equal(result.error?.code,'23505');await second.query('rollback');}
    else {assert.equal(result.value.rows[0].result.replayed,true);assert.equal(result.value.rows[0].result.activity.id,created.activity.id);await second.query('commit');}
    assert.equal((await admin.query('select count(*)::int as n from public.activities where contact_id=$1',[id])).rows[0].n,1);
  }
  {
    const id=await contact('delete-first'),key=randomUUID(),deletion=await connection(),note=await actor();
    await deletion.query('begin');await deletion.query('delete from public.contacts where id=$1',[id]);
    const pending=outcome(call(note,key,id));await waitBlocked(note);await deletion.query('commit');
    assert.equal((await pending).error?.code,'42501');await note.query('rollback');
    assert.equal((await admin.query('select count(*)::int as n from private.crm_contact_note_requests where user_id=$1 and request_key=$2',[owner,key])).rows[0].n,0);
  }
  {
    const id=await contact('note-first'),key=randomUUID(),note=await actor(),deletion=await connection();
    await call(note,key,id);await deletion.query('begin');const pending=outcome(deletion.query('delete from public.contacts where id=$1',[id]));
    await waitBlocked(deletion);await note.query('commit');assert.ok((await pending).value);await deletion.query('commit');
    assert.equal((await admin.query('select count(*)::int as n from public.activities where contact_id=$1',[id])).rows[0].n,0);
    const retry=await actor();assert.equal((await outcome(call(retry,key,id))).error?.code,'42501');await retry.query('rollback');
    // Even reusing a deleted contact ID cannot resurrect the old note request.
    await admin.query('insert into public.contacts(id,user_id,name) values($1,$2,$3)',[id,owner,'Synthetic recreated contact']);
    const recreated=await actor();assert.equal((await outcome(call(recreated,key,id))).error?.code,'40001');await recreated.query('rollback');
  }
  {
    const id=await contact('activity-delete'),key=randomUUID(),creator=await actor();
    const activity=(await call(creator,key,id)).rows[0].result.activity;await creator.query('commit');
    const replay=await actor(),deletion=await connection();assert.equal((await call(replay,key,id)).rows[0].result.replayed,true);
    await deletion.query('begin');const pending=outcome(deletion.query('delete from public.activities where id=$1',[activity.id]));
    await waitBlocked(deletion);await replay.query('commit');assert.ok((await pending).value);await deletion.query('commit');
    const after=await actor();assert.equal((await outcome(call(after,key,id))).error?.code,'40001');await after.query('rollback');
  }
  console.log('PASS five observed SQL lock races: identical replay, payload conflict, contact delete-first, note-first/contact deletion, activity deletion after locked replay.');
} finally {
  for(const client of clients) {if(client!==admin)await client.query('rollback').catch(()=>{});}
  await admin.query('delete from public.users where id=$1',[owner]);
  for(const client of clients)await client.end();
}
