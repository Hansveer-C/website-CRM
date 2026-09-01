-- Run after crm_transactions_bootstrap.sql and
-- 20260901090000_create_tenant_business_identity.sql.

set role service_role;
insert into public.tenant_business_identities (
  user_id, business_name, phone, email, logo_url, primary_color
) values
  ('11111111-1111-4111-8111-111111111111', 'Tenant A Wash', '+16045550100', 'a@example.test', 'https://cdn.example/a.png', '#123456'),
  ('22222222-2222-4222-8222-222222222222', 'Tenant B Wash', '', '', '', '')
on conflict (user_id) do update set business_name = excluded.business_name;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
begin
  if (select business_name from public.tenant_business_identities where user_id = current_setting('request.jwt.claim.sub', true)) <> 'Tenant A Wash' then
    raise exception 'tenant owner could not read its business identity';
  end if;
  if exists (select 1 from public.tenant_business_identities where user_id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'tenant A could read tenant B business identity';
  end if;
  update public.tenant_business_identities set phone = '+16045550101'
  where user_id = current_setting('request.jwt.claim.sub', true);
  if (select phone from public.tenant_business_identities where user_id = current_setting('request.jwt.claim.sub', true)) <> '+16045550101' then
    raise exception 'tenant owner could not update its business identity';
  end if;
  begin
    update public.tenant_business_identities set business_name = 'cross-tenant mutation'
    where user_id = '22222222-2222-4222-8222-222222222222';
    if found then raise exception 'cross-tenant update unexpectedly succeeded'; end if;
  end;
  begin
    update public.tenant_business_identities set user_id = '22222222-2222-4222-8222-222222222222'
    where user_id = current_setting('request.jwt.claim.sub', true);
    raise exception 'owner reassignment unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
do $$
begin
  begin
    insert into public.tenant_business_identities (user_id, business_name)
    values ('33333333-3333-4333-8333-333333333333', ' ');
    raise exception 'blank business name unexpectedly succeeded';
  exception when check_violation then null;
  end;
end $$;
reset role;

set role anon;
do $$
begin
  begin
    perform 1 from public.tenant_business_identities limit 1;
    raise exception 'anonymous identity read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tenant_business_identities (user_id, business_name)
    values ('11111111-1111-4111-8111-111111111111', 'Anon');
    raise exception 'anonymous identity write unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'tenant_business_identity: ok' as result;
