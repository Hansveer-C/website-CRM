-- Run after crm_transactions_bootstrap.sql, quote/acceptance/invoice migrations,
-- their focused tests, DOC-1B0, and DOC-1B1 migrations.
set role service_role;
insert into public.tenant_business_identities(user_id,business_name,phone,email,logo_url,primary_color)
values ('11111111-1111-4111-8111-111111111111','Issuer A','555','issuer@example.test','https://cdn.example/a.png','#123456')
on conflict (user_id) do update set business_name=excluded.business_name;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare a jsonb; b jsonb; before_spec jsonb; v_invoice_id uuid := (select id from public.invoices where quote_id='91000000-0000-4000-8000-000000000001'); begin
  select public.create_issued_invoice_document_spec(v_invoice_id,'91000000-0000-4000-8000-000000000041') into a;
  if coalesce(a->>'replayed','') <> 'false' or a->'document'->'specification'->'issuer'->>'business_name' <> 'Issuer A' or a->'document'->'specification'->'invoice'->>'billing_address' <> '10 Accepted Quote Lane' or jsonb_array_length(a->'document'->'specification'->'items') <> 1 then raise exception 'canonical invoice document snapshot failed'; end if;
  before_spec := a->'document'->'specification';
  select public.create_issued_invoice_document_spec(v_invoice_id,'91000000-0000-4000-8000-000000000041') into b;
  if coalesce(b->>'replayed','') <> 'true' or b->'document'->>'id' <> a->'document'->>'id' then raise exception 'exact document retry failed'; end if;
  update public.tenant_business_identities set business_name='Changed issuer' where user_id=current_setting('request.jwt.claim.sub',true);
  select public.create_issued_invoice_document_spec(v_invoice_id,'91000000-0000-4000-8000-000000000042') into b;
  if b->'document'->'specification' <> before_spec then raise exception 'identity change rewrote snapshot'; end if;
  begin update public.invoice_document_specs set specification='{}'::jsonb; raise exception 'direct update unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin insert into public.invoice_document_specs(user_id,invoice_id,request_key,request_fingerprint,specification,specification_fingerprint) values(current_setting('request.jwt.claim.sub',true),'91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000043','x','{}','00000000000000000000000000000000'); raise exception 'direct insert unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin begin perform public.create_issued_invoice_document_spec('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000044'); raise exception 'anon creation unexpectedly succeeded'; exception when insufficient_privilege then null; end; end $$;
reset role;
do $$ begin if (select public from storage.buckets where id='commercial-documents') then raise exception 'commercial documents bucket is public'; end if; end $$;
select 'invoice_document_spec: ok' as result;
