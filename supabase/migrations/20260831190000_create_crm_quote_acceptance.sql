-- Durable, server-authoritative quote acceptance. Signatures are bounded PNG
-- evidence kept private in the database; they are never placed in the public
-- builder media bucket and are cascade-deleted with their quote.

alter table public.quotes
  add column revision integer not null default 1 check (revision >= 1),
  add column accepted_at timestamptz,
  add column accepted_signer_name text;

create table public.quote_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_revision integer not null check (quote_revision >= 1),
  request_key uuid not null,
  request_fingerprint text not null,
  acceptance_status text not null default 'accepted' check (acceptance_status = 'accepted'),
  accepted_at timestamptz not null default statement_timestamp(),
  accepted_total_amount numeric(12,2) not null check (accepted_total_amount >= 0),
  accepted_currency text not null default 'USD' check (accepted_currency = 'USD'),
  signer_name text not null check (length(btrim(signer_name)) between 1 and 200),
  actor_user_id text not null references public.users(id) on delete restrict,
  signature_kind text not null check (signature_kind in ('drawn', 'typed')),
  accessible_declaration boolean not null default false,
  signature_mime_type text check (signature_mime_type is null or signature_mime_type = 'image/png'),
  signature_bytes bytea,
  quote_snapshot jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (quote_id),
  unique (user_id, request_key),
  constraint quote_acceptances_signature_evidence check (
    (signature_kind = 'drawn' and signature_mime_type = 'image/png' and octet_length(signature_bytes) between 8 and 1048576)
    or (signature_kind = 'typed' and signature_mime_type is null and signature_bytes is null and accessible_declaration)
  )
);

comment on table public.quote_acceptances is
  'Immutable, tenant-owned quote acceptance evidence. Signature bytes are private and cascade with the quote; no public object is created.';

create index quote_acceptances_user_accepted_idx
  on public.quote_acceptances (user_id, accepted_at desc, id desc);

alter table public.quote_acceptances enable row level security;

-- The application never grants browser table access to this evidence. RLS is
-- still enabled as defense in depth for future privileged access paths.
create policy quote_acceptances_owner_select
on public.quote_acceptances
for select
to authenticated
using (user_id = (select auth.uid())::text);

revoke all on table public.quote_acceptances from public, anon, authenticated;
grant all on table public.quote_acceptances to service_role;

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

  v_snapshot := pg_catalog.jsonb_build_object(
    'quote', pg_catalog.to_jsonb(v_quote) - 'request_key' - 'request_fingerprint',
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
