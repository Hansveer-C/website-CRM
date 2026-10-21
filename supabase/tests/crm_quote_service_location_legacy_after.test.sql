-- Run in the same disposable local database after the new forward migration.
begin;
do $$
declare a public.quote_acceptances; b location_legacy_fixture.before;
begin
  select * into strict a from public.quote_acceptances where quote_id='ab300000-0000-4000-8000-000000000001';
  select * into strict b from location_legacy_fixture.before;
  if a.quote_snapshot::text <> b.snapshot_text or encode(a.signature_bytes,'hex') <> b.signature_hex
     or a.quote_revision <> b.quote_revision or a.accepted_at <> b.accepted_at then
    raise exception 'forward migration changed pre-existing acceptance or signature evidence';
  end if;
  if a.quote_snapshot ? 'service_location' or a.quote_snapshot ? 'service_location_status' then
    raise exception 'forward migration invented legacy service-location evidence';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','ab100000-0000-4000-8000-000000000001',true);
do $$
declare v jsonb;
begin
  v := public.accept_crm_quote('ab300000-0000-4000-8000-000000000001',1,'ab400000-0000-4000-8000-000000000001','Pre-migration signer','data:image/png;base64,iVBORw0KGgo=',false);
  if (v->>'replayed')::boolean is distinct from true or (v->'quote'->>'revision')::integer <> 2 then
    raise exception 'legacy acceptance replay failed after forward migration';
  end if;
  v := public.create_invoice_from_accepted_quote('ab300000-0000-4000-8000-000000000001',1,'ab600000-0000-4000-8000-000000000001');
  if (v->'invoice'->>'total_amount')::numeric <> 40 or jsonb_array_length(v->'items') <> 1 then
    raise exception 'legacy invoice conversion changed after forward migration';
  end if;
end $$;
reset role;
select 'legacy forward migration, unchanged signature/snapshot, replay and invoicing: PASS';
rollback;
