-- Run transactionally on a disposable complete local migration chain only.
begin;
insert into public.users(id,email,password_hash) values
 ('a1111111-1111-4111-8111-111111111111','note-sql-a@example.test','synthetic'),
 ('b2222222-2222-4222-8222-222222222222','note-sql-b@example.test','synthetic');
insert into public.contacts(id,user_id,name) values
 ('note-sql-a','a1111111-1111-4111-8111-111111111111','Synthetic A'),
 ('note-sql-a2','a1111111-1111-4111-8111-111111111111','Synthetic A2'),
 ('note-sql-b','b2222222-2222-4222-8222-222222222222','Synthetic B');
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'assertion failed: %',label; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin execute command; raise exception 'expected SQLSTATE %',expected;
exception when others then if sqlstate<>expected then raise; end if; end $$;
select pg_temp.assert_true(not has_function_privilege('anon','public.create_crm_contact_note(uuid,text,text)','execute'),'anon RPC denied');
select pg_temp.assert_true(has_function_privilege('authenticated','public.create_crm_contact_note(uuid,text,text)','execute'),'authenticated RPC allowed');
select pg_temp.assert_true(not has_table_privilege('authenticated','private.crm_contact_note_requests','select'),'private request SELECT denied');
select pg_temp.assert_true(not has_table_privilege('service_role','private.crm_contact_note_requests','select'),'service role private request denied');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='private.crm_contact_note_requests'::regclass),'ledger RLS enabled');
set local role anon;
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a','Anonymous')$q$,'42501');
reset role;
set local role authenticated;
select pg_temp.expect_error('select * from private.crm_contact_note_requests','42501');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a','Text')$q$,'42501');
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error($q$select public.create_crm_contact_note(null,'note-sql-a','Text')$q$,'22023');
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a',null)$q$,'22023');
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a',U&'\2000\200A\FEFF')$q$,'22023');
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a',repeat('x',5001))$q$,'22023');
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-b','Private')$q$,'42501');
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','missing','Private')$q$,'42501');
do $$ declare first jsonb; again jsonb; begin
 first:=public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a',E'  <img src=x onerror=alert(1)>\nSecond line v  ');
 again:=public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a',E'<img src=x onerror=alert(1)>\nSecond line v');
 perform pg_temp.assert_true(first->>'replayed'='false' and again->>'replayed'='true','create then replay');
 perform pg_temp.assert_true(first->'activity'=again->'activity','replay result stable');
 perform pg_temp.assert_true((first->'activity'->>'description')=E'<img src=x onerror=alert(1)>\nSecond line v','content preserved');
 perform pg_temp.assert_true((first->'activity'->>'created_at')::timestamptz is not null,'server timestamp');
 perform pg_temp.assert_true(not (first->'activity' ?| array['user_id','request_key','request_fingerprint']),'response private fields absent');
 perform pg_temp.assert_true(first->'activity'->'due_date'='null'::jsonb,'no fabricated due date');
 perform pg_temp.assert_true((select count(*)=1 from public.activities where contact_id='note-sql-a'),'one activity');
end $$;
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a','Changed')$q$,'23505');
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a2','Changed')$q$,'23505');
select public.create_crm_contact_note('10000000-0000-4000-8000-000000000002','note-sql-a','Edited later');
update public.activities set description='Owner edited' where contact_id='note-sql-a' and description='Edited later';
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000002','note-sql-a','Edited later')$q$,'40001');
select public.create_crm_contact_note('10000000-0000-4000-8000-000000000003','note-sql-a','Deleted later');
delete from public.activities where contact_id='note-sql-a' and description='Deleted later';
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000003','note-sql-a','Deleted later')$q$,'40001');
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a','Private')$q$,'42501');
select pg_temp.assert_true((select count(*)=0 from public.activities),'other owner sees no notes');
select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-b','Independent same key');
select pg_temp.assert_true((select count(*)=1 from public.activities),'same key scoped by owner');
reset role;
delete from public.contacts where id='note-sql-a';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error($q$select public.create_crm_contact_note('10000000-0000-4000-8000-000000000001','note-sql-a',E'<img src=x onerror=alert(1)>\nSecond line v')$q$,'42501');
reset role;
select pg_temp.assert_true((select count(*)=3 from private.crm_contact_note_requests where user_id='a1111111-1111-4111-8111-111111111111'),'replay tombstones survive contact deletion');
rollback;
