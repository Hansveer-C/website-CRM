do $$ begin
  if has_function_privilege('anon', 'public.save_crm_quote(uuid,text,text,text,text,jsonb)', 'execute') then
    raise exception 'anon can execute hardened quote RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.save_crm_quote(uuid,text,text,text,text,jsonb)', 'execute') then
    raise exception 'authenticated cannot execute hardened quote RPC';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
declare before_quotes bigint; before_items bigint; before_value numeric;
begin
  select count(*) into before_quotes from public.quotes;
  select count(*) into before_items from public.quote_items;
  select value into before_value from public.opportunities where id='opportunity-a';

  begin
    perform public.save_crm_quote(
      '30000000-0000-4000-8000-000000000001','contact-a','opportunity-a','basic','standard only',
      '[{"service_name":"Standard wash","quantity":1,"unit_price":200,"tier":"standard"}]'::jsonb
    );
    raise exception 'standard-only Basic selection unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'selected tier requires at least one item' then raise; end if;
  end;

  begin
    perform public.save_crm_quote(
      '30000000-0000-4000-8000-000000000002','contact-a','opportunity-a','basic','premium only',
      '[{"service_name":"Premium wash","quantity":1,"unit_price":300,"tier":"premium"}]'::jsonb
    );
    raise exception 'premium-only Basic selection unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'selected tier requires at least one item' then raise; end if;
  end;

  begin
    perform public.save_crm_quote(
      '30000000-0000-4000-8000-000000000003','contact-a','opportunity-a','basic','no basic',
      '[{"service_name":"Standard wash","quantity":1,"unit_price":200,"tier":"standard"},{"service_name":"Premium wash","quantity":1,"unit_price":300,"tier":"premium"}]'::jsonb
    );
    raise exception 'standard-plus-premium Basic selection unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'selected tier requires at least one item' then raise; end if;
  end;

  begin
    perform public.save_crm_quote(
      '30000000-0000-4000-8000-000000000004','contact-a','opportunity-a','basic','invalid basic',
      '[{"service_name":"","quantity":1,"unit_price":100,"tier":"basic"}]'::jsonb
    );
    raise exception 'invalid Basic item unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'invalid service name' then raise; end if;
  end;

  if (select count(*) from public.quotes) <> before_quotes
     or (select count(*) from public.quote_items) <> before_items
     or (select value from public.opportunities where id='opportunity-a') <> before_value then
    raise exception 'tier validation failure changed durable quote or opportunity state';
  end if;
end $$;

select public.save_crm_quote(
  '30000000-0000-4000-8000-000000000005','contact-a','opportunity-a','basic','basic and standard',
  '[{"service_name":"Basic wash","quantity":2,"unit_price":125,"tier":"basic"},{"service_name":"Standard wash","quantity":1,"unit_price":400,"tier":"standard"}]'::jsonb
);

do $$ begin
  if not exists (
    select 1 from public.quotes
    where request_key='30000000-0000-4000-8000-000000000005'
      and selected_tier='basic' and total_amount=250
  ) then raise exception 'Basic-selected quote total is inconsistent'; end if;
  if (select value from public.opportunities where id='opportunity-a') <> 250 then
    raise exception 'linked opportunity value does not match Basic total';
  end if;
end $$;

select public.save_crm_quote(
  '30000000-0000-4000-8000-000000000006','contact-a','opportunity-a','basic','all tiers',
  '[{"service_name":"Basic wash","quantity":1,"unit_price":175,"tier":"basic"},{"service_name":"Standard wash","quantity":1,"unit_price":425,"tier":"standard"},{"service_name":"Premium wash","quantity":1,"unit_price":800,"tier":"premium"}]'::jsonb
);

do $$ begin
  if not exists (
    select 1 from public.quotes
    where request_key='30000000-0000-4000-8000-000000000006'
      and selected_tier='basic' and total_amount=175
  ) then raise exception 'all-tier quote selected total is inconsistent'; end if;
  if (select value from public.opportunities where id='opportunity-a') <> 175 then
    raise exception 'all-tier opportunity value is inconsistent';
  end if;
end $$;

select public.save_crm_quote(
  '30000000-0000-4000-8000-000000000006','contact-a','opportunity-a','basic','all tiers',
  '[{"service_name":"Basic wash","quantity":1,"unit_price":175,"tier":"basic"},{"service_name":"Standard wash","quantity":1,"unit_price":425,"tier":"standard"},{"service_name":"Premium wash","quantity":1,"unit_price":800,"tier":"premium"}]'::jsonb
);

do $$ begin
  if (select count(*) from public.quotes where request_key='30000000-0000-4000-8000-000000000006') <> 1 then
    raise exception 'quote retry duplicated the quote';
  end if;
  if (select count(*) from public.quote_items where quote_id=(select id from public.quotes where request_key='30000000-0000-4000-8000-000000000006')) <> 3 then
    raise exception 'quote retry duplicated items';
  end if;
end $$;

reset role;
