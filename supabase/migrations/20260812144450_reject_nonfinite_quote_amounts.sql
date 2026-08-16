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
  v_selected_item_count integer := 0;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_validated_items jsonb := '[]'::jsonb;
  v_max_amount constant numeric := 9999999999.99;
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

    begin
      v_quantity := (v_item->>'quantity')::numeric;
      v_unit_price := (v_item->>'unit_price')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'invalid item amount';
    end;

    -- PostgreSQL numeric has special NaN/Infinity values. Their canonical text
    -- representations are checked explicitly because normal ordering comparisons
    -- do not reject NaN.
    if v_quantity is null or v_unit_price is null
       or lower(v_quantity::text) in ('nan', 'infinity', '-infinity')
       or lower(v_unit_price::text) in ('nan', 'infinity', '-infinity') then
      raise exception using errcode = '22023', message = 'invalid item amount';
    end if;

    v_quantity := round(v_quantity, 2);
    v_unit_price := round(v_unit_price, 2);
    if v_quantity <= 0 or v_quantity > v_max_amount
       or v_unit_price < 0 or v_unit_price > v_max_amount then
      raise exception using errcode = '22023', message = 'invalid item amount';
    end if;

    v_line_total := round(v_quantity * v_unit_price, 2);
    if lower(v_line_total::text) in ('nan', 'infinity', '-infinity')
       or v_line_total < 0 or v_line_total > v_max_amount then
      raise exception using errcode = '22023', message = 'invalid item amount';
    end if;

    if v_item->>'tier' = p_selected_tier then
      v_selected_item_count := v_selected_item_count + 1;
      v_total := v_total + v_line_total;
      if lower(v_total::text) in ('nan', 'infinity', '-infinity') or v_total > v_max_amount then
        raise exception using errcode = '22023', message = 'invalid quote total';
      end if;
    end if;

    v_validated_items := v_validated_items || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'service_name', btrim(v_item->>'service_name'),
      'description', coalesce(v_item->>'description', ''),
      'quantity', v_quantity,
      'unit_price', v_unit_price,
      'tier', v_item->>'tier'
    ));
  end loop;

  if v_selected_item_count = 0 then
    raise exception using errcode = '22023', message = 'selected tier requires at least one item';
  end if;

  insert into public.quotes (user_id, contact_id, opportunity_id, request_key, request_fingerprint, total_amount, selected_tier, notes)
  values (v_user_id, p_contact_id, p_opportunity_id, p_request_key, v_fingerprint, v_total, p_selected_tier, coalesce(p_notes, '')) returning * into v_quote;

  insert into public.quote_items (user_id, quote_id, service_name, description, quantity, unit_price, tier, order_index)
  select
    v_user_id,
    v_quote.id,
    item.value->>'service_name',
    item.value->>'description',
    (item.value->>'quantity')::numeric,
    (item.value->>'unit_price')::numeric,
    item.value->>'tier',
    (item.ordinality - 1)::integer
  from pg_catalog.jsonb_array_elements(v_validated_items) with ordinality as item(value, ordinality);

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

comment on function public.save_crm_quote(uuid, text, text, text, text, jsonb) is
  'Atomically saves an authenticated quote, requires a selected-tier item, and rejects malformed, non-finite, or out-of-range amounts.';

revoke all on function public.save_crm_quote(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.save_crm_quote(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.save_crm_quote(uuid, text, text, text, text, jsonb) to service_role;
