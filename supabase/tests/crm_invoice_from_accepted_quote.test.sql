-- Run after crm_transactions_bootstrap.sql, the quote migrations, and
-- crm_quote_acceptance.test.sql prerequisites have been applied.

insert into public.quotes (id, user_id, contact_id, opportunity_id, request_key, request_fingerprint, status, total_amount, selected_tier)
values
  ('91000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'contact-a', 'opportunity-a', '91000000-0000-4000-8000-000000000011', 'invoice-fixture', 'sent', 250, 'basic'),
  ('91000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'contact-a', null, '91000000-0000-4000-8000-000000000012', 'unaccepted-fixture', 'approved', 10, 'basic'),
  ('91000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'contact-a', null, '91000000-0000-4000-8000-000000000013', 'sent-fixture', 'sent', 10, 'basic'),
  ('91000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'contact-a', null, '91000000-0000-4000-8000-000000000014', 'mismatch-fixture', 'sent', 25, 'basic'),
  ('92000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'contact-b', 'opportunity-b', '92000000-0000-4000-8000-000000000011', 'tenant-b-fixture', 'sent', 75, 'basic');

insert into public.quote_items (user_id, quote_id, service_name, description, quantity, unit_price, tier, order_index)
values
  ('11111111-1111-4111-8111-111111111111', '91000000-0000-4000-8000-000000000001', 'Basic wash', 'Accepted basic service', 1, 250, 'basic', 0),
  ('11111111-1111-4111-8111-111111111111', '91000000-0000-4000-8000-000000000001', 'Premium wash', 'Must not be invoiced', 1, 999, 'premium', 1),
  ('11111111-1111-4111-8111-111111111111', '91000000-0000-4000-8000-000000000004', 'Mismatch wash', '', 1, 25, 'basic', 0),
  ('22222222-2222-4222-8222-222222222222', '92000000-0000-4000-8000-000000000001', 'Tenant B wash', '', 1, 75, 'basic', 0);

update public.contacts set address = '10 Accepted Quote Lane' where id = 'contact-a';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select public.accept_crm_quote('91000000-0000-4000-8000-000000000001', 1, '91000000-0000-4000-8000-000000000021', 'Morgan Taylor', null, true);
select public.accept_crm_quote('91000000-0000-4000-8000-000000000004', 1, '91000000-0000-4000-8000-000000000022', 'Morgan Taylor', null, true);

do $$
declare
  v_created jsonb;
  v_replayed jsonb;
  v_opportunity_value numeric;
begin
  select value into v_opportunity_value from public.opportunities where id = 'opportunity-a';
  select public.create_invoice_from_accepted_quote(
    '91000000-0000-4000-8000-000000000001', 1, '91000000-0000-4000-8000-000000000031'
  ) into v_created;
  if coalesce(v_created -> 'invoice' ->> 'status', '') <> 'issued'
     or (v_created -> 'invoice' ->> 'invoice_number')::bigint <> 1
     or (v_created -> 'invoice' ->> 'total_amount')::numeric <> 250
     or coalesce(v_created -> 'invoice' ->> 'currency', '') <> 'USD'
     or coalesce(v_created -> 'invoice' ->> 'customer_name', '') <> 'Owner A'
     or coalesce(v_created -> 'invoice' ->> 'billing_address', '') <> '10 Accepted Quote Lane'
     or coalesce(v_created -> 'invoice' ->> 'source_quote_revision', '') <> '1'
     or (v_created -> 'invoice' ->> 'issued_at') is null
     or (v_created -> 'invoice' ->> 'due_at') is null then
    raise exception 'accepted quote invoice snapshot was not persisted';
  end if;
  if jsonb_array_length(v_created -> 'items') <> 1
     or coalesce(v_created -> 'items' -> 0 ->> 'service_name', '') <> 'Basic wash'
     or (v_created -> 'items' -> 0 ->> 'line_total')::numeric <> 250 then
    raise exception 'invoice did not contain exactly the accepted selected-tier item';
  end if;
  if (select value from public.opportunities where id = 'opportunity-a') <> v_opportunity_value then
    raise exception 'invoice creation changed opportunity state';
  end if;
  select public.create_invoice_from_accepted_quote(
    '91000000-0000-4000-8000-000000000001', 1, '91000000-0000-4000-8000-000000000031'
  ) into v_replayed;
  if coalesce(v_replayed ->> 'replayed', '') <> 'true'
     or v_replayed -> 'invoice' ->> 'id' <> v_created -> 'invoice' ->> 'id' then
    raise exception 'exact invoice retry did not return the original invoice';
  end if;
  select public.create_invoice_from_accepted_quote(
    '91000000-0000-4000-8000-000000000001', 1, '91000000-0000-4000-8000-000000000032'
  ) into v_replayed;
  if coalesce(v_replayed ->> 'replayed', '') <> 'true'
     or v_replayed -> 'invoice' ->> 'id' <> v_created -> 'invoice' ->> 'id'
     or (select count(*) from public.invoices where quote_id = '91000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'independent invoice conversion duplicated an invoice';
  end if;
end $$;

do $$
begin
  begin
    perform public.create_invoice_from_accepted_quote('91000000-0000-4000-8000-000000000001', 2, '91000000-0000-4000-8000-000000000031');
    raise exception 'mismatched request-key reuse unexpectedly succeeded';
  exception when unique_violation then
    if sqlerrm <> 'request key was already used' then raise; end if;
  end;
  begin
    perform public.create_invoice_from_accepted_quote('91000000-0000-4000-8000-000000000001', 2, '91000000-0000-4000-8000-000000000033');
    raise exception 'accepted revision conflict unexpectedly succeeded';
  exception when serialization_failure then
    if sqlerrm <> 'accepted quote revision conflict' then raise; end if;
  end;
  begin
    perform public.create_invoice_from_accepted_quote('91000000-0000-4000-8000-000000000002', 1, '91000000-0000-4000-8000-000000000034');
    raise exception 'unaccepted quote unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'quote acceptance unavailable' then raise; end if;
  end;
  begin
    perform public.create_invoice_from_accepted_quote('91000000-0000-4000-8000-000000000003', 1, '91000000-0000-4000-8000-000000000035');
    raise exception 'non-approved quote unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'quote is not approved' then raise; end if;
  end;
end $$;

reset role;
set role service_role;
update public.quote_acceptances set accepted_total_amount = 26
where quote_id = '91000000-0000-4000-8000-000000000004';
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
begin
  begin
    perform public.create_invoice_from_accepted_quote('91000000-0000-4000-8000-000000000004', 1, '91000000-0000-4000-8000-000000000036');
    raise exception 'accepted-total mismatch unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'accepted total does not match selected items' then raise; end if;
  end;
  begin
    update public.invoice_items set service_name = 'mutated' where invoice_id = (select id from public.invoices where quote_id = '91000000-0000-4000-8000-000000000001');
    raise exception 'authenticated invoice item update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
begin
  begin
    perform public.create_invoice_from_accepted_quote('91000000-0000-4000-8000-000000000001', 1, '92000000-0000-4000-8000-000000000031');
    raise exception 'cross-tenant invoice creation unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'quote unavailable' then raise; end if;
  end;
end $$;
select public.accept_crm_quote('92000000-0000-4000-8000-000000000001', 1, '92000000-0000-4000-8000-000000000021', 'Tenant B', null, true);
select public.create_invoice_from_accepted_quote('92000000-0000-4000-8000-000000000001', 1, '92000000-0000-4000-8000-000000000031');

reset role;
set role service_role;
do $$
begin
  if (select invoice_number from public.invoices where quote_id = '92000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'tenant-scoped invoice numbering did not restart per tenant';
  end if;
  if (select count(*) from public.invoices where quote_id = '91000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'at-most-one invoice constraint failed';
  end if;
end $$;
reset role;

set role anon;
do $$
begin
  begin
    perform public.create_invoice_from_accepted_quote('91000000-0000-4000-8000-000000000001', 1, '91000000-0000-4000-8000-000000000037');
    raise exception 'anon invoice creation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'crm_invoice_from_accepted_quote: ok' as result;
