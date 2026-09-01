-- Canonical tenant-level commercial identity for future immutable documents.
-- Website settings remain website-scoped presentation settings and are never
-- selected as an issuer at document-generation time.

create table public.tenant_business_identities (
  user_id text primary key references public.users(id) on delete cascade,
  business_name text not null check (length(btrim(business_name)) between 1 and 200),
  phone text not null default '' check (length(phone) <= 50),
  email text not null default '' check (
    length(email) <= 320
    and (email = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
  ),
  logo_url text not null default '' check (
    length(logo_url) <= 2048
    and (logo_url = '' or logo_url ~ '^https?://[^[:space:]"<>]+$')
  ),
  primary_color text not null default '' check (
    primary_color = '' or primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create function public.set_tenant_business_identity_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create trigger set_tenant_business_identity_updated_at
before update on public.tenant_business_identities
for each row execute function public.set_tenant_business_identity_updated_at();

comment on table public.tenant_business_identities is
  'Canonical mutable tenant business identity. Future formal document artifacts must snapshot this server-side; website settings are not an issuer authority.';

alter table public.tenant_business_identities enable row level security;

create policy tenant_business_identities_owner_select
on public.tenant_business_identities
for select to authenticated
using (user_id = (select auth.uid())::text);

create policy tenant_business_identities_owner_insert
on public.tenant_business_identities
for insert to authenticated
with check (user_id = (select auth.uid())::text);

create policy tenant_business_identities_owner_update
on public.tenant_business_identities
for update to authenticated
using (user_id = (select auth.uid())::text)
with check (user_id = (select auth.uid())::text);

revoke all on table public.tenant_business_identities from public, anon, authenticated;
grant select, insert, update on table public.tenant_business_identities to authenticated;
grant all on table public.tenant_business_identities to service_role;
revoke all on function public.set_tenant_business_identity_updated_at() from public, anon, authenticated;

-- Existing website settings can seed this table only where there is exactly
-- one usable settings row for a tenant. A tenant with multiple websites is
-- intentionally left incomplete: choosing one site as the legal issuer would
-- be an unsupported guess.
with unambiguous_settings as (
  select
    ws.user_id,
    min(btrim(ws.business_name)) as business_name,
    min(coalesce(ws.phone, '')) as phone,
    min(coalesce(ws.email, '')) as email,
    min(coalesce(ws.logo_url, '')) as logo_url,
    min(coalesce(ws.primary_color, '')) as primary_color
  from public.website_settings ws
  where ws.user_id is not null
  group by ws.user_id
  having count(*) = 1
     and length(min(btrim(ws.business_name))) between 1 and 200
     and length(min(coalesce(ws.phone, ''))) <= 50
     and length(min(coalesce(ws.email, ''))) <= 320
     and (min(coalesce(ws.email, '')) = '' or min(coalesce(ws.email, '')) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
     and length(min(coalesce(ws.logo_url, ''))) <= 2048
     and (min(coalesce(ws.logo_url, '')) = '' or min(coalesce(ws.logo_url, '')) ~ '^https?://[^[:space:]"<>]+$')
     and (min(coalesce(ws.primary_color, '')) = '' or min(coalesce(ws.primary_color, '')) ~ '^#[0-9A-Fa-f]{6}$')
)
insert into public.tenant_business_identities (
  user_id, business_name, phone, email, logo_url, primary_color
)
select user_id, business_name, phone, email, logo_url, primary_color
from unambiguous_settings
on conflict (user_id) do nothing;
