-- Read only the service-location projection; never expose the private acceptance ledger.
create or replace function public.read_crm_accepted_service_location(p_quote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'quote unavailable';
  end if;
  select a.quote_snapshot into v_snapshot
  from public.quote_acceptances a
  join public.quotes q on q.id = a.quote_id and q.user_id = a.user_id
  where q.id = p_quote_id and q.user_id = auth.uid()::text and q.status = 'approved';
  if not found then
    raise exception using errcode = '42501', message = 'quote unavailable';
  end if;
  if not (v_snapshot ? 'service_location') and not (v_snapshot ? 'service_location_status') then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'service_location_status', v_snapshot -> 'service_location_status',
    'service_location', case when pg_catalog.jsonb_typeof(v_snapshot -> 'service_location') = 'object'
      then (v_snapshot -> 'service_location') - 'user_id' - 'request_key' - 'request_fingerprint'
      else v_snapshot -> 'service_location' end
  );
end;
$$;
revoke all on function public.read_crm_accepted_service_location(uuid) from public, anon, service_role;
grant execute on function public.read_crm_accepted_service_location(uuid) to authenticated;
