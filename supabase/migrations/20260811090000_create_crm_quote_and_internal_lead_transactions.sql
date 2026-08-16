-- Durable, tenant-owned quote creation and authenticated internal lead intake.
-- This migration is additive and intentionally does not create invoice storage.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  contact_id text not null,
  opportunity_id text,
  request_key uuid not null,
  request_fingerprint text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected')),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  selected_tier text not null default 'basic' check (selected_tier in ('basic', 'standard', 'premium')),
  notes text not null default '',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (user_id, request_key),
  unique (id, user_id)
);

create unique index if not exists contacts_id_user_id_key on public.contacts (id, user_id);
create unique index if not exists opportunities_id_user_id_key on public.opportunities (id, user_id);

alter table public.quotes
  add constraint quotes_contact_owner_fkey
  foreign key (contact_id, user_id) references public.contacts(id, user_id) on delete cascade,
  add constraint quotes_opportunity_owner_fkey
  foreign key (opportunity_id, user_id) references public.opportunities(id, user_id);

create index quotes_user_created_idx on public.quotes (user_id, created_at desc);
create index quotes_user_contact_idx on public.quotes (user_id, contact_id);
create index quotes_user_opportunity_idx on public.quotes (user_id, opportunity_id) where opportunity_id is not null;

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  quote_id uuid not null,
  service_name text not null check (length(btrim(service_name)) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  tier text not null check (tier in ('basic', 'standard', 'premium')),
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default statement_timestamp(),
  foreign key (quote_id, user_id) references public.quotes(id, user_id) on delete cascade,
  unique (quote_id, order_index)
);

create index quote_items_user_quote_idx on public.quote_items (user_id, quote_id, order_index);

create table public.internal_crm_lead_requests (
  user_id text not null references public.users(id) on delete cascade,
  request_key uuid not null,
  request_fingerprint text not null,
  contact_id text not null,
  opportunity_id text not null,
  is_repeat boolean not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, request_key),
  foreign key (contact_id, user_id) references public.contacts(id, user_id) on delete cascade,
  foreign key (opportunity_id, user_id) references public.opportunities(id, user_id) on delete cascade
);

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.internal_crm_lead_requests enable row level security;

create policy quotes_owner_select on public.quotes
  for select to authenticated
  using (user_id = (select auth.uid())::text);

create policy quote_items_owner_select on public.quote_items
  for select to authenticated
  using (user_id = (select auth.uid())::text);

revoke all on table public.quotes from public, anon, authenticated;
revoke all on table public.quote_items from public, anon, authenticated;
revoke all on table public.internal_crm_lead_requests from public, anon, authenticated;
grant select on table public.quotes to authenticated;
grant select on table public.quote_items to authenticated;
grant all on table public.quotes, public.quote_items, public.internal_crm_lead_requests to service_role;

