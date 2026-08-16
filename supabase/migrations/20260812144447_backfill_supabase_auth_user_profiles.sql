begin;

-- Freeze both identity sources while validating and backfilling. This prevents a
-- concurrent signup/profile insert from invalidating the collision preflight.
lock table auth.users in share mode;
lock table public.users in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from auth.users auth_user
    join public.users application_user
      on lower(btrim(application_user.email)) = lower(btrim(auth_user.email))
     and application_user.id <> auth_user.id::text
    where nullif(btrim(auth_user.email), '') is not null
  ) then
    raise exception using
      errcode = '23505',
      message = 'Supabase Auth profile backfill found an email identity collision';
  end if;

  if exists (
    select 1
    from auth.users auth_user
    left join public.users application_user on application_user.id = auth_user.id::text
    where application_user.id is null
      and nullif(btrim(auth_user.email), '') is null
  ) then
    raise exception using
      errcode = '23502',
      message = 'Supabase Auth profile backfill requires a usable email';
  end if;
end;
$$;

insert into public.users (id, email, password_hash)
select
  auth_user.id::text,
  lower(btrim(auth_user.email)),
  '$supabase-auth-managed$'
from auth.users auth_user
left join public.users application_user on application_user.id = auth_user.id::text
where application_user.id is null
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from auth.users auth_user
    left join public.users application_user on application_user.id = auth_user.id::text
    where application_user.id is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Supabase Auth profile backfill did not establish the required identity invariant';
  end if;
end;
$$;

commit;
