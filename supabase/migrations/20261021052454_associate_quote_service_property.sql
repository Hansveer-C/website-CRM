-- Additive quote/service-location association. Existing accepted evidence is not
-- backfilled or reconstructed from current customer/property addresses.
alter table public.properties
  add constraint properties_id_contact_user_key unique (id, contact_id, user_id);

alter table public.quotes
  add column property_id uuid,
  add constraint quotes_property_customer_owner_fkey
    foreign key (property_id, contact_id, user_id)
    references public.properties (id, contact_id, user_id) on delete no action;

create index quotes_property_customer_owner_idx
  on public.quotes (property_id, contact_id, user_id) where property_id is not null;

create table public.quote_property_assignment_requests (
  user_id text not null references public.users(id) on delete cascade,
  request_key uuid not null,
  quote_id uuid not null,
  request_fingerprint jsonb not null,
  property_id uuid not null,
  result_revision integer not null check (result_revision >= 1),
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, request_key),
  foreign key (quote_id, user_id) references public.quotes(id, user_id) on delete cascade
);
create index quote_property_assignment_quote_owner_idx
  on public.quote_property_assignment_requests (quote_id, user_id);

-- No property FK on a historic request result: reassigning a quote must not
-- retain an unrelated old property solely because a request once referred to it.
alter table public.quote_property_assignment_requests enable row level security;
revoke all on table public.quote_property_assignment_requests
  from public, anon, authenticated, service_role;

create or replace function public.set_crm_quote_service_property(
  p_quote_id uuid,
  p_expected_revision integer,
  p_property_id uuid,
  p_request_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := auth.uid()::text;
  v_quote public.quotes;
  v_request public.quote_property_assignment_requests;
  v_fingerprint jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_quote_id is null or p_expected_revision is null or p_expected_revision < 1
     or p_property_id is null or p_request_key is null then
    raise exception using errcode = '22023', message = 'quote, revision, property and request key are required';
  end if;
  v_fingerprint := pg_catalog.jsonb_build_object(
    'quote_id', p_quote_id, 'expected_revision', p_expected_revision, 'property_id', p_property_id
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id || ':quote-property:' || p_request_key::text, 0)
  );
  select * into v_request from public.quote_property_assignment_requests
  where user_id = v_user_id and request_key = p_request_key;
  if found then
    if v_request.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'request key was already used';
    end if;
    return pg_catalog.jsonb_build_object(
      'quote_id', v_request.quote_id, 'property_id', v_request.property_id,
      'revision', v_request.result_revision, 'replayed', true
    );
  end if;

  select * into v_quote from public.quotes
  where id = p_quote_id and user_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'quote unavailable';
  end if;
  if v_quote.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'quote revision conflict';
  end if;
  if v_quote.status not in ('draft', 'sent') then
    raise exception using errcode = 'P0001', message = 'quote is not editable';
  end if;
  perform 1 from public.properties
  where id = p_property_id and contact_id = v_quote.contact_id and user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'property unavailable';
  end if;

  update public.quotes
  set property_id = p_property_id, revision = revision + 1, updated_at = statement_timestamp()
  where id = v_quote.id and user_id = v_user_id
  returning * into v_quote;
  insert into public.quote_property_assignment_requests (
    user_id, request_key, quote_id, request_fingerprint, property_id, result_revision
  ) values (
    v_user_id, p_request_key, v_quote.id, v_fingerprint, p_property_id, v_quote.revision
  );
  return pg_catalog.jsonb_build_object(
    'quote_id', v_quote.id, 'property_id', p_property_id,
    'revision', v_quote.revision, 'replayed', false
  );
