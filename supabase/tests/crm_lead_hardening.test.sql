do $$ begin
  if has_function_privilege('anon', 'public.create_internal_crm_lead(uuid,text,text,text,text,text,text,text,text)', 'execute') then
    raise exception 'anon can execute hardened lead RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.create_internal_crm_lead(uuid,text,text,text,text,text,text,text,text)', 'execute') then
    raise exception 'authenticated cannot execute hardened lead RPC';
  end if;
end $$;

insert into public.contacts(id,user_id,name,phone,email) values
  ('identity-phone','11111111-1111-4111-8111-111111111111','Phone Identity','+15555551001','phone-only@example.test'),
  ('identity-email','11111111-1111-4111-8111-111111111111','Email Identity','+15555551002','email-only@example.test');
insert into public.opportunities(id,user_id,contact_id,pipeline_stage,status,value) values
  ('identity-phone-opp','11111111-1111-4111-8111-111111111111','identity-phone','New Lead','open',0),
  ('identity-email-opp','11111111-1111-4111-8111-111111111111','identity-email','New Lead','open',0);

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

select public.create_internal_crm_lead(
  '10000000-0000-4000-8000-000000000001','Phone Identity','5555551001','phone-only@example.test',
  'Address One','Service One','Message One','builder-preview','funnel-a'
);
select public.create_internal_crm_lead(
  '10000000-0000-4000-8000-000000000001','Phone Identity','5555551001','phone-only@example.test',
  'Address One','Service One','Message One','builder-preview','funnel-a'
);
select public.create_internal_crm_lead(
  '10000000-0000-4000-8000-000000000002','Phone Identity','5555551001','phone-only@example.test',
  'Address Two','Service Two','Message Two','builder-preview','funnel-a'
);

-- Phone-only, email-only, same-contact, and neither-match cases.
select public.create_internal_crm_lead('10000000-0000-4000-8000-000000000003','Phone Match','5555551001',null,null,'Phone',null,'internal',null);
select public.create_internal_crm_lead('10000000-0000-4000-8000-000000000004','Email Match',null,'email-only@example.test',null,'Email',null,'internal',null);
select public.create_internal_crm_lead('10000000-0000-4000-8000-000000000005','New Identity','5555551003','new-identity@example.test',null,'New',null,'internal',null);

do $$
declare before_contacts bigint; before_opportunities bigint;
begin
  select count(*) into before_contacts from public.contacts;
  select count(*) into before_opportunities from public.opportunities;
  begin
    perform public.create_internal_crm_lead(
      '10000000-0000-4000-8000-000000000006','Conflict','5555551001','email-only@example.test',
      null,'Conflict',null,'internal',null
    );
    raise exception 'conflicting identity unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'conflicting contact identity' then raise; end if;
  end;
  if (select count(*) from public.contacts) <> before_contacts
     or (select count(*) from public.opportunities) <> before_opportunities then
    raise exception 'identity conflict left partial records';
  end if;
end $$;

do $$
declare before_contacts bigint; before_opportunities bigint;
begin
  select count(*) into before_contacts from public.contacts;
  select count(*) into before_opportunities from public.opportunities;
  begin
    perform public.create_internal_crm_lead('10000000-0000-4000-8000-000000000007','Wrong Funnel',null,'wrong-funnel@example.test',null,null,null,'internal','funnel-b');
    raise exception 'cross-tenant funnel unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.contacts) <> before_contacts
     or (select count(*) from public.opportunities) <> before_opportunities then
    raise exception 'cross-tenant funnel rejection left partial records';
  end if;
end $$;

do $$ begin
  begin
    perform public.create_internal_crm_lead('10000000-0000-4000-8000-000000000008','Missing Funnel',null,'missing-funnel@example.test',null,null,null,'internal','missing-funnel');
    raise exception 'missing funnel unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'funnel unavailable' then raise; end if;
  end;
end $$;
reset role;

do $$
declare first_contact text; first_opportunity text;
begin
  if exists (
    select 1 from public.internal_crm_lead_requests
    where request_key in (
      '10000000-0000-4000-8000-000000000006',
      '10000000-0000-4000-8000-000000000007',
      '10000000-0000-4000-8000-000000000008'
    )
  ) then raise exception 'rejected request left inquiry history'; end if;
  if (select count(*) from public.internal_crm_lead_requests where request_key='10000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'idempotent replay duplicated inquiry history';
  end if;
  if not exists (
    select 1 from public.internal_crm_lead_requests
    where request_key='10000000-0000-4000-8000-000000000001'
      and inquiry_address='Address One' and inquiry_service_type='Service One'
      and inquiry_message='Message One' and inquiry_source='builder-preview'
      and inquiry_funnel_id='funnel-a'
  ) then raise exception 'first inquiry details were not preserved'; end if;
  if not exists (
    select 1 from public.internal_crm_lead_requests
    where request_key='10000000-0000-4000-8000-000000000002'
      and inquiry_address='Address Two' and inquiry_service_type='Service Two'
      and inquiry_message='Message Two'
  ) then raise exception 'repeat inquiry details were not preserved'; end if;
  select contact_id, opportunity_id into first_contact, first_opportunity
  from public.internal_crm_lead_requests where request_key='10000000-0000-4000-8000-000000000001';
  if not exists (
    select 1 from public.internal_crm_lead_requests
    where request_key='10000000-0000-4000-8000-000000000002'
      and contact_id=first_contact and opportunity_id=first_opportunity and is_repeat
  ) then raise exception 'repeat inquiry did not reuse the contact and open opportunity'; end if;
  if (select contact_id from public.internal_crm_lead_requests where request_key='10000000-0000-4000-8000-000000000003') <> 'identity-phone' then
    raise exception 'phone-only identity match failed';
  end if;
  if (select contact_id from public.internal_crm_lead_requests where request_key='10000000-0000-4000-8000-000000000004') <> 'identity-email' then
    raise exception 'email-only identity match failed';
  end if;
end $$;

-- Tenant B's identifiers must not affect tenant A matching.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select public.create_internal_crm_lead(
  '10000000-0000-4000-8000-000000000009','Tenant Isolation','5555550202','tenant-isolation@example.test',
  null,'Isolation',null,'internal',null
);
reset role;
do $$ begin
  if (select user_id from public.internal_crm_lead_requests where request_key='10000000-0000-4000-8000-000000000009')
     <> '11111111-1111-4111-8111-111111111111' then
    raise exception 'cross-tenant identity interfered';
  end if;
end $$;
