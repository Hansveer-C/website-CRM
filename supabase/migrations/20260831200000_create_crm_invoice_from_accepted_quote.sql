-- Durable accepted-quote invoice foundation. Invoice commercial values are
-- derived only from immutable quote acceptance evidence.

alter table public.quote_acceptances
  add constraint quote_acceptances_id_user_id_key unique (id, user_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  contact_id text not null,
  quote_id uuid not null,
  quote_acceptance_id uuid not null,
  source_quote_revision integer not null check (source_quote_revision >= 1),
  request_key uuid not null,
  request_fingerprint text not null,
  invoice_number bigint not null check (invoice_number >= 1),
  status text not null default 'issued' check (status = 'issued'),
  currency text not null check (currency = 'USD'),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 200),
  customer_email text check (customer_email is null or length(customer_email) <= 320),
  customer_phone text check (customer_phone is null or length(customer_phone) <= 50),
  billing_address text not null default '' check (length(billing_address) <= 2000),
  issued_at timestamptz not null default statement_timestamp(),
  due_at timestamptz not null,
  origin text not null default 'accepted_quote' check (origin = 'accepted_quote'),
  created_at timestamptz not null default statement_timestamp(),
  unique (user_id, invoice_number),
  unique (user_id, request_key),
  unique (quote_acceptance_id),
  unique (id, user_id),
  foreign key (contact_id, user_id) references public.contacts(id, user_id) on delete restrict,
  foreign key (quote_id, user_id) references public.quotes(id, user_id) on delete restrict,
  foreign key (quote_acceptance_id, user_id) references public.quote_acceptances(id, user_id) on delete restrict
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  invoice_id uuid not null,
  source_quote_item_order_index integer not null check (source_quote_item_order_index >= 0),
  service_name text not null check (length(btrim(service_name)) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default statement_timestamp(),
  unique (invoice_id, source_quote_item_order_index),
  foreign key (invoice_id, user_id) references public.invoices(id, user_id) on delete restrict
);

create index invoices_user_issued_idx on public.invoices (user_id, issued_at desc, id desc);
create index invoices_user_contact_idx on public.invoices (user_id, contact_id, issued_at desc);
create index invoice_items_user_invoice_idx on public.invoice_items (user_id, invoice_id, source_quote_item_order_index);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy invoices_owner_select on public.invoices
  for select to authenticated
  using (user_id = (select auth.uid())::text);

create policy invoice_items_owner_select on public.invoice_items
  for select to authenticated
  using (user_id = (select auth.uid())::text);

revoke all on table public.invoices, public.invoice_items from public, anon, authenticated;
grant select on table public.invoices, public.invoice_items to authenticated;
grant all on table public.invoices, public.invoice_items to service_role;

