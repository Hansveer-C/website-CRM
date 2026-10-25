import {Client} from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';

if(process.env.WASHOPS_REVIEW_SQL_QA!=='true')throw Error('Explicit disposable local review opt-in required');
const url=new URL(process.env.WASHOPS_REVIEW_LOCAL_DATABASE_URL??'invalid:');
if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||url.port!=='56422'||url.pathname!=='/postgres'||url.search||url.hash)
  throw Error('Refusing non-owned-loopback database');
const clients=new Set(),owner=randomUUID(),other=randomUUID(),prefix=`review-${randomUUID()}`;
async function connect(){const c=new Client({connectionString:url.href});await c.connect();clients.add(c);await c.query("set statement_timeout='10000ms'");return c;}
const admin=await connect();let assertions=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);assertions++;};
async function as(actor,sql,args=[]){const c=await connect();try{await c.query('begin');await c.query(`set local role ${actor?'authenticated':'anon'}`);if(actor)await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const r=await c.query(sql,args);await c.query('commit');return r.rows[0]?.result;}finally{await c.query('rollback');await c.end();clients.delete(c);}}
async function denied(fn,code){await assert.rejects(fn,error=>error.code===code);assertions++;}
const read=t=>as(null,'select public.read_crm_quote_review($1) result',[t]);
const respond=(t,k=randomUUID(),tier='basic',name='Synthetic Recipient')=>as(null,'select public.respond_crm_quote_review($1,$2,$3,$4,true) result',[t,k,tier,name]);
const record=(id,k=randomUUID(),actor=owner)=>as(actor,'select public.record_crm_quote_review_acceptance($1,$2) result',[id,k]);
async function quote(){const id=randomUUID();await admin.query("insert into public.quotes(id,user_id,contact_id,status,total_amount,selected_tier,notes,request_key,request_fingerprint) values($1,$2,$3,'draft',90,'basic','PRIVATE INTERNAL DO NOT EXPOSE',$4,'synthetic')",[id,owner,prefix,randomUUID()]);await admin.query("insert into public.quote_items(user_id,quote_id,service_name,description,quantity,unit_price,tier,order_index) values($1,$2,'Synthetic wash','Customer scope',1,90,'basic',0),($1,$2,'Synthetic premium','Premium scope',2,75,'premium',1)",[owner,id]);return id;}
async function issue(q=undefined){q??=await quote();const token=randomBytes(32).toString('hex'),key=randomUUID();const args=[q,1,key,token,'Explicit customer text'];const result=await as(owner,'select public.create_crm_quote_review($1,$2,$3,$4,$5) result',args);return {q,token,key,result,args};}
async function blocked(c){for(let i=0;i<100;i++){if((await admin.query('select wait_event_type from pg_stat_activity where pid=$1',[c.processID])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,20));}throw Error('Expected lock wait missing');}
const outcome=p=>p.then(value=>({value}),error=>({error}));
try{
  check((await admin.query("select enabled from private.crm_quote_review_runtime")).rows[0].enabled,true);
  for(const role of ['anon','authenticated','service_role']){
    check((await admin.query("select has_table_privilege($1,'private.crm_quote_reviews','select') v",[role])).rows[0].v,false);
    check((await admin.query("select has_function_privilege($1,'public.read_crm_quote_review(text)','execute') v",[role])).rows[0].v,role!=='service_role');
  }
  await admin.query('insert into public.users(id,email,password_hash) values($1,$2,\'synthetic\'),($3,$4,\'synthetic\')',[owner,`${prefix}@example.test`,other,`${prefix}-other@example.test`]);
  await admin.query('insert into public.contacts(id,user_id,name,address) values($1,$2,\'PRIVATE CONTACT\',\'PRIVATE BILLING\')',[prefix,owner]);
  await admin.query('update private.crm_quote_review_runtime set enabled=false');
  await denied(()=>as(owner,'select public.read_crm_quote_reviews($1) result',[randomUUID()]),'42501');
  // Exercise the server pause boundary, then restore the migration-defined runtime.
  await admin.query('update private.crm_quote_review_runtime set enabled=true');

  const a=await issue();
  await admin.query('update private.crm_quote_review_runtime set enabled=false');
  await denied(()=>read(a.token),'42501');await denied(()=>respond(a.token),'42501');
  await denied(()=>as(owner,'select public.read_crm_quote_reviews($1) result',[a.q]),'42501');
  await admin.query('update private.crm_quote_review_runtime set enabled=true');
  check(JSON.stringify((await admin.query('select * from private.crm_quote_reviews where id=$1',[a.result.id])).rows[0]).includes(a.token),false);
  check((await as(owner,'select public.create_crm_quote_review($1,$2,$3,$4,$5) result',a.args)).id,a.result.id);
  await denied(()=>as(other,'select public.read_crm_quote_reviews($1) result',[a.q]),'42501');
  await denied(()=>record(a.result.id,randomUUID(),other),'42501');
  await denied(()=>read('bad'),'42501');await denied(()=>read(randomBytes(32).toString('hex')),'42501');
  const publicView=await read(a.token);check(Object.keys(publicView).sort(),['id','revision','expires_at','customer_text','currency','items','service_location','state','tier','total','received_at'].sort());
  check(JSON.stringify(publicView).includes('PRIVATE'),false);check(publicView.items.length,2);
  check((await as(other,'select public.read_crm_quote_review($1) result',[a.token])).id,a.result.id);
  await denied(()=>as(other,'select public.read_crm_quote_review($1) result',[randomBytes(32).toString('hex')]),'42501');
  for(const role of ['anon','authenticated','service_role']){
    for(const privilege of ['insert','update','delete'])check((await admin.query("select has_table_privilege($1,'private.crm_quote_reviews',$2) v",[role,privilege])).rows[0].v,false);
    check((await admin.query("select has_function_privilege($1,'public.create_crm_quote_review(uuid,integer,uuid,text,text)','execute') v",[role])).rows[0].v,role==='authenticated');
  }
  await denied(()=>respond(a.token,randomUUID(),'standard'),'22023');
  const responseKey=randomUUID();check((await respond(a.token,responseKey,'premium')).total,150);
  check((await respond(a.token,responseKey,'premium')).tier,'premium');
  await denied(()=>respond(a.token,responseKey,'basic'),'23505');
  check((await admin.query('select status from public.quotes where id=$1',[a.q])).rows[0].status,'draft');
  const finalKey=randomUUID();check((await record(a.result.id,finalKey)).revision,2);check((await record(a.result.id,finalKey)).replayed,true);
  const accepted=(await admin.query('select * from public.quote_acceptances where quote_id=$1',[a.q])).rows[0];
  check(accepted.actor_user_id,owner);check(accepted.signer_name,'Synthetic Recipient');check(Number(accepted.accepted_total_amount),150);check(accepted.quote_revision,1);
  check(accepted.quote_snapshot.quote.selected_tier,'premium');check(accepted.quote_snapshot.items.length,2);
  check((await read(a.token)).state,'owner_recorded');
  const invoiceEvidence=()=>as(owner,'select public.read_crm_accepted_invoice_evidence($1) result',[a.q]);
  const evidence=await invoiceEvidence();
  check(evidence.accepted_revision,1);check(evidence.current_revision,2);check(evidence.eligible,true);
  check(evidence.selected_tier,'premium');check(Number(evidence.total_amount),150);check(evidence.items.length,1);
  check(evidence.invoice_id,null);
  await denied(()=>as(other,'select public.read_crm_accepted_invoice_evidence($1) result',[a.q]),'42501');
  await denied(()=>as(null,'select public.read_crm_accepted_invoice_evidence($1) result',[a.q]),'42501');
  const invoiceKey=randomUUID();
  const invoiceResults=await Promise.all([0,1].map(()=>as(owner,'select public.create_invoice_from_accepted_quote($1,1,$2) result',[a.q,invoiceKey])));
  const invoice=invoiceResults[0];check(invoiceResults[1].invoice.id,invoice.invoice.id);
  check(invoiceResults.map(r=>r.replayed).sort(),[false,true]);
  check((await invoiceEvidence()).invoice_id,invoice.invoice.id);
  const secondKey=await as(owner,'select public.create_invoice_from_accepted_quote($1,1,$2) result',[a.q,randomUUID()]);
  check(secondKey.invoice.id,invoice.invoice.id);

  check(Number(invoice.invoice.total_amount),150);
  check((await admin.query('select count(*)::int n from public.invoice_items where invoice_id=$1',[invoice.invoice.id])).rows[0].n,1);
  const b=await issue();await respond(b.token);await denied(()=>record(b.result.id,finalKey),'23505');check((await admin.query('select status from public.quotes where id=$1',[b.q])).rows[0].status,'draft');
  await admin.query("update public.quote_items set description='Changed without revision' where quote_id=$1",[b.q]);
  await denied(()=>read(b.token),'40001');await denied(()=>record(b.result.id),'40001');
  const c=await issue();await as(owner,'select public.revoke_crm_quote_review($1) result',[c.result.id]);await denied(()=>read(c.token),'42501');await denied(()=>respond(c.token),'42501');await issue(c.q);
  const d=await issue();await admin.query("update private.crm_quote_reviews set expires_at=clock_timestamp()-interval '1 second' where id=$1",[d.result.id]);await denied(()=>read(d.token),'42501');await denied(()=>respond(d.token),'42501');
  {
    const q=await quote(),property=randomUUID();
    await admin.query("insert into public.properties(id,user_id,contact_id,service_address_line1,locality,country_code,request_key,request_fingerprint) values($1,$2,$3,'Frozen Review Address','Synthetic Town','CA',$4,'{}')",[property,owner,prefix,randomUUID()]);
    await admin.query('update public.quotes set property_id=$1 where id=$2',[property,q]);const h=await issue(q);
    await admin.query("update public.properties set service_address_line1='Changed Without Quote Revision' where id=$1",[property]);await denied(()=>read(h.token),'40001');
  }
  const e=await issue();await respond(e.token);await admin.query("update private.crm_quote_reviews set expires_at=clock_timestamp()-interval '1 microsecond' where id=$1",[e.result.id]);check((await record(e.result.id)).status,'approved');
  // Observed response race: same payload/key replays; different key conflicts.
  for(const changed of [false,true]){
    const f=await issue(),key=randomUUID(),first=await connect(),second=await connect();
    for(const c of [first,second]){await c.query('begin');await c.query('set local role anon');}
    const sql="select public.respond_crm_quote_review($1,$2,'basic','Race Recipient',true) result";
    await first.query(sql,[f.token,key]);const pending=outcome(second.query(sql,[f.token,changed?randomUUID():key]));await blocked(second);await first.query('commit');const r=await pending;
    if(changed){check(r.error?.code,'23505');await second.query('rollback');}else{check(r.value.rows[0].result.state,'response_received');await second.query('commit');}
  }
  const g=await issue(),deleter=await connect(),reader=await connect();await deleter.query('begin');await deleter.query('delete from public.quotes where id=$1',[g.q]);await reader.query('begin');await reader.query('set local role anon');const pending=outcome(reader.query('select public.read_crm_quote_review($1)',[g.token]));await blocked(reader);await deleter.query('commit');check((await pending).error?.code,'42501');await reader.query('rollback');
  {
    const h=await issue(),holder=await connect(),reader=await connect();await holder.query('begin');await holder.query('select id from public.quotes where id=$1 for update',[h.q]);
    await reader.query('begin');await reader.query('set local role anon');const pending=outcome(reader.query('select public.read_crm_quote_review($1)',[h.token]));await blocked(reader);
    await admin.query("update private.crm_quote_reviews set expires_at=clock_timestamp()-interval '1 second' where id=$1",[h.result.id]);
    await holder.query('commit');check((await pending).error?.code,'42501');await reader.query('rollback');
  }
  {
    const h=await issue(),reader=await connect(),inserter=await connect();await reader.query('begin');await reader.query('set local role anon');await reader.query('select public.read_crm_quote_review($1)',[h.token]);
    await inserter.query('begin');const pending=outcome(inserter.query("insert into public.quote_items(user_id,quote_id,service_name,quantity,unit_price,tier,order_index) values($1,$2,'Added after issue',1,1,'basic',9)",[owner,h.q]));
    await blocked(inserter);await reader.query('commit');check(Boolean((await pending).value),true);await inserter.query('commit');await denied(()=>respond(h.token),'40001');
  }
  // Finalization racing revoke: first lock holder wins; no partial acceptance.
  for(const revokeFirst of [true,false]){
    const h=await issue();await respond(h.token);const first=await connect(),second=await connect();
    for(const c of [first,second]){await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);}
    const revoke=['select public.revoke_crm_quote_review($1) result',[h.result.id]],finalize=['select public.record_crm_quote_review_acceptance($1,$2) result',[h.result.id,randomUUID()]];
    const initial=revokeFirst?revoke:finalize,later=revokeFirst?finalize:revoke;
    await first.query(...initial);const pending=outcome(second.query(...later));await blocked(second);await first.query('commit');const r=await pending;
    if(revokeFirst){check(r.error?.code,'40001');await second.query('rollback');}else{check(Boolean(r.value),true);await second.query('commit');}
    check((await admin.query('select count(*)::int n from public.quote_acceptances where quote_id=$1',[h.q])).rows[0].n,revokeFirst?0:1);
  }
  // Concurrent owner replays create one canonical acceptance, even with distinct retry keys.
  {
    const h=await issue();await respond(h.token);const first=await connect(),second=await connect();
    for(const c of [first,second]){await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);}
    await first.query('select public.record_crm_quote_review_acceptance($1,$2)',[h.result.id,randomUUID()]);
    const pending=outcome(second.query('select public.record_crm_quote_review_acceptance($1,$2) result',[h.result.id,randomUUID()]));await blocked(second);await first.query('commit');check((await pending).value.rows[0].result.replayed,true);await second.query('commit');
    check((await admin.query('select count(*)::int n from public.quote_acceptances where quote_id=$1',[h.q])).rows[0].n,1);
  }
  console.log(`PASS ${assertions} local review assertions including narrow access, disclosure, owner isolation, immutable evidence, selected tier, idempotency, expiry/revoke and eight observed SQL races.`);
}finally{
  for(const c of clients)if(c!==admin)await c.query('rollback').catch(()=>{});
  await admin.query('update private.crm_quote_review_runtime set enabled=true');
  await admin.query('delete from public.users where id=any($1::text[])',[[owner,other]]);
  for(const c of clients)await c.end();
}
