set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

select public.save_crm_quote(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'contact-a', 'opportunity-a', 'basic', 'terms',
  '[{"service_name":"House wash","description":"Exterior","quantity":2,"unit_price":125,"tier":"basic"},{"service_name":"Premium seal","description":"Optional","quantity":1,"unit_price":400,"tier":"premium"}]'::jsonb
);

do $$ begin
  if (select count(*) from public.quotes) <> 1 then raise exception 'quote was not persisted'; end if;
  if (select count(*) from public.quote_items) <> 2 then raise exception 'quote items were not persisted'; end if;
  if (select total_amount from public.quotes limit 1) <> 250 then raise exception 'selected tier total is wrong'; end if;
  if (select value from public.opportunities where id='opportunity-a') <> 250 then raise exception 'opportunity update was not atomic'; end if;
end $$;

select public.save_crm_quote(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'contact-a', 'opportunity-a', 'basic', 'terms',
  '[{"service_name":"House wash","description":"Exterior","quantity":2,"unit_price":125,"tier":"basic"},{"service_name":"Premium seal","description":"Optional","quantity":1,"unit_price":400,"tier":"premium"}]'::jsonb
);
do $$ begin if (select count(*) from public.quotes) <> 1 then raise exception 'quote retry duplicated rows'; end if; end $$;

do $$ begin
  begin
    perform public.save_crm_quote('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','contact-b',null,'basic','', '[{"service_name":"Invalid","quantity":1,"unit_price":1,"tier":"basic"}]'::jsonb);
    raise exception 'cross-tenant quote unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
  if (select count(*) from public.quotes) <> 1 then raise exception 'failed quote did not roll back'; end if;
end $$;

select public.create_internal_crm_lead(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',' New   Lead ','(555) 555-0303','NEW@EXAMPLE.TEST','123 Main','House wash','Please call','internal','funnel-a'
);
do $$ declare v_contact text; begin
  select id into v_contact from public.contacts where email='new@example.test';
  if v_contact is null then raise exception 'durable lead contact missing'; end if;
  if not exists(select 1 from public.contacts where id=v_contact and phone='+15555550303' and email='new@example.test') then raise exception 'normalized contact missing'; end if;
  if not exists(select 1 from public.opportunities where contact_id=v_contact and user_id='11111111-1111-4111-8111-111111111111') then raise exception 'linked opportunity missing'; end if;
end $$;

select public.create_internal_crm_lead(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',' New   Lead ','(555) 555-0303','NEW@EXAMPLE.TEST','123 Main','House wash','Please call','internal','funnel-a'
);
do $$ begin
  if (select count(*) from public.contacts where email='new@example.test') <> 1 then raise exception 'lead retry duplicated contacts'; end if;
  if (select count(*) from public.opportunities where contact_id=(select id from public.contacts where email='new@example.test')) <> 1 then raise exception 'lead retry duplicated opportunities'; end if;
end $$;

do $$ declare before_count bigint; begin
  select count(*) into before_count from public.contacts;
  begin
    perform public.create_internal_crm_lead('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Rollback Lead','5555550404','rollback@example.test',null,null,null,'internal','missing-funnel');
    raise exception 'invalid funnel unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.contacts) <> before_count then raise exception 'lead transaction left a partial contact'; end if;
end $$;

reset role;
set role anon;
do $$ begin
  begin
    perform public.save_crm_quote('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','contact-a',null,'basic','', '[{"service_name":"Denied","quantity":1,"unit_price":1,"tier":"basic"}]'::jsonb);
    raise exception 'anon quote RPC unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_internal_crm_lead('ffffffff-ffff-4fff-8fff-ffffffffffff','Denied');
    raise exception 'anon lead RPC unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$ begin
  if exists(select 1 from public.quotes) then raise exception 'tenant B can read tenant A quotes'; end if;
  if exists(select 1 from public.quote_items) then raise exception 'tenant B can read tenant A quote items'; end if;
end $$;
reset role;
