-- Immutable canonical invoice document specifications. This migration creates
-- no rendered artifact and never writes PDF bytes or object paths.

insert into storage.buckets (id, name, public)
values ('commercial-documents', 'commercial-documents', false)
on conflict (id) do update set public = false;

create table public.invoice_document_specs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  request_key uuid not null,
  request_fingerprint text not null,
  document_kind text not null default 'invoice' check (document_kind = 'invoice'),
  template_key text not null default 'washops-issued-invoice' check (template_key = 'washops-issued-invoice'),
  template_version integer not null default 1 check (template_version = 1),
  specification jsonb not null check (jsonb_typeof(specification) = 'object'),
  specification_fingerprint text not null check (length(btrim(specification_fingerprint)) = 32),
  created_at timestamptz not null default statement_timestamp(),
  unique (invoice_id),
  unique (user_id, request_key),
  unique (id, user_id)
);

comment on table public.invoice_document_specs is
  'Immutable server-created issued-invoice document specifications. Rendered PDF artifact metadata and object paths are intentionally absent until DOC-1B2.';

alter table public.invoice_document_specs enable row level security;
create policy invoice_document_specs_owner_select on public.invoice_document_specs
for select to authenticated using (user_id = (select auth.uid())::text);
revoke all on table public.invoice_document_specs from public, anon, authenticated;
grant select on table public.invoice_document_specs to authenticated;
grant all on table public.invoice_document_specs to service_role;

create or replace function public.create_issued_invoice_document_spec(
  p_invoice_id uuid,
  p_request_key uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id text := auth.uid()::text;
  v_invoice public.invoices;
  v_identity public.tenant_business_identities;
  v_existing public.invoice_document_specs;
  v_spec jsonb;
  v_fingerprint text;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if p_invoice_id is null or p_request_key is null then raise exception using errcode = '22023', message = 'invoice and request key are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id || ':invoice-document:' || p_invoice_id::text, 0));
  select * into v_existing from public.invoice_document_specs where user_id = v_user_id and request_key = p_request_key;
  if found then
    if v_existing.invoice_id <> p_invoice_id then raise exception using errcode = '23505', message = 'request key was already used'; end if;
    return pg_catalog.jsonb_build_object('document', pg_catalog.to_jsonb(v_existing) - 'request_fingerprint', 'replayed', true);
  end if;
  select * into v_existing from public.invoice_document_specs where invoice_id = p_invoice_id;
  if found then
    if v_existing.user_id <> v_user_id then raise exception using errcode = '42501', message = 'invoice unavailable'; end if;
    return pg_catalog.jsonb_build_object('document', pg_catalog.to_jsonb(v_existing) - 'request_fingerprint', 'replayed', true);
  end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = v_user_id for update;
  if not found or v_invoice.status <> 'issued' then raise exception using errcode = '42501', message = 'invoice unavailable'; end if;
  select * into v_identity from public.tenant_business_identities where user_id = v_user_id;
  if not found then raise exception using errcode = 'P0001', message = 'canonical business identity is required'; end if;
  v_spec := pg_catalog.jsonb_build_object(
    'issuer', pg_catalog.jsonb_build_object('business_name', v_identity.business_name, 'phone', v_identity.phone, 'email', v_identity.email, 'logo_url', v_identity.logo_url, 'primary_color', v_identity.primary_color),
    'invoice', pg_catalog.jsonb_build_object('invoice_id', v_invoice.id, 'invoice_number', v_invoice.invoice_number, 'issued_at', v_invoice.issued_at, 'due_at', v_invoice.due_at, 'status', v_invoice.status, 'currency', v_invoice.currency, 'total_amount', v_invoice.total_amount, 'customer_name', v_invoice.customer_name, 'customer_email', v_invoice.customer_email, 'customer_phone', v_invoice.customer_phone, 'billing_address', v_invoice.billing_address, 'quote_id', v_invoice.quote_id, 'quote_acceptance_id', v_invoice.quote_acceptance_id, 'source_quote_revision', v_invoice.source_quote_revision),
    'items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('order_index', i.source_quote_item_order_index, 'service_name', i.service_name, 'description', i.description, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.source_quote_item_order_index, i.id) from public.invoice_items i where i.invoice_id = v_invoice.id and i.user_id = v_user_id), '[]'::jsonb)
  );
  v_fingerprint := pg_catalog.md5(v_spec::text);
  insert into public.invoice_document_specs(user_id, invoice_id, request_key, request_fingerprint, specification, specification_fingerprint)
  values (v_user_id, v_invoice.id, p_request_key, pg_catalog.md5(v_invoice.id::text), v_spec, v_fingerprint)
  returning * into v_existing;
  return pg_catalog.jsonb_build_object('document', pg_catalog.to_jsonb(v_existing) - 'request_fingerprint', 'replayed', false);
end;
$$;
revoke all on function public.create_issued_invoice_document_spec(uuid, uuid) from public, anon;
grant execute on function public.create_issued_invoice_document_spec(uuid, uuid) to authenticated, service_role;
