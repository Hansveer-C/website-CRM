do $$
begin
  if has_function_privilege('anon', 'public.save_crm_quote(uuid,text,text,text,text,jsonb)', 'execute') then
    raise exception 'anon can execute non-finite-hardened quote RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.save_crm_quote(uuid,text,text,text,text,jsonb)', 'execute') then
    raise exception 'authenticated cannot execute non-finite-hardened quote RPC';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

create or replace function pg_temp.assert_invalid_quote(p_key uuid, p_items jsonb)
returns void language plpgsql as $$
declare
  v_quote_count bigint;
  v_item_count bigint;
  v_opportunity_value numeric;
begin
  select count(*) into v_quote_count from public.quotes;
  select count(*) into v_item_count from public.quote_items;
  select value into v_opportunity_value from public.opportunities where id = 'opportunity-a';
  begin
    perform public.save_crm_quote(p_key, 'contact-a', 'opportunity-a', 'basic', 'invalid numeric', p_items);
    raise exception 'invalid quote unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm not in ('invalid item amount', 'invalid quote total') then raise; end if;
  end;
  if (select count(*) from public.quotes) <> v_quote_count
     or (select count(*) from public.quote_items) <> v_item_count
     or (select value from public.opportunities where id = 'opportunity-a') is distinct from v_opportunity_value
     or exists (select 1 from public.quotes where request_key = p_key) then
    raise exception 'invalid numeric request changed durable state';
  end if;
end;
$$;

select public.save_crm_quote(
  '40000000-0000-4000-8000-000000000001', 'contact-a', 'opportunity-a', 'basic', 'normal',
  '[{"service_name":"Normal","quantity":2,"unit_price":125.50,"tier":"basic"}]'::jsonb
);
select public.save_crm_quote(
  '40000000-0000-4000-8000-000000000002', 'contact-a', 'opportunity-a', 'basic', 'zero price',
  '[{"service_name":"Free","quantity":1,"unit_price":0,"tier":"basic"}]'::jsonb
);
select public.save_crm_quote(
  '40000000-0000-4000-8000-000000000003', 'contact-a', 'opportunity-a', 'basic', 'fractional',
  '[{"service_name":"Fractional","quantity":0.5,"unit_price":10,"tier":"basic"}]'::jsonb
);
select public.save_crm_quote(
  '40000000-0000-4000-8000-000000000004', 'contact-a', 'opportunity-a', 'basic', 'max boundary',
  '[{"service_name":"Maximum","quantity":1,"unit_price":9999999999.99,"tier":"basic"}]'::jsonb
);

select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000005', '[{"service_name":"Bad","quantity":"NaN","unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000006', '[{"service_name":"Bad","quantity":1,"unit_price":"NaN","tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000007', '[{"service_name":"Bad","quantity":"Infinity","unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000008', '[{"service_name":"Bad","quantity":1,"unit_price":"Infinity","tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000009', '[{"service_name":"Bad","quantity":"-Infinity","unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000010', '[{"service_name":"Bad","quantity":1,"unit_price":"-Infinity","tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000011', '[{"service_name":"Bad","quantity":"abc","unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000012', '[{"service_name":"Bad","quantity":null,"unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000013', '[{"service_name":"Bad","quantity":"","unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000014', '[{"service_name":"Bad","quantity":-1,"unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000015', '[{"service_name":"Bad","quantity":1,"unit_price":-1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000016', '[{"service_name":"Bad","quantity":0,"unit_price":1,"tier":"basic"}]');
select pg_temp.assert_invalid_quote('40000000-0000-4000-8000-000000000017', '[{"service_name":"Bad","quantity":9999999999.99,"unit_price":2,"tier":"basic"}]');

select public.save_crm_quote(
  '40000000-0000-4000-8000-000000000001', 'contact-a', 'opportunity-a', 'basic', 'normal',
  '[{"service_name":"Normal","quantity":2,"unit_price":125.50,"tier":"basic"}]'::jsonb
);

do $$
begin
  if (select count(*) from public.quotes where request_key = '40000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'valid idempotent retry duplicated quote state';
  end if;
  if exists (select 1 from public.quotes where total_amount in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)) then
    raise exception 'non-finite quote total persisted';
  end if;
  if exists (select 1 from public.quote_items where quantity in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) or unit_price in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)) then
    raise exception 'non-finite quote item persisted';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
begin
  begin
    perform public.save_crm_quote(
      '40000000-0000-4000-8000-000000000018', 'contact-a', 'opportunity-a', 'basic', 'cross tenant',
      '[{"service_name":"Denied","quantity":1,"unit_price":1,"tier":"basic"}]'::jsonb
    );
    raise exception 'cross-tenant quote unexpectedly succeeded';
  exception when foreign_key_violation then
    if sqlerrm <> 'contact is unavailable' then raise; end if;
  end;
end;
$$;

reset role;
select 'crm_quote_nonfinite_hardening: ok' as result;