create or replace function public.save_crm_quote(
  p_request_key uuid,
  p_contact_id text,
  p_opportunity_id text,
  p_selected_tier text,
  p_notes text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := auth.uid()::text;
  v_quote public.quotes;
  v_opportunity public.opportunities;
  v_item jsonb;
  v_index integer := 0;
  v_total numeric(12,2) := 0;
  v_fingerprint text;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if p_request_key is null then raise exception using errcode = '22023', message = 'request key is required'; end if;
  if p_selected_tier not in ('basic', 'standard', 'premium') then raise exception using errcode = '22023', message = 'invalid selected tier'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception using errcode = '22023', message = 'quote items are required'; end if;
  if length(coalesce(p_notes, '')) > 5000 then raise exception using errcode = '22023', message = 'notes are too long'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id || ':quote:' || p_request_key::text, 0));
  v_fingerprint := pg_catalog.md5(p_contact_id || '|' || coalesce(p_opportunity_id, '') || '|' || p_selected_tier || '|' || coalesce(p_notes, '') || '|' || p_items::text);

  select * into v_quote from public.quotes where user_id = v_user_id and request_key = p_request_key;
  if found then
    if v_quote.request_fingerprint <> v_fingerprint then raise exception using errcode = '23505', message = 'request key was already used'; end if;
    if v_quote.opportunity_id is not null then select * into v_opportunity from public.opportunities where id = v_quote.opportunity_id and user_id = v_user_id; end if;
    return pg_catalog.jsonb_build_object(
      'quote', pg_catalog.to_jsonb(v_quote) - 'request_key' - 'request_fingerprint',
      'items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by i.order_index) from public.quote_items i where i.quote_id = v_quote.id and i.user_id = v_user_id), '[]'::jsonb),
      'opportunity', case when v_opportunity.id is null then null else pg_catalog.to_jsonb(v_opportunity) end,
      'replayed', true
    );
  end if;

  perform 1 from public.contacts where id = p_contact_id and user_id = v_user_id;
  if not found then raise exception using errcode = '23503', message = 'contact is unavailable'; end if;
  if p_opportunity_id is not null then
    select * into v_opportunity from public.opportunities where id = p_opportunity_id and user_id = v_user_id and contact_id = p_contact_id;
    if not found then raise exception using errcode = '23503', message = 'opportunity is unavailable'; end if;
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    if coalesce(btrim(v_item->>'service_name'), '') = '' or length(v_item->>'service_name') > 200 then raise exception using errcode = '22023', message = 'invalid service name'; end if;
    if coalesce(v_item->>'tier', '') not in ('basic', 'standard', 'premium') then raise exception using errcode = '22023', message = 'invalid item tier'; end if;
    if (v_item->>'quantity')::numeric <= 0 or (v_item->>'unit_price')::numeric < 0 then raise exception using errcode = '22023', message = 'invalid item amount'; end if;
    if v_item->>'tier' = p_selected_tier then v_total := v_total + round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2); end if;
  end loop;

  insert into public.quotes (user_id, contact_id, opportunity_id, request_key, request_fingerprint, total_amount, selected_tier, notes)
  values (v_user_id, p_contact_id, p_opportunity_id, p_request_key, v_fingerprint, v_total, p_selected_tier, coalesce(p_notes, '')) returning * into v_quote;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    insert into public.quote_items (user_id, quote_id, service_name, description, quantity, unit_price, tier, order_index)
    values (v_user_id, v_quote.id, btrim(v_item->>'service_name'), coalesce(v_item->>'description', ''), (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric, v_item->>'tier', v_index);
    v_index := v_index + 1;
  end loop;

  if p_opportunity_id is not null then
    update public.opportunities set value = v_total where id = p_opportunity_id and user_id = v_user_id returning * into v_opportunity;
  end if;

  return pg_catalog.jsonb_build_object(
    'quote', pg_catalog.to_jsonb(v_quote) - 'request_key' - 'request_fingerprint',
    'items', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by i.order_index) from public.quote_items i where i.quote_id = v_quote.id and i.user_id = v_user_id),
    'opportunity', case when v_opportunity.id is null then null else pg_catalog.to_jsonb(v_opportunity) end,
    'replayed', false
  );
