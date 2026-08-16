set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_internal_crm_lead(
  '20000000-0000-4000-8000-000000000001','Concurrent Lead','5555551999','concurrent@example.test',
  'Concurrent One','Service One','Message One','concurrency',null
);
