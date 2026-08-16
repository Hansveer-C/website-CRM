begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.provision_application_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    raise exception using
      errcode = '23502',
      message = 'Auth user email is required';
  end if;

  insert into public.users (id, email, password_hash)
  values (new.id::text, lower(btrim(new.email)), '$supabase-auth-managed$')
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.provision_application_user() from public, anon, authenticated;

create trigger provision_application_user_after_auth_signup
after insert on auth.users
for each row execute function private.provision_application_user();

commit;