create or replace function public.create_invoice_from_accepted_quote(
  p_quote_id uuid,
  p_accepted_quote_revision integer,
  p_request_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := auth.uid()::text;
  v_quote public.quotes;
  v_acceptance public.quote_acceptances;
  v_contact public.contacts;
  v_existing public.invoices;
  v_invoice public.invoices;
  v_item jsonb;
  v_selected_tier text;
  v_snapshot_total numeric;
  v_total numeric := 0;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_source_order_index integer;
  v_selected_item_count integer := 0;
  v_invoice_number bigint;
  v_issued_at timestamptz := statement_timestamp();
  v_fingerprint text;
  v_max_amount constant numeric := 9999999999.99;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_quote_id is null or p_accepted_quote_revision is null or p_accepted_quote_revision < 1 or p_request_key is null then
    raise exception using errcode = '22023', message = 'quote, accepted revision, and request key are required';
  end if;

  v_fingerprint := pg_catalog.md5(p_quote_id::text || '|' || p_accepted_quote_revision::text);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id || ':invoice-request:' || p_request_key::text, 0)
  );

  select * into v_existing
  from public.invoices
  where user_id = v_user_id and request_key = p_request_key;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'request key was already used';
    end if;
    return pg_catalog.jsonb_build_object(
      'invoice', pg_catalog.to_jsonb(v_existing) - 'request_key' - 'request_fingerprint',
      'items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by i.source_quote_item_order_index)
                         from public.invoice_items i where i.invoice_id = v_existing.id and i.user_id = v_user_id), '[]'::jsonb),
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
  if v_quote.status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'quote is not approved';
  end if;

  select * into v_acceptance
  from public.quote_acceptances
  where quote_id = v_quote.id and user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'quote acceptance unavailable';
  end if;
  if v_acceptance.quote_revision <> p_accepted_quote_revision
     or v_quote.revision <> v_acceptance.quote_revision + 1 then
    raise exception using errcode = '40001', message = 'accepted quote revision conflict';
  end if;
  if v_acceptance.acceptance_status <> 'accepted' or v_acceptance.accepted_currency <> 'USD'
     or pg_catalog.jsonb_typeof(v_acceptance.quote_snapshot) <> 'object'
     or pg_catalog.jsonb_typeof(v_acceptance.quote_snapshot -> 'quote') <> 'object'
     or pg_catalog.jsonb_typeof(v_acceptance.quote_snapshot -> 'items') <> 'array' then
    raise exception using errcode = '22023', message = 'invalid acceptance evidence';
  end if;

  v_selected_tier := v_acceptance.quote_snapshot -> 'quote' ->> 'selected_tier';
  if v_selected_tier not in ('basic', 'standard', 'premium')
     or pg_catalog.jsonb_typeof(v_acceptance.quote_snapshot -> 'quote' -> 'total_amount') <> 'number' then
    raise exception using errcode = '22023', message = 'invalid acceptance evidence';
  end if;
  begin
    v_snapshot_total := round((v_acceptance.quote_snapshot -> 'quote' ->> 'total_amount')::numeric, 2);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'invalid acceptance evidence';
  end;
  if lower(v_snapshot_total::text) in ('nan', 'infinity', '-infinity')
     or v_snapshot_total < 0 or v_snapshot_total > v_max_amount then
    raise exception using errcode = '22023', message = 'invalid acceptance evidence';
  end if;

  select * into v_contact
  from public.contacts
  where id = v_quote.contact_id and user_id = v_user_id;
  if not found or length(btrim(v_contact.name)) not between 1 and 200
     or length(coalesce(v_contact.email, '')) > 320
     or length(coalesce(v_contact.phone, '')) > 50
     or length(coalesce(v_contact.address, '')) > 2000 then
    raise exception using errcode = '22023', message = 'contact is unavailable for invoicing';
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(v_acceptance.quote_snapshot -> 'items') loop
    if v_item ->> 'tier' <> v_selected_tier then continue; end if;
    if pg_catalog.jsonb_typeof(v_item -> 'service_name') <> 'string'
       or length(btrim(v_item ->> 'service_name')) not between 1 and 200
       or (v_item ? 'description' and pg_catalog.jsonb_typeof(v_item -> 'description') <> 'string')
       or length(coalesce(v_item ->> 'description', '')) > 2000
       or pg_catalog.jsonb_typeof(v_item -> 'quantity') <> 'number'
       or pg_catalog.jsonb_typeof(v_item -> 'unit_price') <> 'number'
       or pg_catalog.jsonb_typeof(v_item -> 'order_index') <> 'number'
       or (v_item ->> 'order_index') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid acceptance evidence';
    end if;
    begin
      v_quantity := round((v_item ->> 'quantity')::numeric, 2);
      v_unit_price := round((v_item ->> 'unit_price')::numeric, 2);
      v_source_order_index := (v_item ->> 'order_index')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'invalid acceptance evidence';
    end;
    if lower(v_quantity::text) in ('nan', 'infinity', '-infinity')
       or lower(v_unit_price::text) in ('nan', 'infinity', '-infinity')
       or v_quantity <= 0 or v_quantity > v_max_amount
       or v_unit_price < 0 or v_unit_price > v_max_amount then
      raise exception using errcode = '22023', message = 'invalid acceptance evidence';
    end if;
    v_line_total := round(v_quantity * v_unit_price, 2);
    if lower(v_line_total::text) in ('nan', 'infinity', '-infinity')
       or v_line_total < 0 or v_line_total > v_max_amount then
      raise exception using errcode = '22023', message = 'invalid acceptance evidence';
    end if;
    v_total := v_total + v_line_total;
    v_selected_item_count := v_selected_item_count + 1;
    if lower(v_total::text) in ('nan', 'infinity', '-infinity') or v_total > v_max_amount then
      raise exception using errcode = '22023', message = 'invalid acceptance evidence';
    end if;
  end loop;
  if v_selected_item_count = 0 or v_total <> v_snapshot_total or v_total <> v_acceptance.accepted_total_amount then
    raise exception using errcode = '22023', message = 'accepted total does not match selected items';
  end if;

  select * into v_existing
  from public.invoices
  where quote_acceptance_id = v_acceptance.id;
  if found then
    return pg_catalog.jsonb_build_object(
      'invoice', pg_catalog.to_jsonb(v_existing) - 'request_key' - 'request_fingerprint',
      'items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by i.source_quote_item_order_index)
                         from public.invoice_items i where i.invoice_id = v_existing.id and i.user_id = v_user_id), '[]'::jsonb),
      'replayed', true
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id || ':invoice-number', 0));
  select coalesce(max(invoice_number), 0) + 1 into v_invoice_number
  from public.invoices where user_id = v_user_id;

  insert into public.invoices (
    user_id, contact_id, quote_id, quote_acceptance_id, source_quote_revision,
    request_key, request_fingerprint, invoice_number, currency, total_amount,
    customer_name, customer_email, customer_phone, billing_address, issued_at, due_at
  ) values (
    v_user_id, v_contact.id, v_quote.id, v_acceptance.id, v_acceptance.quote_revision,
    p_request_key, v_fingerprint, v_invoice_number, v_acceptance.accepted_currency, v_total,
    btrim(v_contact.name), nullif(btrim(v_contact.email), ''), nullif(btrim(v_contact.phone), ''), coalesce(v_contact.address, ''),
    v_issued_at, v_issued_at + interval '7 days'
  ) returning * into v_invoice;

  for v_item in select value from pg_catalog.jsonb_array_elements(v_acceptance.quote_snapshot -> 'items') loop
    if v_item ->> 'tier' = v_selected_tier then
      insert into public.invoice_items (
        user_id, invoice_id, source_quote_item_order_index, service_name, description, quantity, unit_price
      ) values (
        v_user_id, v_invoice.id, (v_item ->> 'order_index')::integer, btrim(v_item ->> 'service_name'), coalesce(v_item ->> 'description', ''),
        round((v_item ->> 'quantity')::numeric, 2), round((v_item ->> 'unit_price')::numeric, 2)
      );
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'invoice', pg_catalog.to_jsonb(v_invoice) - 'request_key' - 'request_fingerprint',
    'items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by i.source_quote_item_order_index)
                       from public.invoice_items i where i.invoice_id = v_invoice.id and i.user_id = v_user_id), '[]'::jsonb),
    'replayed', false
  );
end;
$$;

comment on function public.create_invoice_from_accepted_quote(uuid, integer, uuid) is
  'Atomically creates exactly one issued invoice from immutable accepted-quote evidence.';

revoke all on function public.create_invoice_from_accepted_quote(uuid, integer, uuid) from public, anon;
grant execute on function public.create_invoice_from_accepted_quote(uuid, integer, uuid) to authenticated, service_role;
