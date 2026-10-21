-- Synthetic local integration suite; requires canonical quote, acceptance,
-- invoice, property and service-location migrations. All fixtures roll back.
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
begin;
select no_plan();

select ok((select relrowsecurity from pg_class where oid = 'public.quote_property_assignment_requests'::regclass), 'request ledger RLS is enabled');
select ok(not has_table_privilege('authenticated', 'public.quote_property_assignment_requests', 'select')
  and not has_table_privilege('service_role', 'public.quote_property_assignment_requests', 'insert'), 'request ledger is not directly accessible');
select ok(has_function_privilege('authenticated', 'public.set_crm_quote_service_property(uuid,integer,uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.set_crm_quote_service_property(uuid,integer,uuid,uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.set_crm_quote_service_property(uuid,integer,uuid,uuid)', 'execute'), 'association execution is authenticated-only');

insert into public.users (id,email,password_hash) values
 ('aa100000-0000-4000-8000-000000000001','location-a@example.test','synthetic'),
 ('aa100000-0000-4000-8000-000000000002','location-b@example.test','synthetic');
insert into public.contacts (id,user_id,name,address) values
 ('location-a1','aa100000-0000-4000-8000-000000000001','Location customer A1','Billing address, not service address'),
 ('location-a2','aa100000-0000-4000-8000-000000000001','Location customer A2','Other billing'),
 ('location-b1','aa100000-0000-4000-8000-000000000002','Location customer B1','Tenant B billing'),
 ('location-cascade','aa100000-0000-4000-8000-000000000001','Cascade-only fixture','Synthetic');
insert into public.properties (id,user_id,contact_id,label,service_address_line1,locality,country_code,request_key,request_fingerprint) values
 ('aa200000-0000-4000-8000-000000000001','aa100000-0000-4000-8000-000000000001','location-a1','Original label','10 Frozen Service Lane','Springfield','US','aa200000-0000-4000-8000-000000000011','{}'),
 ('aa200000-0000-4000-8000-000000000002','aa100000-0000-4000-8000-000000000001','location-a1','Second location','20 Second Service Lane','Springfield','US','aa200000-0000-4000-8000-000000000012','{}'),
 ('aa200000-0000-4000-8000-000000000003','aa100000-0000-4000-8000-000000000001','location-a2',null,'30 Other Customer Lane','Springfield','US','aa200000-0000-4000-8000-000000000013','{}'),
 ('aa200000-0000-4000-8000-000000000004','aa100000-0000-4000-8000-000000000002','location-b1',null,'40 Other Tenant Lane','Springfield','US','aa200000-0000-4000-8000-000000000014','{}'),
 ('aa200000-0000-4000-8000-000000000005','aa100000-0000-4000-8000-000000000001','location-cascade',null,'50 Cascade Lane','Springfield','US','aa200000-0000-4000-8000-000000000015','{}');

insert into public.quotes (id,user_id,contact_id,request_key,request_fingerprint,status,total_amount,selected_tier) values
 ('aa300000-0000-4000-8000-000000000001','aa100000-0000-4000-8000-000000000001','location-a1','aa300000-0000-4000-8000-000000000011','fixture','sent',250,'premium'),
 ('aa300000-0000-4000-8000-000000000002','aa100000-0000-4000-8000-000000000001','location-a1','aa300000-0000-4000-8000-000000000012','fixture','draft',80,'basic'),
 ('aa300000-0000-4000-8000-000000000003','aa100000-0000-4000-8000-000000000001','location-a1','aa300000-0000-4000-8000-000000000013','fixture','rejected',80,'basic'),
 ('aa300000-0000-4000-8000-000000000004','aa100000-0000-4000-8000-000000000001','location-a1','aa300000-0000-4000-8000-000000000014','fixture','sent',80,'basic'),
 ('aa300000-0000-4000-8000-000000000005','aa100000-0000-4000-8000-000000000001','location-a1','aa300000-0000-4000-8000-000000000015','fixture','approved',40,'basic'),
 ('aa300000-0000-4000-8000-000000000006','aa100000-0000-4000-8000-000000000001','location-cascade','aa300000-0000-4000-8000-000000000016','fixture','draft',0,'basic'),
 ('aa300000-0000-4000-8000-000000000007','aa100000-0000-4000-8000-000000000001','location-a1','aa300000-0000-4000-8000-000000000017','fixture','sent',999,'premium');