end;
$$;

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
  v_invalid_phone boolean := false;
  v_fingerprint text;
  v_request public.internal_crm_lead_requests;
  v_contact public.contacts;
  v_opportunity public.opportunities;
  v_is_repeat boolean := false;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if p_request_key is null then raise exception using errcode = '22023', message = 'request key is required'; end if;
  v_name := btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if length(v_name) < 1 or length(v_name) > 200 then raise exception using errcode = '22023', message = 'invalid name'; end if;
  if length(coalesce(p_phone, '')) > 50 or length(coalesce(p_email, '')) > 200 then raise exception using errcode = '22023', message = 'invalid contact details'; end if;
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_digits := pg_catalog.regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_digits = '' then v_phone := null;
  elsif length(v_digits) = 10 then v_phone := '+1' || v_digits;
  elsif length(v_digits) = 11 and left(v_digits, 1) = '1' then v_phone := '+' || v_digits;
  else v_phone := v_digits; v_invalid_phone := true;
  end if;
  v_fingerprint := pg_catalog.md5(v_name || '|' || coalesce(v_phone, '') || '|' || coalesce(v_email, '') || '|' || coalesce(p_address, '') || '|' || coalesce(p_service_type, '') || '|' || coalesce(p_message, '') || '|' || coalesce(p_source, '') || '|' || coalesce(p_funnel_id, ''));

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id || ':lead-request:' || p_request_key::text, 0));
  select * into v_request from public.internal_crm_lead_requests where user_id = v_user_id and request_key = p_request_key;
  if found then
    if v_request.request_fingerprint <> v_fingerprint then raise exception using errcode = '23505', message = 'request key was already used'; end if;
    select * into strict v_contact from public.contacts where id = v_request.contact_id and user_id = v_user_id;
    select * into strict v_opportunity from public.opportunities where id = v_request.opportunity_id and user_id = v_user_id;
    return pg_catalog.jsonb_build_object('contact', pg_catalog.to_jsonb(v_contact), 'opportunity', pg_catalog.to_jsonb(v_opportunity), 'is_repeat', v_request.is_repeat, 'replayed', true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id || ':lead-identity:' || coalesce(v_phone, v_email, p_request_key::text), 0));
  select * into v_contact from public.contacts
   where user_id = v_user_id and ((v_phone is not null and phone = v_phone) or (v_email is not null and lower(email) = v_email))
   order by created_at, id limit 1;
  if found then
    v_is_repeat := true;
  else
    insert into public.contacts (id, user_id, name, phone, email, address, tags, source, status, invalid_phone, service, notes)
    values (gen_random_uuid()::text, v_user_id, v_name, v_phone, v_email, coalesce(nullif(btrim(p_address), ''), 'Lead API Submission'), array['web-lead'], coalesce(nullif(btrim(p_source), ''), 'internal-lead-capture'), 'lead', v_invalid_phone, nullif(btrim(p_service_type), ''), nullif(btrim(p_message), ''))
    returning * into v_contact;
  end if;

  select * into v_opportunity from public.opportunities where user_id = v_user_id and contact_id = v_contact.id and status = 'open' order by created_at, id limit 1;
  if not found then
    insert into public.opportunities (id, user_id, contact_id, pipeline_stage, status, value, source, notes, assigned_to, funnel_id)
    values (gen_random_uuid()::text, v_user_id, v_contact.id, 'New Lead', 'open', 0, coalesce(nullif(btrim(p_source), ''), 'internal-lead-capture'), concat_ws(E'\n', 'Service Type: ' || coalesce(nullif(btrim(p_service_type), ''), 'N/A'), 'Address: ' || coalesce(nullif(btrim(p_address), ''), 'N/A'), 'Message: ' || coalesce(nullif(btrim(p_message), ''), 'N/A')), 'Unassigned', nullif(btrim(p_funnel_id), ''))
    returning * into v_opportunity;
  end if;

  insert into public.internal_crm_lead_requests (user_id, request_key, request_fingerprint, contact_id, opportunity_id, is_repeat)
  values (v_user_id, p_request_key, v_fingerprint, v_contact.id, v_opportunity.id, v_is_repeat);

  return pg_catalog.jsonb_build_object('contact', pg_catalog.to_jsonb(v_contact), 'opportunity', pg_catalog.to_jsonb(v_opportunity), 'is_repeat', v_is_repeat, 'replayed', false);
end;
$$;

revoke all on function public.save_crm_quote(uuid, text, text, text, text, jsonb) from public, anon;
revoke all on function public.create_internal_crm_lead(uuid, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_crm_quote(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.create_internal_crm_lead(uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.save_crm_quote(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.create_internal_crm_lead(uuid, text, text, text, text, text, text, text, text) to service_role;
