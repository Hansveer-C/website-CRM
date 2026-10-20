-- Tenant-owned service properties are distinct from contact billing/mailing addresses.
-- This migration deliberately does not backfill from contacts.address.

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  contact_id text not null,
  label text,
  service_address_line1 text not null,
  service_address_line2 text,
  locality text not null,
  administrative_area text,
  postal_code text,
  country_code text not null,
  request_key uuid not null,
  request_fingerprint jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint properties_label_length check (label is null or length(label) between 1 and 120),
  constraint properties_address_line1_length check (length(service_address_line1) between 1 and 200),
  constraint properties_address_line2_length check (service_address_line2 is null or length(service_address_line2) <= 200),
  constraint properties_locality_length check (length(locality) between 1 and 120),
  constraint properties_administrative_area_length check (administrative_area is null or length(administrative_area) <= 120),
  constraint properties_postal_code_length check (postal_code is null or length(postal_code) <= 32),
  constraint properties_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint properties_contact_owner_fkey
    foreign key (contact_id, user_id) references public.contacts(id, user_id) on delete cascade,
  constraint properties_user_request_key_key unique (user_id, request_key),
  constraint properties_id_user_id_key unique (id, user_id)
);

comment on table public.properties is
  'A tenant-owned service location linked to one contact. Address data is independent of contacts.address.';
comment on column public.properties.service_address_line1 is
  'Service-location street address; not copied from the contact billing or mailing address.';

create index properties_user_contact_created_idx
  on public.properties (user_id, contact_id, created_at desc, id desc);

alter table public.properties enable row level security;

create policy properties_owner_select
on public.properties
for select
to authenticated
using (user_id = (select auth.uid())::text);

-- The browser can read only tenant-owned property fields. It cannot write,
-- delete, or inspect the idempotency key/fingerprint directly.
revoke all on table public.properties from public, anon, authenticated, service_role;
grant select (
  id, contact_id, label, service_address_line1,
  service_address_line2, locality, administrative_area, postal_code,
  country_code, created_at
) on public.properties to authenticated;

create or replace function public.create_crm_property(
  p_request_key uuid,
  p_contact_id text,
  p_service_address_line1 text,
  p_locality text,
  p_country_code text,
  p_service_address_line2 text default null,
  p_administrative_area text default null,
  p_postal_code text default null,
  p_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := auth.uid()::text;
  v_property public.properties;
  v_line1 text;
  v_line2 text;
  v_locality text;
  v_administrative_area text;
  v_postal_code text;
  v_country_code text;
  v_label text;
  v_fingerprint jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_request_key is null then
    raise exception using errcode = '22023', message = 'request key is required';
  end if;
  if p_contact_id is null or pg_catalog.btrim(p_contact_id) = '' then
    raise exception using errcode = '22023', message = 'contact is required';
  end if;

  v_line1 := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_service_address_line1, ''), '[[:space:]]+', ' ', 'g'));
  v_line2 := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_service_address_line2, ''), '[[:space:]]+', ' ', 'g')), '');
  v_locality := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_locality, ''), '[[:space:]]+', ' ', 'g'));
  v_administrative_area := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_administrative_area, ''), '[[:space:]]+', ' ', 'g')), '');
  v_postal_code := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_postal_code, ''), '[[:space:]]+', ' ', 'g')), '');
  v_country_code := pg_catalog.upper(pg_catalog.btrim(coalesce(p_country_code, '')));
  v_label := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_label, ''), '[[:space:]]+', ' ', 'g')), '');

  if length(v_line1) < 1 or length(v_line1) > 200
    or length(v_locality) < 1 or length(v_locality) > 120
    or (v_line2 is not null and length(v_line2) > 200)
    or (v_administrative_area is not null and length(v_administrative_area) > 120)
    or (v_postal_code is not null and length(v_postal_code) > 32)
    or (v_label is not null and length(v_label) > 120) then
    raise exception using errcode = '22023', message = 'invalid property address';
  end if;
  if v_country_code !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'invalid country code';
  end if;

  v_fingerprint := pg_catalog.jsonb_build_object(
    'contact_id', p_contact_id,
    'label', v_label,
    'service_address_line1', v_line1,
    'service_address_line2', v_line2,
    'locality', v_locality,
    'administrative_area', v_administrative_area,
    'postal_code', v_postal_code,
    'country_code', v_country_code
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id || ':property:' || p_request_key::text, 0)
  );

  select * into v_property
  from public.properties
  where user_id = v_user_id and request_key = p_request_key
  for update;
  if found then
    if v_property.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'request key was already used';
    end if;
    return pg_catalog.jsonb_build_object(
      'property', pg_catalog.to_jsonb(v_property) - 'request_key' - 'request_fingerprint',
      'replayed', true
    );
  end if;

  perform 1 from public.contacts
  where id = p_contact_id and user_id = v_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'contact unavailable';
  end if;

  insert into public.properties (
    user_id, contact_id, label, service_address_line1, service_address_line2,
    locality, administrative_area, postal_code, country_code,
    request_key, request_fingerprint
  ) values (
    v_user_id, p_contact_id, v_label, v_line1, v_line2,
    v_locality, v_administrative_area, v_postal_code, v_country_code,
    p_request_key, v_fingerprint
  ) returning * into v_property;

  return pg_catalog.jsonb_build_object(
    'property', pg_catalog.to_jsonb(v_property) - 'request_key' - 'request_fingerprint',
    'replayed', false
  );
end;
$$;

revoke all on function public.create_crm_property(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.create_crm_property(uuid, text, text, text, text, text, text, text, text) to authenticated;