insert into public.quote_items (user_id,quote_id,service_name,quantity,unit_price,tier,order_index) values
 ('aa100000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000001','Basic wash',1,100,'basic',0),
 ('aa100000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000001','Standard wash',1,175,'standard',1),
 ('aa100000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000001','Premium wash',1,250,'premium',2),
 ('aa100000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000004','Unassigned wash',1,80,'basic',0),
 ('aa100000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000005','Legacy wash',1,40,'basic',0),
 ('aa100000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000007','Mismatched premium',1,250,'premium',0);

-- Representative pre-migration evidence: no location keys. Never backfill it.
update public.quotes set revision=2 where id='aa300000-0000-4000-8000-000000000005';
insert into public.quote_acceptances (user_id,quote_id,quote_revision,request_key,request_fingerprint,accepted_total_amount,signer_name,actor_user_id,signature_kind,accessible_declaration,quote_snapshot)
select q.user_id,q.id,1,'aa400000-0000-4000-8000-000000000005',md5(q.id::text||'|1|Legacy Signer||true'),40,'Legacy Signer',q.user_id,'typed',true,
 jsonb_build_object('quote',jsonb_build_object('selected_tier','basic','total_amount',40),'items',jsonb_build_array(jsonb_build_object('service_name','Legacy wash','description','','quantity',1,'unit_price',40,'tier','basic','order_index',0)))
from public.quotes q where id='aa300000-0000-4000-8000-000000000005';
create temp table location_legacy_evidence as select quote_snapshot from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000001',true);
select is(public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',1,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000001')->>'revision','2','sent association increments revision once');
select is(public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',1,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000001')->>'replayed','true','same-key retry precedes stale-version check');
select ok(not (public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',1,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000001') ?| array['user_id','request_key','request_fingerprint']),'association result excludes owner and request internals');
select is((select status from public.quotes where id='aa300000-0000-4000-8000-000000000001'),'sent','association preserves lifecycle status');
select is((select total_amount from public.quotes where id='aa300000-0000-4000-8000-000000000001'),250::numeric,'association preserves pricing');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',1,'aa200000-0000-4000-8000-000000000002','aa500000-0000-4000-8000-000000000001')$$,'23505','request key was already used','changed replay payload conflicts');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',1,'aa200000-0000-4000-8000-000000000002','aa500000-0000-4000-8000-000000000002')$$,'40001','quote revision conflict','stale association conflicts');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000002',1,'aa200000-0000-4000-8000-000000000003','aa500000-0000-4000-8000-000000000003')$$,'42501','property unavailable','same-owner different-customer property denied');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000002',1,'aa200000-0000-4000-8000-000000000004','aa500000-0000-4000-8000-000000000004')$$,'42501','property unavailable','foreign-tenant property denied');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000002',1,'aa200000-0000-4000-8000-000000000099','aa500000-0000-4000-8000-000000000099')$$,'42501','property unavailable','missing property uses same unavailable error');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000002',0,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000005')$$,'22023','quote, revision, property and request key are required','invalid version denied');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000003',1,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000006')$$,'P0001','quote is not editable','rejected quote cannot change location');
select is(public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000002',1,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000007')->>'revision','2','draft quote can be associated');
select is(public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000002',2,'aa200000-0000-4000-8000-000000000002','aa500000-0000-4000-8000-000000000008')->>'revision','3','reassignment advances revision');
select is(public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000002',1,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000007')->>'revision','2','retry returns committed historical result after later reassignment');
select is((select revision from public.quotes where id='aa300000-0000-4000-8000-000000000002'),3,'historical replay does not overwrite newer assignment');
select throws_ok($$update public.quotes set property_id='aa200000-0000-4000-8000-000000000002' where id='aa300000-0000-4000-8000-000000000001'$$,'42501',null,'browser cannot bypass association RPC');