end;
$$;
revoke all on function public.set_crm_quote_service_property(uuid, integer, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_crm_quote_service_property(uuid, integer, uuid, uuid)
  to authenticated;


-- Preserve acceptance signature/replay/commercial contracts; add location evidence only.
create or replace function public.accept_crm_quote(
  p_quote_id uuid,
  p_quote_revision integer,
  p_request_key uuid,
  p_signer_name text,
  p_signature_data_url text default null,
  p_accessible_declaration boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := auth.uid()::text;
  v_quote public.quotes;
  v_acceptance public.quote_acceptances;
  v_signer_name text;
  v_signature_data_url text;
  v_signature_bytes bytea;
  v_signature_kind text;
  v_fingerprint text;
  v_snapshot jsonb;
  v_property public.properties;
  v_service_location jsonb := null;
  v_accepted_at timestamptz := statement_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_quote_id is null or p_quote_revision is null or p_quote_revision < 1 or p_request_key is null then
    raise exception using errcode = '22023', message = 'quote, revision, and request key are required';
  end if;

  v_signer_name := btrim(pg_catalog.regexp_replace(coalesce(p_signer_name, ''), '\s+', ' ', 'g'));
  if length(v_signer_name) < 1 or length(v_signer_name) > 200 then
    raise exception using errcode = '22023', message = 'invalid signer name';
  end if;

  v_signature_data_url := nullif(btrim(coalesce(p_signature_data_url, '')), '');
  if v_signature_data_url is null and not coalesce(p_accessible_declaration, false) then
    raise exception using errcode = '22023', message = 'signature evidence is required';
  end if;

  if v_signature_data_url is not null then
    if length(v_signature_data_url) > 1398200
      or v_signature_data_url !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' then
      raise exception using errcode = '22023', message = 'invalid signature data';
    end if;
    begin
      v_signature_bytes := pg_catalog.decode(split_part(v_signature_data_url, ',', 2), 'base64');
    exception when others then
      raise exception using errcode = '22023', message = 'invalid signature data';
    end;
    if octet_length(v_signature_bytes) < 8
      or octet_length(v_signature_bytes) > 1048576
      or substring(v_signature_bytes from 1 for 8) <> pg_catalog.decode('89504e470d0a1a0a', 'hex') then
      raise exception using errcode = '22023', message = 'invalid signature image';
    end if;
    v_signature_kind := 'drawn';
  else
    v_signature_kind := 'typed';
  end if;

  v_fingerprint := pg_catalog.md5(
    p_quote_id::text || '|' || p_quote_revision::text || '|' || v_signer_name || '|'
    || coalesce(v_signature_data_url, '') || '|' || coalesce(p_accessible_declaration, false)::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id || ':quote-acceptance:' || p_request_key::text, 0)
  );
  select * into v_acceptance
  from public.quote_acceptances
  where user_id = v_user_id and request_key = p_request_key;
  if found then
    if v_acceptance.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'request key was already used';
    end if;
    select * into strict v_quote from public.quotes
    where id = v_acceptance.quote_id and user_id = v_user_id;
    return pg_catalog.jsonb_build_object(
      'quote', pg_catalog.to_jsonb(v_quote) - 'request_key' - 'request_fingerprint',
      'acceptance', pg_catalog.to_jsonb(v_acceptance) - 'request_fingerprint' - 'signature_bytes',
      'replayed', true
    );
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'quote unavailable';
  end if;
  if v_quote.revision <> p_quote_revision then
    raise exception using errcode = '40001', message = 'quote revision conflict';
  end if;
  if v_quote.status = 'approved' then
    raise exception using errcode = 'P0001', message = 'quote already accepted';
  end if;
  if v_quote.status <> 'sent' then
    raise exception using errcode = 'P0001', message = 'quote is not available for acceptance';
  end if;

  -- Lock order matches association: quote, then property. Never use billing address.
  if v_quote.property_id is not null then
    select * into v_property from public.properties
    where id = v_quote.property_id and contact_id = v_quote.contact_id and user_id = v_user_id
    for update;
    if not found then
      raise exception using errcode = '42501', message = 'property unavailable';
    end if;
    v_service_location := pg_catalog.jsonb_build_object(
      'schema_version', 1, 'property_id', v_property.id, 'label', v_property.label,
      'service_address_line1', v_property.service_address_line1,
      'service_address_line2', v_property.service_address_line2,
      'locality', v_property.locality, 'administrative_area', v_property.administrative_area,
      'postal_code', v_property.postal_code, 'country_code', v_property.country_code
    );
  end if;

  v_snapshot := pg_catalog.jsonb_build_object(
    'quote', pg_catalog.to_jsonb(v_quote) - 'request_key' - 'request_fingerprint',
    'service_location', v_service_location,
    'service_location_status', case when v_service_location is null then 'unassigned' else 'recorded' end,
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) order by item.order_index)
      from public.quote_items item
      where item.quote_id = v_quote.id and item.user_id = v_user_id
    ), '[]'::jsonb)
  );

  insert into public.quote_acceptances (
    user_id, quote_id, quote_revision, request_key, request_fingerprint,
    accepted_at, accepted_total_amount, signer_name, actor_user_id,
    signature_kind, accessible_declaration, signature_mime_type, signature_bytes,
    quote_snapshot
  ) values (
    v_user_id, v_quote.id, v_quote.revision, p_request_key, v_fingerprint,
    v_accepted_at, v_quote.total_amount, v_signer_name, v_user_id,
    v_signature_kind, coalesce(p_accessible_declaration, false),
    case when v_signature_kind = 'drawn' then 'image/png' else null end,
    v_signature_bytes, v_snapshot
  ) returning * into v_acceptance;

  update public.quotes
  set status = 'approved',
      revision = revision + 1,
      accepted_at = v_accepted_at,
      accepted_signer_name = v_signer_name,
      updated_at = v_accepted_at
  where id = v_quote.id and user_id = v_user_id
  returning * into v_quote;

  return pg_catalog.jsonb_build_object(
    'quote', pg_catalog.to_jsonb(v_quote) - 'request_key' - 'request_fingerprint',
    'acceptance', pg_catalog.to_jsonb(v_acceptance) - 'request_fingerprint' - 'signature_bytes',
    'replayed', false
  );
end;
$$;

revoke all on function public.accept_crm_quote(uuid, integer, uuid, text, text, boolean) from public, anon;
grant execute on function public.accept_crm_quote(uuid, integer, uuid, text, text, boolean) to authenticated, service_role;
