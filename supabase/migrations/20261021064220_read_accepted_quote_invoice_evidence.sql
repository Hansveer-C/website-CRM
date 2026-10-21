-- A narrow read projection only. Conversion remains the existing invoice RPC.
create function public.read_crm_accepted_invoice_evidence(p_quote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_quote public.quotes;
  v_acceptance public.quote_acceptances;
  v_tier text;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_quantity numeric;
  v_price numeric;
  v_invoice_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'accepted quote unavailable';
  end if;
  select * into v_quote from public.quotes
  where id = p_quote_id and user_id = auth.uid()::text and status = 'approved';
  if not found then
    raise exception using errcode = '42501', message = 'accepted quote unavailable';
  end if;
  select * into v_acceptance from public.quote_acceptances
  where quote_id = v_quote.id and user_id = auth.uid()::text and acceptance_status = 'accepted';
  if not found then
    raise exception using errcode = '42501', message = 'accepted quote unavailable';
  end if;
  if pg_catalog.jsonb_typeof(v_acceptance.quote_snapshot -> 'quote') is distinct from 'object'
    or pg_catalog.jsonb_typeof(v_acceptance.quote_snapshot -> 'items') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid acceptance evidence';
  end if;
  v_tier := v_acceptance.quote_snapshot -> 'quote' ->> 'selected_tier';
  if v_tier is null or v_tier not in ('basic','standard','premium') then
    raise exception using errcode = '22023', message = 'invalid acceptance evidence';
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(v_acceptance.quote_snapshot -> 'items') loop
    if v_item ->> 'tier' is distinct from v_tier then continue; end if;
    if pg_catalog.jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'unit_price') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'invalid acceptance evidence';
    end if;
    -- Exactly the existing conversion RPC's normalization of frozen quantities/prices.
    v_quantity := round((v_item ->> 'quantity')::numeric, 2);
    v_price := round((v_item ->> 'unit_price')::numeric, 2);
    v_items := v_items || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'service_name', v_item -> 'service_name', 'description', coalesce(v_item -> 'description', '""'::jsonb),
      'quantity', v_quantity, 'unit_price', v_price, 'line_total', round(v_quantity * v_price, 2),
      'order_index', v_item -> 'order_index', 'tier', v_tier
    ));
  end loop;
  select id into v_invoice_id from public.invoices
  where quote_acceptance_id = v_acceptance.id and user_id = auth.uid()::text;
  return pg_catalog.jsonb_build_object(
    'quote_id', v_quote.id, 'accepted_revision', v_acceptance.quote_revision,
    'current_revision', v_quote.revision, 'eligible', v_quote.revision::bigint = v_acceptance.quote_revision::bigint + 1,
    'selected_tier', v_tier, 'currency', v_acceptance.accepted_currency,
    'total_amount', v_acceptance.accepted_total_amount,
    'snapshot_total_amount', v_acceptance.quote_snapshot -> 'quote' -> 'total_amount',
    'items', v_items, 'invoice_id', v_invoice_id
  );
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode = '22023', message = 'invalid acceptance evidence';
end;
$$;
revoke all on function public.read_crm_accepted_invoice_evidence(uuid) from public, anon, service_role;
grant execute on function public.read_crm_accepted_invoice_evidence(uuid) to authenticated;