select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',2,'aa200000-0000-4000-8000-000000000004','aa500000-0000-4000-8000-000000000009')$$,'42501','quote unavailable','foreign-tenant quote denied');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',2,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000009')$$,'42501','authentication required','missing database identity denied');
reset role;
set local role anon;
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',2,'aa200000-0000-4000-8000-000000000001','aa500000-0000-4000-8000-000000000009')$$,'42501',null,'anonymous execution denied');
reset role;
select throws_ok($$update public.quotes set property_id='aa200000-0000-4000-8000-000000000003' where id='aa300000-0000-4000-8000-000000000001'$$,'23503',null,'composite FK rejects privileged mismatched customer');
select is((select count(*)::integer from public.quote_property_assignment_requests),3,'failed requests leave no ledger rows');

set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.accept_crm_quote('aa300000-0000-4000-8000-000000000001',1,'aa400000-0000-4000-8000-000000000001','Synthetic Signer',null,true)$$,'40001','quote revision conflict','association makes old acceptance revision stale');
select is(public.accept_crm_quote('aa300000-0000-4000-8000-000000000001',2,'aa400000-0000-4000-8000-000000000001','Synthetic Signer',null,true)->'acceptance'->>'quote_revision','2','acceptance freezes pre-approval revision');
select is((select revision from public.quotes where id='aa300000-0000-4000-8000-000000000001'),3,'approval advances live revision to accepted revision plus one');
select throws_ok($$select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000001',3,'aa200000-0000-4000-8000-000000000002','aa500000-0000-4000-8000-000000000010')$$,'P0001','quote is not editable','approved quote location cannot be changed');
reset role;
select is((select quote_snapshot->>'service_location_status' from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000001'),'recorded','acceptance distinguishes recorded location');
select is((select quote_snapshot->'service_location'->>'service_address_line1' from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000001'),'10 Frozen Service Lane','service address is independent of billing address');
select ok(not (select quote_snapshot->'service_location' ?| array['user_id','request_key','request_fingerprint'] from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000001'),'frozen location excludes private metadata');
select is((select jsonb_array_length(quote_snapshot->'items') from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000001'),3,'acceptance retains all original pricing tiers');
create temp table frozen_location_before as select quote_snapshot from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000001';
update public.properties set service_address_line1='Changed current address',label='Changed current label' where id='aa200000-0000-4000-8000-000000000001';
update public.contacts set address='Changed current billing address' where id='location-a1';
select is((select quote_snapshot::text from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000001'),(select quote_snapshot::text from frozen_location_before),'source edits preserve entire accepted snapshot');
select throws_ok($$delete from public.properties where id='aa200000-0000-4000-8000-000000000001'$$,'23503',null,'referenced property cannot be silently removed');

set local role authenticated;
select is(public.accept_crm_quote('aa300000-0000-4000-8000-000000000001',2,'aa400000-0000-4000-8000-000000000001','Synthetic Signer',null,true)->'acceptance'->'quote_snapshot'->'service_location'->>'service_address_line1','10 Frozen Service Lane','acceptance replay returns frozen location after source changes');
select is(public.create_invoice_from_accepted_quote('aa300000-0000-4000-8000-000000000001',2,'aa600000-0000-4000-8000-000000000001')->'invoice'->>'total_amount','250.00','unchanged invoice RPC derives selected premium amount');
select is(jsonb_array_length(public.create_invoice_from_accepted_quote('aa300000-0000-4000-8000-000000000001',2,'aa600000-0000-4000-8000-000000000001')->'items'),1,'invoice retains only selected tier items');
select throws_ok($$select public.create_invoice_from_accepted_quote('aa300000-0000-4000-8000-000000000001',3,'aa600000-0000-4000-8000-000000000002')$$,'40001','accepted quote revision conflict','live revision cannot replace accepted revision during invoicing');
select is(public.accept_crm_quote('aa300000-0000-4000-8000-000000000004',1,'aa400000-0000-4000-8000-000000000004','Unassigned Signer',null,true)->'acceptance'->'quote_snapshot'->>'service_location_status','unassigned','unassociated legacy sent quote preserves acceptance compatibility');
select ok((public.accept_crm_quote('aa300000-0000-4000-8000-000000000004',1,'aa400000-0000-4000-8000-000000000004','Unassigned Signer',null,true)->'acceptance'->'quote_snapshot'->'service_location')='null'::jsonb,'unassigned evidence never invents an address');
select is(public.accept_crm_quote('aa300000-0000-4000-8000-000000000005',1,'aa400000-0000-4000-8000-000000000005','Legacy Signer',null,true)->>'replayed','true','pre-location acceptance remains replayable');
select is(public.create_invoice_from_accepted_quote('aa300000-0000-4000-8000-000000000005',1,'aa600000-0000-4000-8000-000000000005')->'invoice'->>'total_amount','40.00','legacy accepted quote remains invoice-compatible');
select public.accept_crm_quote('aa300000-0000-4000-8000-000000000007',1,'aa400000-0000-4000-8000-000000000007','Mismatch Signer',null,true)->>'replayed';
select throws_ok($$select public.create_invoice_from_accepted_quote('aa300000-0000-4000-8000-000000000007',1,'aa600000-0000-4000-8000-000000000007')$$,'22023','accepted total does not match selected items','selected-tier mismatch remains rejected by invoice authority');
select public.set_crm_quote_service_property('aa300000-0000-4000-8000-000000000006',1,'aa200000-0000-4000-8000-000000000005','aa500000-0000-4000-8000-000000000016')->>'revision';
reset role;
select is((select quote_snapshot::text from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000005'),(select quote_snapshot::text from location_legacy_evidence),'legacy evidence remains byte-equivalent without backfill');
select ok(not (select quote_snapshot ? 'service_location' from public.quote_acceptances where quote_id='aa300000-0000-4000-8000-000000000005'),'legacy missing evidence stays missing');
select throws_ok($$delete from public.contacts where id='location-a1'$$,'23503',null,'invoice-backed customer deletion remains restricted');
select lives_ok($$delete from public.contacts where id='location-cascade'$$,'existing customer cascade works with new NO ACTION link');
select is((select count(*)::integer from public.quotes where id='aa300000-0000-4000-8000-000000000006'),0,'customer cascade deletes its quote');
select is((select count(*)::integer from public.properties where id='aa200000-0000-4000-8000-000000000005'),0,'customer cascade deletes its property');
select is((select count(*)::integer from public.quote_property_assignment_requests where quote_id='aa300000-0000-4000-8000-000000000006'),0,'customer cascade cleans assignment request ledger');
select is((select count(*)::integer from public.invoices where quote_id='aa300000-0000-4000-8000-000000000007'),0,'invalid commercial evidence leaves no partial invoice');

set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000001',true);
select is(public.read_crm_accepted_service_location('aa300000-0000-4000-8000-000000000001')->'service_location'->>'service_address_line1','10 Frozen Service Lane','UI read returns immutable accepted address');
select ok(not (public.read_crm_accepted_service_location('aa300000-0000-4000-8000-000000000001') ? 'quote'),'UI read never returns commercial quote or signature evidence');
select is(public.read_crm_accepted_service_location('aa300000-0000-4000-8000-000000000004')->>'service_location_status','unassigned','UI read distinguishes explicit unassigned acceptance');
select is(public.read_crm_accepted_service_location('aa300000-0000-4000-8000-000000000005'),'{}'::jsonb,'UI read preserves historical missing evidence');
select throws_ok($$select public.read_crm_accepted_service_location('aa300000-0000-4000-8000-000000000003')$$,'42501','quote unavailable','UI read denies unavailable or unaccepted quotes');
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.read_crm_accepted_service_location('aa300000-0000-4000-8000-000000000001')$$,'42501','quote unavailable','UI read denies another business acceptance');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.read_crm_accepted_service_location('aa300000-0000-4000-8000-000000000001')$$,'42501','quote unavailable','UI read requires server-authenticated identity');
reset role;
select ok(not has_function_privilege('anon','public.read_crm_accepted_service_location(uuid)','execute') and not has_function_privilege('service_role','public.read_crm_accepted_service_location(uuid)','execute'),'UI evidence read is authenticated-only');
select ok(not has_table_privilege('authenticated','public.quote_acceptances','select'),'UI projection does not open direct acceptance-ledger access');
set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000001',true);
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->>'accepted_revision','2','invoice UI reads acceptance revision rather than post-acceptance revision');
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->>'current_revision','3','invoice UI separately exposes current revision');
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->>'selected_tier','premium','invoice UI selected tier comes from acceptance');
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->>'total_amount','250.00','invoice UI total comes from acceptance');
select is(jsonb_array_length(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->'items'),1,'invoice UI excludes unselected tiers');
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->'items'->0->>'service_name','Premium wash','invoice UI projects only selected frozen line');
select ok(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->>'invoice_id' is not null,'invoice UI identifies an already converted acceptance');
select ok(not (public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001') ?| array['user_id','actor_user_id','signer_name','signature_bytes','request_key','request_fingerprint','quote_snapshot']),'invoice projection excludes identity signature and private ledger fields');
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000005')->'items'->0->>'line_total','40.00','legacy snapshot without stored item total uses existing RPC normalization');
select throws_ok($$select public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000002')$$,'42501','accepted quote unavailable','invoice evidence denies unaccepted quotes');
reset role;
update public.quotes set total_amount=999,selected_tier='basic',revision=revision+1 where id='aa300000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->>'total_amount','250.00','live quote edits cannot replace accepted invoice total');
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')->>'eligible','false','changed live revision makes new invoice UI ineligible');
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')$$,'42501','accepted quote unavailable','invoice evidence denies another business');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000001')$$,'42501','accepted quote unavailable','invoice evidence requires authenticated server identity');
reset role;
select ok(not has_function_privilege('anon','public.read_crm_accepted_invoice_evidence(uuid)','execute') and not has_function_privilege('service_role','public.read_crm_accepted_invoice_evidence(uuid)','execute'),'invoice evidence projection is authenticated-only');
select ok(not has_table_privilege('authenticated','public.quote_acceptances','select'),'invoice evidence keeps the full ledger private');
insert into public.quotes(id,user_id,contact_id,request_key,request_fingerprint,status,total_amount,selected_tier)
values('aa300000-0000-4000-8000-000000000008','aa100000-0000-4000-8000-000000000001','location-a1','aa300000-0000-4000-8000-000000000018','rounding fixture','sent',0.15,'basic');
insert into public.quote_items(user_id,quote_id,service_name,quantity,unit_price,tier,order_index)
values('aa100000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000008','Fractional fixture',0.29,0.50,'basic',0);
set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000001',true);
select public.accept_crm_quote('aa300000-0000-4000-8000-000000000008',1,'aa400000-0000-4000-8000-000000000008','Rounding Signer',null,true)->>'replayed';
select is(public.read_crm_accepted_invoice_evidence('aa300000-0000-4000-8000-000000000008')->'items'->0->>'line_total','0.15','read evidence uses exact PostgreSQL decimal rounding');
select is(public.create_invoice_from_accepted_quote('aa300000-0000-4000-8000-000000000008',1,'aa600000-0000-4000-8000-000000000008')->'items'->0->>'line_total','0.15','unchanged invoice authority matches projected fractional evidence');
reset role;
select * from finish();
rollback;
