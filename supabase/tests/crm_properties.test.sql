create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

begin;

select plan(36);

select ok(
  to_regclass('public.properties') is not null,
  'properties table exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.properties'::regclass),
  'properties has RLS enabled'
);
select ok(
  not has_function_privilege('anon', 'public.create_crm_property(uuid,text,text,text,text,text,text,text,text)', 'execute')
  and not has_function_privilege('service_role', 'public.create_crm_property(uuid,text,text,text,text,text,text,text,text)', 'execute'),
  'anonymous and service roles cannot execute property creation'
);
select ok(
  has_function_privilege('authenticated', 'public.create_crm_property(uuid,text,text,text,text,text,text,text,text)', 'execute'),
  'authenticated can execute property creation'
);
select ok(
  has_column_privilege('authenticated', 'public.properties', 'id', 'select'),
  'authenticated can read the property identity'
);
select ok(
  not has_column_privilege('authenticated', 'public.properties', 'user_id', 'select'),
  'tenant ownership metadata is not exposed to the browser'
);
select ok(
  not has_column_privilege('authenticated', 'public.properties', 'request_key', 'select')
  and not has_column_privilege('authenticated', 'public.properties', 'request_fingerprint', 'select'),
  'idempotency internals are not directly readable'
);
select ok(
  not has_table_privilege('authenticated', 'public.properties', 'insert')
  and not has_table_privilege('authenticated', 'public.properties', 'update')
  and not has_table_privilege('authenticated', 'public.properties', 'delete')
  and not has_table_privilege('authenticated', 'public.properties', 'truncate'),
  'authenticated cannot directly mutate or delete properties'
);
select ok(
  not has_table_privilege('anon', 'public.properties', 'select')
  and not has_table_privilege('service_role', 'public.properties', 'select')
  and not has_table_privilege('service_role', 'public.properties', 'insert')
  and not has_table_privilege('service_role', 'public.properties', 'update')
  and not has_table_privilege('service_role', 'public.properties', 'delete')
  and not has_table_privilege('service_role', 'public.properties', 'truncate'),
  'anonymous and service roles have no direct property table access'
);

set local role service_role;
insert into public.users (id, email, password_hash) values
  ('c0400000-0000-4000-8000-000000000001', 'c04-a@example.test', 'test-only'),
  ('c0400000-0000-4000-8000-000000000002', 'c04-b@example.test', 'test-only');
insert into public.contacts (id, user_id, name, address) values
  ('c04-contact-a1', 'c0400000-0000-4000-8000-000000000001', 'Customer A1', 'Billing address A1'),
  ('c04-contact-a2', 'c0400000-0000-4000-8000-000000000001', 'Customer A2', 'Billing address A2'),
  ('c04-contact-b1', 'c0400000-0000-4000-8000-000000000002', 'Customer B1', 'Billing address B1');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0400000-0000-4000-8000-000000000001', true);

select is(
  public.create_crm_property(
    'c0400000-0000-4000-8000-000000000011', 'c04-contact-a1',
    '101 Service Road', 'Springfield', 'us', 'Unit 1', 'IL', '62701', 'North building'
  )->'property'->>'service_address_line1',
  '101 Service Road',
  'creation stores a separately supplied service address'
);
select is(
  public.create_crm_property(
    'c0400000-0000-4000-8000-000000000011', 'c04-contact-a1',
    '101 Service Road', 'Springfield', 'US', 'Unit 1', 'IL', '62701', 'North building'
  )->>'replayed',
  'true',
  'identical request-key retry is replayed'
);
select is(
  (select count(*)::integer from public.properties where contact_id = 'c04-contact-a1'),
  1,
  'retry does not duplicate the property'
);
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000011', 'c04-contact-a1',
    '102 Different Road', 'Springfield', 'US', null, 'IL', '62701', 'North building'
  )$$,
  '23505', 'request key was already used',
  'same request key with changed payload is rejected'
);
select is(
  (select count(*)::integer from public.properties where contact_id = 'c04-contact-a1'),
  1,
  'changed-payload retry leaves property state unchanged'
);

