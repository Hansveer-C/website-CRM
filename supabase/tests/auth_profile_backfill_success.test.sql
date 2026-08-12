do $$
begin
  if (select count(*) from public.users) <> 5 then
    raise exception 'backfill did not insert exactly the two missing profiles';
  end if;
  if exists (
    select 1 from auth.users auth_user
    left join public.users application_user on application_user.id = auth_user.id::text
    where application_user.id is null
  ) then raise exception 'an Auth identity is still missing its public profile'; end if;
  if not exists (
    select 1 from public.users
    where id = '22222222-2222-4222-8222-222222222222'
      and email = 'missing-one@example.test'
      and password_hash = '$supabase-auth-managed$'
  ) then raise exception 'missing profile was not normalized or did not use the managed sentinel'; end if;
  if not exists (
    select 1 from public.users
    where id = '33333333-3333-4333-8333-333333333333'
      and password_hash = '$supabase-auth-managed$'
  ) then raise exception 'second missing profile was not inserted'; end if;
  if not exists (
    select 1 from public.users
    where id = '11111111-1111-4111-8111-111111111111'
      and password_hash = 'existing-legitimate-hash'
      and display_name = 'Existing Auth Profile'
  ) then raise exception 'existing matching profile was modified'; end if;
  if not exists (
    select 1 from public.users
    where id = '99999999-9999-4999-8999-999999999999'
      and email = 'legacy-only@example.test'
      and password_hash = 'legacy-hash'
      and display_name = 'Legacy Only'
  ) then raise exception 'unrelated legacy profile was modified'; end if;
  if not exists (
    select 1 from public.owned_records
    where id = 'owned-before-backfill'
      and user_id = '11111111-1111-4111-8111-111111111111'
      and payload = 'must remain unchanged'
  ) then raise exception 'existing foreign-key-owned data was modified'; end if;
end;
$$;

insert into auth.users (id, email)
values ('55555555-5555-4555-8555-555555555555', '  FUTURE@EXAMPLE.TEST  ');

do $$
begin
  if not exists (
    select 1 from public.users
    where id = '55555555-5555-4555-8555-555555555555'
      and email = 'future@example.test'
      and password_hash = '$supabase-auth-managed$'
  ) then raise exception 'existing provisioning trigger no longer provisions future Auth users'; end if;
  if (select count(*) from pg_trigger where tgname = 'provision_application_user_after_auth_signup' and not tgisinternal) <> 1 then
    raise exception 'provisioning trigger was replaced or duplicated';
  end if;
end;
$$;

select 'auth_profile_backfill_success: ok' as result;
