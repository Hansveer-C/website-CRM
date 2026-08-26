-- Transactional, draft-only Local SEO graph creation. Publication remains separate.
create schema if not exists private;

create table if not exists private.local_seo_draft_batch_receipts (
  user_id text not null references public.users(id) on delete cascade,
  idempotency_key text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);
revoke all on table private.local_seo_draft_batch_receipts from public, anon, authenticated;

create or replace function public.create_local_seo_draft_batch(
  p_website_id uuid,
  p_services text[],
  p_cities text[],
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_payload jsonb;
  v_receipt private.local_seo_draft_batch_receipts%rowtype;
  v_service text;
  v_city text;
  v_slug text;
  v_funnel_id text;
  v_page jsonb;
  v_result jsonb;
  v_pages jsonb := '[]'::jsonb;
  v_sections jsonb;
  v_services text[];
  v_cities text[];
begin
  if v_user_id is null or v_user_id = '' then raise sqlstate 'PT401' using message = 'Authentication required'; end if;
  if p_website_id is null or not exists (select 1 from public.websites where id = p_website_id and user_id = v_user_id) then raise sqlstate 'PT404' using message = 'Website not found'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 128 or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then raise sqlstate 'PT400' using message = 'Invalid idempotency key'; end if;
  if coalesce(array_length(p_services, 1), 0) < 1 or coalesce(array_length(p_services, 1), 0) > 12 or coalesce(array_length(p_cities, 1), 0) < 1 or coalesce(array_length(p_cities, 1), 0) > 12 then raise sqlstate 'PT422' using message = 'Invalid Local SEO batch size'; end if;
  if array_length(p_services, 1) * array_length(p_cities, 1) > 48 then raise sqlstate 'PT422' using message = 'Too many Local SEO drafts'; end if;
  select array_agg(trim(value) order by lower(trim(value))) into v_services from unnest(p_services) value;
  select array_agg(trim(value) order by lower(trim(value))) into v_cities from unnest(p_cities) value;
  if exists (select 1 from unnest(v_services) value where length(value) = 0 or length(value) > 80)
     or exists (select 1 from unnest(v_cities) value where length(value) = 0 or length(value) > 120)
     or (select count(*) from (select distinct lower(value) from unnest(v_services) value) values_) <> array_length(v_services, 1)
     or (select count(*) from (select distinct lower(value) from unnest(v_cities) value) values_) <> array_length(v_cities, 1) then raise sqlstate 'PT422' using message = 'Invalid Local SEO text'; end if;
  v_payload := jsonb_build_object('website_id', p_website_id, 'services', v_services, 'cities', v_cities);
  select * into v_receipt from private.local_seo_draft_batch_receipts where user_id = v_user_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_receipt.payload = v_payload then return jsonb_set(v_receipt.result, '{data,replayed}', 'true'::jsonb); end if;
    raise sqlstate 'PT409' using message = 'Idempotency key already used with different input';
  end if;
  for v_service in select value from unnest(v_services) value loop
    for v_city in select value from unnest(v_cities) value loop
      v_slug := lower(regexp_replace(regexp_replace(v_service || '-' || v_city, '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'));
      if v_slug = '' or length(v_slug) > 120 then raise sqlstate 'PT422' using message = 'Invalid Local SEO route'; end if;
      if exists (select 1 from public.website_routes where website_id = p_website_id and path = '/' || v_slug)
         or exists (select 1 from public.builder_route_drafts where website_id = p_website_id and path = '/' || v_slug) then raise sqlstate 'PT409' using message = 'A Local SEO route already exists'; end if;
      v_funnel_id := 'fnl_seo_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.funnels (id, user_id, website_id, name, status, service_type, city, created_at, updated_at)
      values (v_funnel_id, v_user_id, p_website_id, v_service || ' - ' || v_city, 'draft', v_service, v_city, now(), now());
      select public.create_builder_page(v_service || ' in ' || v_city, v_slug, v_funnel_id, 'pg_seo_' || replace(gen_random_uuid()::text, '-', '')) into v_page;
      v_sections := jsonb_build_array(jsonb_build_object('id', 'sec_seo_' || replace(gen_random_uuid()::text, '-', ''), 'type', 'hero', 'content', jsonb_build_object('heading', v_service || ' in ' || v_city, 'subheading', 'Request a quote for professional exterior cleaning.'), 'order', 0, 'styles', '{}'::jsonb));
      perform public.save_page_sections_document(v_page->>'id', v_sections, 0, 0);
      perform public.set_builder_route_draft(p_website_id, v_funnel_id, '/' || v_slug, null, null, null);
      v_pages := v_pages || jsonb_build_array(jsonb_build_object('service', v_service, 'city', v_city, 'path', '/' || v_slug, 'funnel_id', v_funnel_id, 'page_id', v_page->>'id'));
    end loop;
  end loop;
  v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('website_id', p_website_id, 'created_count', jsonb_array_length(v_pages), 'replayed', false, 'pages', v_pages));
  insert into private.local_seo_draft_batch_receipts(user_id, idempotency_key, payload, result) values (v_user_id, p_idempotency_key, v_payload, v_result);
  return v_result;
end;
$$;
revoke all on function public.create_local_seo_draft_batch(uuid, text[], text[], text) from public, anon;
grant execute on function public.create_local_seo_draft_batch(uuid, text[], text[], text) to authenticated;