select isnt(
  public.create_crm_property(
    'c0400000-0000-4000-8000-000000000012', 'c04-contact-a1',
    '101 Service Road', 'Springfield', 'US', 'Unit 1', 'IL', '62701', 'North building'
  )->'property'->>'id',
  public.create_crm_property(
    'c0400000-0000-4000-8000-000000000011', 'c04-contact-a1',
    '101 Service Road', 'Springfield', 'US', 'Unit 1', 'IL', '62701', 'North building'
  )->'property'->>'id',
  'same address can represent a distinct property identity'
);
select is(
  public.create_crm_property(
    'c0400000-0000-4000-8000-000000000013', 'c04-contact-a2',
    '55 Another Street', 'Springfield', 'US', null, 'IL', '62702', 'Customer A2 location'
  )->'property'->>'contact_id',
  'c04-contact-a2',
  'a second customer in the same tenant can own a property'
);
select is(
  (select count(*)::integer from public.properties where contact_id = 'c04-contact-a1'),
  2,
  'one customer can have multiple service properties'
);
select is(
  (select count(*)::integer from public.properties where contact_id = 'c04-contact-a2'),
  1,
  'property remains associated with its specific customer'
);
select is(
  (select country_code from public.properties where service_address_line1 = '101 Service Road' and label = 'North building' limit 1),
  'US',
  'country code is normalized to uppercase'
);
select ok(
  not exists (
    select 1 from public.properties p
    join public.contacts c on c.id = p.contact_id
    where p.contact_id = 'c04-contact-a1'
      and p.label = 'North building'
      and p.service_address_line1 = c.address
  ),
  'service property is not implicitly copied from contact address'
);

select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000014', 'c04-contact-a1',
    '   ', 'Springfield', 'US'
  )$$,
  '22023', 'invalid property address',
  'blank street address is rejected'
);
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000015', 'c04-contact-a1',
    '10 Road', '   ', 'US'
  )$$,
  '22023', 'invalid property address',
  'blank locality is rejected'
);
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000024', 'c04-contact-a1',
    null, 'Springfield', 'US'
  )$$,
  '22023', 'invalid property address',
  'missing street address is rejected'
);
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000025', 'c04-contact-a1',
    '10 Road', null, 'US'
  )$$,
  '22023', 'invalid property address',
  'missing locality is rejected'
);
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000016', 'c04-contact-a1',
    '10 Road', 'Springfield', 'USA'
  )$$,
  '22023', 'invalid country code',
  'malformed country code is rejected'
);
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000017', 'c04-contact-a1',
    '10 Road', 'Springfield', 'US', null, null, repeat('1', 33)
  )$$,
  '22023', 'invalid property address',
  'oversized postal code is rejected'
);
select is(
  (select count(*)::integer from public.properties),
  3,
  'invalid addresses do not persist partial properties'
);

select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000018', 'c04-contact-b1',
    '20 Other Road', 'Springfield', 'US'
  )$$,
  '42501', 'contact unavailable',
  'tenant A cannot create a property for tenant B contact'
);
select is(
  (select count(*)::integer from public.properties),
  3,
  'cross-tenant creation failure leaves no property'
);

select throws_ok(
  $$insert into public.properties (
    user_id, contact_id, service_address_line1, locality, country_code,
    request_key, request_fingerprint
  ) values (
    'c0400000-0000-4000-8000-000000000001', 'c04-contact-b1',
    '30 Wrong Owner Road', 'Springfield', 'US',
    'c0400000-0000-4000-8000-000000000019', '{}'
  )$$,
  '42501', null,
  'authenticated cannot directly insert forged ownership'
);
reset role;

select throws_ok(
  $$insert into public.properties (
    user_id, contact_id, service_address_line1, locality, country_code,
    request_key, request_fingerprint
  ) values (
    'c0400000-0000-4000-8000-000000000001', 'c04-contact-b1',
    '30 Wrong Owner Road', 'Springfield', 'US',
    'c0400000-0000-4000-8000-000000000020', '{}'
  )$$,
  '23503', null,
  'composite tenant/contact foreign key rejects mismatched ownership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0400000-0000-4000-8000-000000000002', true);
select is(
  public.create_crm_property(
    'c0400000-0000-4000-8000-000000000021', 'c04-contact-b1',
    '88 Tenant B Road', 'Springfield', 'US'
  )->'property'->>'contact_id',
  'c04-contact-b1',
  'tenant B can create its own customer property'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0400000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from public.properties),
  3,
  'tenant A can read all and only its properties'
);
select is(
  (select count(*)::integer from public.properties where contact_id = 'c04-contact-b1'),
  0,
  'tenant A cannot read tenant B properties'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000022', 'c04-contact-a1',
    '40 Anonymous Road', 'Springfield', 'US'
  )$$,
  '42501', 'authentication required',
  'authenticated role without an identity cannot create properties'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.create_crm_property(
    'c0400000-0000-4000-8000-000000000023', 'c04-contact-a1',
    '41 Anonymous Road', 'Springfield', 'US'
  )$$,
  '42501', null,
  'anonymous role cannot create properties'
);
reset role;

select * from finish();
rollback;
