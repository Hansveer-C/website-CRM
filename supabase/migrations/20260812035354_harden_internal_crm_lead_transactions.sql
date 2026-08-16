alter table public.internal_crm_lead_requests
  add column inquiry_name text,
  add column inquiry_phone text,
  add column inquiry_email text,
  add column inquiry_address text,
  add column inquiry_service_type text,
  add column inquiry_message text,
  add column inquiry_source text,
  add column inquiry_funnel_id text;

comment on table public.internal_crm_lead_requests is
  'Private idempotency and immutable inquiry history for authenticated internal CRM lead intake.';

create or replace function public.create_internal_crm_lead(
  p_request_key uuid,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_service_type text default null,
  p_message text default null,
  p_source text default 'internal-lead-capture',
  p_funnel_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := auth.uid()::text;
  v_name text;
  v_phone text;
  v_digits text;
  v_email text;
  v_address text;
  v_service_type text;
  v_message text;
  v_source text;
  v_funnel_id text;
  v_invalid_phone boolean := false;
  v_fingerprint text;
  v_email_ids text[];
  v_phone_ids text[];
  v_contact_id text;
  v_request public.internal_crm_lead_requests;
  v_contact public.contacts;
  v_opportunity public.opportunities;
  v_is_repeat boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_request_key is null then
    raise exception using errcode = '22023', message = 'request key is required';
  end if;

  v_name := btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_address := nullif(btrim(coalesce(p_address, '')), '');
  v_service_type := nullif(btrim(coalesce(p_service_type, '')), '');
  v_message := nullif(btrim(coalesce(p_message, '')), '');
  v_source := coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'internal-lead-capture');
  v_funnel_id := nullif(btrim(coalesce(p_funnel_id, '')), '');

  if length(v_name) < 1 or length(v_name) > 200
     or length(coalesce(p_phone, '')) > 50
     or length(coalesce(v_email, '')) > 200
     or length(coalesce(v_address, '')) > 500
     or length(coalesce(v_service_type, '')) > 200
     or length(coalesce(v_message, '')) > 5000
     or length(v_source) > 200
     or length(coalesce(v_funnel_id, '')) > 200 then
    raise exception using errcode = '22023', message = 'invalid lead details';
  end if;

  v_digits := pg_catalog.regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_digits = '' then
    v_phone := null;
  elsif length(v_digits) = 10 then
    v_phone := '+1' || v_digits;
  elsif length(v_digits) = 11 and left(v_digits, 1) = '1' then
    v_phone := '+' || v_digits;
  else
    v_phone := v_digits;
    v_invalid_phone := true;
  end if;

  if v_funnel_id is not null and not exists (
    select 1 from public.funnels
    where id = v_funnel_id and user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'funnel unavailable';
  end if;

  v_fingerprint := pg_catalog.md5(
    v_name || '|' || coalesce(v_phone, '') || '|' || coalesce(v_email, '') || '|'
    || coalesce(v_address, '') || '|' || coalesce(v_service_type, '') || '|'
    || coalesce(v_message, '') || '|' || v_source || '|' || coalesce(v_funnel_id, '')
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id || ':lead-request:' || p_request_key::text, 0)
  );
  select * into v_request
  from public.internal_crm_lead_requests
  where user_id = v_user_id and request_key = p_request_key;
  if found then
    if v_request.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'request key was already used';
    end if;
    select * into strict v_contact from public.contacts
    where id = v_request.contact_id and user_id = v_user_id;
    select * into strict v_opportunity from public.opportunities
    where id = v_request.opportunity_id and user_id = v_user_id;
    return pg_catalog.jsonb_build_object(
      'contact', pg_catalog.to_jsonb(v_contact),
      'opportunity', pg_catalog.to_jsonb(v_opportunity),
      'inquiry', pg_catalog.to_jsonb(v_request) - 'request_fingerprint',
      'is_repeat', v_request.is_repeat,
      'replayed', true
    );
  end if;

  -- A tenant-wide identity lock serializes the two independent identifier
  -- lookups and prevents concurrent phone/email submissions from splitting.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id || ':lead-identity', 0)
  );

  if v_email is not null then
    select array_agg(id order by id) into v_email_ids
    from public.contacts
    where user_id = v_user_id and lower(btrim(email)) = v_email;
    if coalesce(array_length(v_email_ids, 1), 0) > 1 then
      raise exception using errcode = 'P0001', message = 'ambiguous contact identity';
    end if;
  end if;

  if v_phone is not null then
    select array_agg(id order by id) into v_phone_ids
    from public.contacts
    where user_id = v_user_id
      and pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')
        = pg_catalog.regexp_replace(v_phone, '\D', '', 'g');
    if coalesce(array_length(v_phone_ids, 1), 0) > 1 then
      raise exception using errcode = 'P0001', message = 'ambiguous contact identity';
    end if;
  end if;

  if v_email_ids[1] is not null and v_phone_ids[1] is not null
     and v_email_ids[1] <> v_phone_ids[1] then
    raise exception using errcode = 'P0001', message = 'conflicting contact identity';
  end if;
  v_contact_id := coalesce(v_email_ids[1], v_phone_ids[1]);

  if v_contact_id is null then
    insert into public.contacts (
      id, user_id, name, phone, email, address, tags, source, status,
      invalid_phone, service, notes
    ) values (
      gen_random_uuid()::text, v_user_id, v_name, v_phone, v_email,
      coalesce(v_address, 'Lead API Submission'), array['web-lead'], v_source,
      'lead', v_invalid_phone, v_service_type, v_message
    ) returning * into v_contact;
  else
    select * into strict v_contact from public.contacts
    where id = v_contact_id and user_id = v_user_id;
    v_is_repeat := true;
  end if;

  select * into v_opportunity
  from public.opportunities
  where user_id = v_user_id and contact_id = v_contact.id and status = 'open'
  order by created_at, id
  limit 1;
  if not found then
    insert into public.opportunities (
      id, user_id, contact_id, pipeline_stage, status, value, source,
      notes, assigned_to, funnel_id
    ) values (
      gen_random_uuid()::text, v_user_id, v_contact.id, 'New Lead', 'open', 0,
      v_source,
      concat_ws(E'\n',
        'Service Type: ' || coalesce(v_service_type, 'N/A'),
        'Address: ' || coalesce(v_address, 'N/A'),
        'Message: ' || coalesce(v_message, 'N/A')
      ),
      'Unassigned', v_funnel_id
    ) returning * into v_opportunity;
  end if;

  insert into public.internal_crm_lead_requests (
    user_id, request_key, request_fingerprint, contact_id, opportunity_id,
    is_repeat, inquiry_name, inquiry_phone, inquiry_email, inquiry_address,
    inquiry_service_type, inquiry_message, inquiry_source, inquiry_funnel_id
  ) values (
    v_user_id, p_request_key, v_fingerprint, v_contact.id, v_opportunity.id,
    v_is_repeat, v_name, v_phone, v_email, v_address, v_service_type,
    v_message, v_source, v_funnel_id
  ) returning * into v_request;

  return pg_catalog.jsonb_build_object(
    'contact', pg_catalog.to_jsonb(v_contact),
    'opportunity', pg_catalog.to_jsonb(v_opportunity),
    'inquiry', pg_catalog.to_jsonb(v_request) - 'request_fingerprint',
    'is_repeat', v_is_repeat,
    'replayed', false
  );
end;
$$;

revoke all on function public.create_internal_crm_lead(
  uuid, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_internal_crm_lead(
  uuid, text, text, text, text, text, text, text, text
) to authenticated, service_role;
