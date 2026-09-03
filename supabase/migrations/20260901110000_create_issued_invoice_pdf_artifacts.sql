-- DOC-1B2: a server-owned, immutable PDF artifact for one frozen document spec.
create table public.invoice_document_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  invoice_document_spec_id uuid not null references public.invoice_document_specs(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  template_key text not null,
  template_version integer not null,
  object_path text not null check (object_path ~ '^[0-9a-f-]+/invoice-document-spec/[0-9a-f-]+\.pdf$'),
  mime_type text not null check (mime_type = 'application/pdf'),
  byte_size integer,
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  rendered_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (invoice_document_spec_id), unique (object_path), unique (id, user_id),
  check ((status = 'pending' and byte_size is null and sha256 is null and rendered_at is null) or
         (status = 'ready' and byte_size > 0 and byte_size <= 6291456 and sha256 is not null and rendered_at is not null))
);
alter table public.invoice_document_artifacts enable row level security;
revoke all on public.invoice_document_artifacts from public, anon, authenticated;
grant all on public.invoice_document_artifacts to service_role;

create or replace function public.claim_issued_invoice_pdf_artifact(p_user_id text, p_document_spec_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_spec public.invoice_document_specs; v_artifact public.invoice_document_artifacts;
begin
  if p_user_id is null or p_document_spec_id is null then raise exception using errcode='22023', message='user and document spec are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id || ':invoice-pdf:' || p_document_spec_id::text, 0));
  select * into v_spec from public.invoice_document_specs where id=p_document_spec_id and user_id=p_user_id;
  if not found then raise exception using errcode='42501', message='document unavailable'; end if;
  select * into v_artifact from public.invoice_document_artifacts where invoice_document_spec_id=p_document_spec_id;
  if not found then
    insert into public.invoice_document_artifacts(user_id,invoice_document_spec_id,invoice_id,template_key,template_version,object_path,mime_type)
    values(p_user_id,v_spec.id,v_spec.invoice_id,v_spec.template_key,v_spec.template_version,p_user_id || '/invoice-document-spec/' || v_spec.id::text || '.pdf','application/pdf') returning * into v_artifact;
  elsif v_artifact.user_id <> p_user_id then raise exception using errcode='42501', message='document unavailable'; end if;
  return pg_catalog.to_jsonb(v_artifact);
end; $$;

create or replace function public.finalize_issued_invoice_pdf_artifact(p_user_id text, p_document_spec_id uuid, p_byte_size integer, p_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_artifact public.invoice_document_artifacts;
begin
  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 6291456 or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023', message='invalid PDF artifact integrity data'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id || ':invoice-pdf:' || p_document_spec_id::text, 0));
  select * into v_artifact from public.invoice_document_artifacts where invoice_document_spec_id=p_document_spec_id and user_id=p_user_id for update;
  if not found then raise exception using errcode='42501', message='document unavailable'; end if;
  if v_artifact.status='ready' then
    if v_artifact.sha256 <> p_sha256 or v_artifact.byte_size <> p_byte_size then raise exception using errcode='23505', message='artifact integrity conflict'; end if;
    return pg_catalog.to_jsonb(v_artifact);
  end if;
  update public.invoice_document_artifacts set status='ready',byte_size=p_byte_size,sha256=p_sha256,rendered_at=statement_timestamp() where id=v_artifact.id returning * into v_artifact;
  return pg_catalog.to_jsonb(v_artifact);
end; $$;
revoke all on function public.claim_issued_invoice_pdf_artifact(text,uuid) from public, anon, authenticated;
revoke all on function public.finalize_issued_invoice_pdf_artifact(text,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.claim_issued_invoice_pdf_artifact(text,uuid) to service_role;
grant execute on function public.finalize_issued_invoice_pdf_artifact(text,uuid,integer,text) to service_role;
