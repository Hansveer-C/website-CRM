-- Align the initial Website graph with the active Builder section registry.
create or replace function public.create_initial_website_graph(
  p_business_name text,
  p_phone_number text,
  p_city text,
  p_services text[],
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_business_name text := regexp_replace(trim(p_business_name), '\s+', ' ', 'g');
  v_phone_number text := regexp_replace(trim(p_phone_number), '\s+', ' ', 'g');
  v_city text := regexp_replace(trim(p_city), '\s+', ' ', 'g');
  v_services text[];
  v_request_hash text;
  v_receipt private.website_creation_receipts%rowtype;
  v_website public.websites%rowtype;
  v_settings public.website_settings%rowtype;
  v_route public.website_routes%rowtype;
  v_funnel public.funnels%rowtype;
  v_page public.pages%rowtype;
  v_sections jsonb;
  v_result jsonb;
  v_subdomain_prefix text;
  v_subdomain text;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  select coalesce(array_agg(service order by ordinal), '{}'::text[])
  into v_services
  from (
    select regexp_replace(trim(value), '\s+', ' ', 'g') service, ordinal
    from unnest(p_services) with ordinality input(value, ordinal)
  ) normalized
  where service <> '';
  if v_business_name = '' or length(v_business_name) > 120
    or v_phone_number = '' or length(v_phone_number) > 40
    or v_city = '' or length(v_city) > 120
    or cardinality(v_services) < 1 or cardinality(v_services) > 12
    or exists (select 1 from unnest(v_services) service where length(service) > 80)
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
  then
    raise exception using errcode = '22023', message = 'invalid website creation input';
  end if;
  if (select count(*) from unnest(v_services) service) <> (select count(distinct service) from unnest(v_services) service) then
    raise exception using errcode = '22023', message = 'duplicate services';
  end if;

  v_request_hash := md5(jsonb_build_object(
    'business_name', v_business_name,
    'phone_number', v_phone_number,
    'city', v_city,
    'services', to_jsonb(v_services)
  )::text);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id, 20260730));

  select * into v_receipt
  from private.website_creation_receipts
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_receipt.request_hash <> v_request_hash then
      raise exception using errcode = 'P0002', message = 'idempotency key reused with different input';
    end if;
    return v_receipt.result;
  end if;

  select * into v_website from public.websites where user_id = v_user_id;
  if found then
    select * into v_settings from public.website_settings
      where user_id = v_user_id and website_id = v_website.id;
    select * into v_route from public.website_routes
      where website_id = v_website.id and path = '/';
    select * into v_funnel from public.funnels
      where id = v_website.homepage_funnel_id and user_id = v_user_id;
    select * into v_page from public.pages
      where funnel_id = v_funnel.id and user_id = v_user_id and slug = 'home';
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', section.id, 'page_id', section.page_id, 'type', section.type,
      'content', section.content, 'order', section.order_index, 'styles', section.styles
    ) order by section.order_index), '[]'::jsonb)
    into v_sections from public.page_sections section
    where section.page_id = v_page.id and section.user_id = v_user_id;
    if v_settings.id is null or v_route.id is null or v_funnel.id is null or v_page.id is null or jsonb_array_length(v_sections) = 0 then
      raise exception using errcode = 'P0002', message = 'existing website graph is incomplete';
    end if;
    v_result := jsonb_build_object('success', true, 'data', jsonb_build_object(
      'website', to_jsonb(v_website), 'settings', jsonb_build_object(
        'id', v_settings.id, 'user_id', v_settings.user_id, 'website_id', v_settings.website_id,
        'business_name', v_settings.business_name, 'phone', coalesce(v_settings.phone, ''),
        'email', coalesce(v_settings.email, ''), 'logo_url', coalesce(v_settings.logo_url, ''),
        'primary_color', coalesce(v_settings.primary_color, '#2563eb'),
        'auto_lead_sms_enabled', coalesce(v_settings.auto_lead_sms_enabled, true),
        'auto_lead_sms_template', coalesce(v_settings.auto_lead_sms_template, ''),
        'missed_call_sms_enabled', coalesce(v_settings.missed_call_sms_enabled, true),
        'missed_call_sms_template', coalesce(v_settings.missed_call_sms_template, ''),
        'created_at', v_settings.created_at, 'publish_status', coalesce(v_settings.publish_status, 'draft'),
        'build_brief', v_settings.build_brief
      ),
      'route', to_jsonb(v_route), 'funnel', to_jsonb(v_funnel),
      'page', to_jsonb(v_page), 'sections', v_sections, 'created', false,
      'idempotency_key', p_idempotency_key
    ));
    insert into private.website_creation_receipts(user_id, idempotency_key, request_hash, result)
    values (v_user_id, p_idempotency_key, v_request_hash, v_result);
    return v_result;
  end if;

  v_subdomain_prefix := trim(both '-' from regexp_replace(lower(v_business_name), '[^a-z0-9]+', '-', 'g'));
  if v_subdomain_prefix = '' then v_subdomain_prefix := 'site'; end if;
  v_subdomain := left(v_subdomain_prefix, 24) || '-' || regexp_replace(lower(v_user_id), '[^a-z0-9]', '', 'g');

  insert into public.funnels(id, user_id, name, status, created_at, updated_at, service_type, city)
  values (pg_catalog.gen_random_uuid()::text, v_user_id, v_business_name || ' Website', 'draft', v_now, v_now, v_services[1], v_city)
  returning * into v_funnel;

  insert into public.pages(id, user_id, name, slug, status, seo_title, seo_description, seo_keywords, created_at, funnel_id, step_type, step_order)
  values (pg_catalog.gen_random_uuid()::text, v_user_id, 'Home', 'home', 'draft', v_business_name || ' | ' || v_city,
    v_business_name || ' provides ' || array_to_string(v_services, ', ') || ' in ' || v_city || '.', v_services,
    v_now, v_funnel.id, 'landing', 0)
  returning * into v_page;

  insert into public.websites(user_id, name, subdomain, homepage_funnel_id, created_at, updated_at)
  values (v_user_id, v_business_name, v_subdomain, v_funnel.id, v_now, v_now)
  returning * into v_website;

  insert into public.website_routes(website_id, path, funnel_id, created_at)
  values (v_website.id, '/', v_funnel.id, v_now)
  returning * into v_route;

  insert into public.website_settings(id, user_id, business_name, phone, publish_status, website_id, build_brief, created_at, updated_at)
  values ('settings-' || pg_catalog.gen_random_uuid()::text, v_user_id, v_business_name, v_phone_number, 'draft', v_website.id,
    jsonb_build_object('schemaVersion', 1, 'businessName', v_business_name, 'city', v_city, 'phone', v_phone_number, 'services', to_jsonb(v_services)),
    v_now, v_now)
  returning * into v_settings;

  insert into public.page_sections(id, user_id, page_id, type, content, order_index, styles, created_at)
  values
    (pg_catalog.gen_random_uuid()::text, v_user_id, v_page.id, 'hero', jsonb_build_object(
      'heading', v_business_name,
      'subheading', 'Trusted service in ' || v_city,
      'button_text', 'Get a Free Quote',
      'background_image', 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200&q=80'
    ), 0, jsonb_build_object(
      'padding', '100px 20px', 'text_alignment', 'center', 'background', '#ffffff', 'visible', true
    ), v_now),
    (pg_catalog.gen_random_uuid()::text, v_user_id, v_page.id, 'offer', jsonb_build_object(
      'headline', 'Our Services',
      'description', array_to_string(v_services, ', ') || ' in ' || v_city || '.',
      'button_text', 'Request a Quote',
      'expiry', ''
    ), 1, jsonb_build_object(
      'padding', '80px 20px', 'background', '#4f46e5', 'color', '#ffffff', 'visible', true
    ), v_now),
    (pg_catalog.gen_random_uuid()::text, v_user_id, v_page.id, 'form', jsonb_build_object(
      'title', 'Get My Free Quote',
      'fields', jsonb_build_array('name', 'phone'),
      'pipeline_id', v_funnel.id
    ), 2, jsonb_build_object(
      'padding', '60px 20px', 'background', '#f8fafc', 'visible', true
    ), v_now);

  select jsonb_agg(jsonb_build_object(
    'id', section.id, 'page_id', section.page_id, 'type', section.type,
    'content', section.content, 'order', section.order_index, 'styles', section.styles
  ) order by section.order_index)
  into v_sections from public.page_sections section
  where section.page_id = v_page.id and section.user_id = v_user_id;

  v_result := jsonb_build_object('success', true, 'data', jsonb_build_object(
    'website', to_jsonb(v_website), 'settings', jsonb_build_object(
      'id', v_settings.id, 'user_id', v_settings.user_id, 'website_id', v_settings.website_id,
      'business_name', v_settings.business_name, 'phone', coalesce(v_settings.phone, ''),
      'email', coalesce(v_settings.email, ''), 'logo_url', coalesce(v_settings.logo_url, ''),
      'primary_color', coalesce(v_settings.primary_color, '#2563eb'),
      'auto_lead_sms_enabled', coalesce(v_settings.auto_lead_sms_enabled, true),
      'auto_lead_sms_template', coalesce(v_settings.auto_lead_sms_template, ''),
      'missed_call_sms_enabled', coalesce(v_settings.missed_call_sms_enabled, true),
      'missed_call_sms_template', coalesce(v_settings.missed_call_sms_template, ''),
      'created_at', v_settings.created_at, 'publish_status', coalesce(v_settings.publish_status, 'draft'),
      'build_brief', v_settings.build_brief
    ),
    'route', to_jsonb(v_route), 'funnel', to_jsonb(v_funnel),
    'page', to_jsonb(v_page), 'sections', v_sections, 'created', true,
    'idempotency_key', p_idempotency_key
  ));
  insert into private.website_creation_receipts(user_id, idempotency_key, request_hash, result)
  values (v_user_id, p_idempotency_key, v_request_hash, v_result);
  return v_result;
end;
$$;

revoke all on function public.create_initial_website_graph(text, text, text, text[], text) from public, anon;
grant execute on function public.create_initial_website_graph(text, text, text, text[], text) to authenticated;
