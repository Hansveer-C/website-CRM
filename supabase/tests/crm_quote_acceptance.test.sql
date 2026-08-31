do $$
begin
  if has_function_privilege('anon', 'public.accept_crm_quote(uuid,integer,uuid,text,text,boolean)', 'execute') then
    raise exception 'anon can execute quote acceptance RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.accept_crm_quote(uuid,integer,uuid,text,text,boolean)', 'execute') then
    raise exception 'authenticated cannot execute quote acceptance RPC';
  end if;
end $$;

insert into public.quotes (id, user_id, contact_id, request_key, request_fingerprint, status, total_amount, selected_tier)
values
  ('90000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'contact-a', '90000000-0000-4000-8000-000000000020', 'fixture-stale', 'sent', 99, 'basic'),
  ('90000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'contact-a', '90000000-0000-4000-8000-000000000021', 'fixture-invalid', 'sent', 99, 'basic'),
  ('90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'contact-a', '90000000-0000-4000-8000-000000000010', 'fixture', 'sent', 250, 'basic');
insert into public.quote_items (user_id, quote_id, service_name, quantity, unit_price, tier, order_index)
values ('11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000001', 'House wash', 1, 250, 'basic', 0);

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
begin
  begin
    perform public.accept_crm_quote('90000000-0000-4000-8000-000000000002', 2, '90000000-0000-4000-8000-000000000022', 'Morgan Taylor', null, true);
    raise exception 'stale quote revision unexpectedly succeeded';
  exception when serialization_failure then
    if sqlerrm <> 'quote revision conflict' then raise; end if;
  end;
  begin
    perform public.accept_crm_quote('90000000-0000-4000-8000-000000000003', 1, '90000000-0000-4000-8000-000000000023', 'Morgan Taylor', null, false);
    raise exception 'missing signature unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'signature evidence is required' then raise; end if;
  end;
  if exists (select 1 from public.quotes where id in ('90000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000003') and status <> 'sent') then
    raise exception 'failed acceptance changed quote state';
  end if;
end $$;

select public.accept_crm_quote(
  '90000000-0000-4000-8000-000000000001', 1, '90000000-0000-4000-8000-000000000011',
  'Morgan Taylor', 'data:image/png;base64,iVBORw0KGgo=', false
);

do $$
begin
  if not exists (select 1 from public.quotes where id = '90000000-0000-4000-8000-000000000001' and status = 'approved' and revision = 2 and accepted_at is not null) then
    raise exception 'quote acceptance state was not persisted';
  end if;
end $$;

select public.accept_crm_quote(
  '90000000-0000-4000-8000-000000000001', 1, '90000000-0000-4000-8000-000000000011',
  'Morgan Taylor', 'data:image/png;base64,iVBORw0KGgo=', false
);
do $$ begin
  if (select revision from public.quotes where id = '90000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'replay changed accepted quote state';
  end if;
end $$;

do $$
begin
  begin
    perform public.accept_crm_quote('90000000-0000-4000-8000-000000000001', 2, '90000000-0000-4000-8000-000000000012', 'Morgan Taylor', null, true);
    raise exception 'already accepted quote unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'quote already accepted' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
begin
  begin
    perform public.accept_crm_quote('90000000-0000-4000-8000-000000000001', 2, '90000000-0000-4000-8000-000000000013', 'Tenant B', null, true);
    raise exception 'cross-tenant acceptance unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'quote unavailable' then raise; end if;
  end;
end $$;
reset role;

set role service_role;
do $$
begin
  if not exists (select 1 from public.quote_acceptances where quote_id = '90000000-0000-4000-8000-000000000001' and accepted_total_amount = 250 and quote_revision = 1 and signature_kind = 'drawn' and accepted_at is not null) then
    raise exception 'acceptance evidence was not persisted';
  end if;
  if (select count(*) from public.quote_acceptances where quote_id = '90000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'replay duplicated acceptance evidence';
  end if;
end $$;
reset role;

set role anon;
do $$
begin
  begin
    perform public.accept_crm_quote('90000000-0000-4000-8000-000000000001', 1, '90000000-0000-4000-8000-000000000024', 'Anon', null, true);
    raise exception 'anon acceptance unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'crm_quote_acceptance: ok' as result;
