-- Disposable local database only. Run after old quote acceptance and BEFORE
-- the service-location association migration to prove forward preservation.
begin;
insert into public.users(id,email,password_hash) values
 ('ab100000-0000-4000-8000-000000000001','legacy-forward@example.test','synthetic');
insert into public.contacts(id,user_id,name,address) values
 ('location-legacy-forward','ab100000-0000-4000-8000-000000000001','Legacy forward fixture','Current billing, not historic service');
insert into public.quotes(id,user_id,contact_id,request_key,request_fingerprint,status,total_amount,selected_tier)
values('ab300000-0000-4000-8000-000000000001','ab100000-0000-4000-8000-000000000001','location-legacy-forward','ab300000-0000-4000-8000-000000000011','fixture','sent',40,'basic');
insert into public.quote_items(user_id,quote_id,service_name,quantity,unit_price,tier,order_index)
values('ab100000-0000-4000-8000-000000000001','ab300000-0000-4000-8000-000000000001','Legacy selected service',1,40,'basic',0);
set local role authenticated;
select set_config('request.jwt.claim.sub','ab100000-0000-4000-8000-000000000001',true);
select public.accept_crm_quote('ab300000-0000-4000-8000-000000000001',1,'ab400000-0000-4000-8000-000000000001','Pre-migration signer','data:image/png;base64,iVBORw0KGgo=',false)->>'replayed';
reset role;
create schema location_legacy_fixture;
create table location_legacy_fixture.before as
select quote_snapshot::text as snapshot_text, encode(signature_bytes,'hex') as signature_hex, quote_revision, accepted_at
from public.quote_acceptances where quote_id='ab300000-0000-4000-8000-000000000001';
commit;
