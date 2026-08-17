\set ON_ERROR_STOP on

create extension if not exists dblink;
create schema if not exists auth;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.users (
  id text primary key
);

create table public.funnels (
  id text primary key,
  user_id text not null references public.users(id),
  name text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  service_type text,
  city text
);

create table public.pages (
  id text primary key,
  user_id text not null references public.users(id),
  name text not null,
  slug text not null,
  status text not null,
  seo_title text not null,
  seo_description text not null,
  seo_keywords text[] not null,
  created_at timestamptz not null,
  funnel_id text references public.funnels(id),
  step_type text,
  step_order integer
);

create table public.websites (
  id text primary key default pg_catalog.gen_random_uuid()::text,
  user_id text not null unique references public.users(id),
  name text not null,
  domain text,
  subdomain text not null unique,
  homepage_funnel_id text references public.funnels(id),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.website_routes (
  id text primary key default pg_catalog.gen_random_uuid()::text,
  website_id text not null references public.websites(id),
  path text not null,
  funnel_id text not null references public.funnels(id),
  created_at timestamptz not null
);

create table public.website_settings (
  id text primary key,
  user_id text not null references public.users(id),
  website_id text references public.websites(id),
  business_name text not null,
  phone text,
  email text default '',
  logo_url text default '',
  primary_color text default '#2563eb',
  auto_lead_sms_enabled boolean default true,
  auto_lead_sms_template text default '',
  missed_call_sms_enabled boolean default true,
  missed_call_sms_template text default '',
  publish_status text default 'draft',
  build_brief jsonb,
  created_at timestamptz not null,
  updated_at timestamptz
);

create table public.page_sections (
  id text primary key,
  user_id text not null references public.users(id),
  page_id text not null references public.pages(id),
  type text not null,
  content jsonb not null,
  order_index integer not null,
  styles jsonb not null,
  created_at timestamptz not null
);

\ir ../migrations/20260730230741_create_initial_website_graph.sql
\ir ../migrations/20260730230827_drop_redundant_phase0_index.sql
\ir ../migrations/20260801052529_align_initial_website_section_types.sql

create or replace function public.test_assert(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;

do $$
declare
  v_user_id text := '00000000-0000-4000-8000-000000000001';
  v_result jsonb;
  v_replay jsonb;
  v_existing jsonb;
  v_sections_before jsonb;
  v_funnel_id text;
begin
  insert into public.users(id) values (v_user_id);
  perform set_config('request.jwt.claim.sub', v_user_id, true);

  v_result := public.create_initial_website_graph(
    '  Phase   Zero   Wash  ',
    ' (604)   555-0199 ',
    ' Vancouver,   BC ',
    array['Driveway Cleaning', 'House Washing'],
    'website-create:local-primary'
  );

  perform public.test_assert(v_result #>> '{data,website,user_id}' = v_user_id, 'ownership must derive from auth.uid()');
  perform public.test_assert(v_result #>> '{data,website,name}' = 'Phase Zero Wash', 'business name must be normalized');
  perform public.test_assert(v_result #>> '{data,settings,phone}' = '(604) 555-0199', 'phone must be normalized');
  perform public.test_assert((select count(*) = 1 from public.websites where user_id = v_user_id), 'one Website expected');
  perform public.test_assert((select count(*) = 1 from public.funnels where user_id = v_user_id), 'one Funnel expected');
  perform public.test_assert((select count(*) = 1 from public.pages where user_id = v_user_id), 'one Page expected');
  perform public.test_assert((select count(*) = 1 from public.website_routes route join public.websites website on website.id = route.website_id where website.user_id = v_user_id), 'one Route expected');
  perform public.test_assert((select count(*) = 1 from public.website_settings where user_id = v_user_id), 'one Settings row expected');
  perform public.test_assert((select count(*) = 3 from public.page_sections where user_id = v_user_id), 'three sections expected');
  perform public.test_assert((select array_agg(type order by order_index) = array['hero','offer','form'] from public.page_sections where user_id = v_user_id), 'section types must be hero, offer, form');
  perform public.test_assert((select count(distinct order_index) = 3 from public.page_sections where user_id = v_user_id), 'section orders must be unique');
  perform public.test_assert((select array_agg(order_index order by order_index) = array[0,1,2] from public.page_sections where user_id = v_user_id), 'section orders must be 0, 1, 2');

  select id into v_funnel_id from public.funnels where user_id = v_user_id;
  perform public.test_assert((select content = jsonb_build_object(
    'heading', 'Phase Zero Wash',
    'subheading', 'Trusted service in Vancouver, BC',
    'button_text', 'Get a Free Quote',
    'background_image', 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200&q=80'
  ) from public.page_sections where user_id = v_user_id and type = 'hero'), 'hero content contract mismatch');
  perform public.test_assert((select styles = jsonb_build_object(
    'padding', '100px 20px', 'text_alignment', 'center', 'background', '#ffffff', 'visible', true
  ) from public.page_sections where user_id = v_user_id and type = 'hero'), 'hero style contract mismatch');
  perform public.test_assert((select content = jsonb_build_object(
    'headline', 'Our Services',
    'description', 'Driveway Cleaning, House Washing in Vancouver, BC.',
    'button_text', 'Request a Quote',
    'expiry', ''
  ) from public.page_sections where user_id = v_user_id and type = 'offer'), 'offer content contract mismatch');
  perform public.test_assert((select styles = jsonb_build_object(
    'padding', '80px 20px', 'background', '#4f46e5', 'color', '#ffffff', 'visible', true
  ) from public.page_sections where user_id = v_user_id and type = 'offer'), 'offer style contract mismatch');
  perform public.test_assert((select content = jsonb_build_object(
    'title', 'Get My Free Quote',
    'fields', jsonb_build_array('name', 'phone'),
    'pipeline_id', v_funnel_id
  ) from public.page_sections where user_id = v_user_id and type = 'form'), 'form content contract mismatch');
  perform public.test_assert((select styles = jsonb_build_object(
    'padding', '60px 20px', 'background', '#f8fafc', 'visible', true
  ) from public.page_sections where user_id = v_user_id and type = 'form'), 'form style contract mismatch');

  v_replay := public.create_initial_website_graph(
    'Phase Zero Wash', '(604) 555-0199', 'Vancouver, BC',
    array['Driveway Cleaning', 'House Washing'], 'website-create:local-primary'
  );
  perform public.test_assert(v_replay = v_result, 'idempotent replay must return the same envelope');
  perform public.test_assert((select count(*) = 1 from public.websites where user_id = v_user_id), 'replay added a Website');
  perform public.test_assert((select count(*) = 3 from public.page_sections where user_id = v_user_id), 'replay added sections');
  perform public.test_assert((select count(*) = 1 from private.website_creation_receipts where user_id = v_user_id), 'replay added a receipt');

  select jsonb_agg(to_jsonb(section) order by section.order_index)
  into v_sections_before
  from public.page_sections section
  where section.user_id = v_user_id;

  v_existing := public.create_initial_website_graph(
    'Different Request', '(778) 555-0100', 'Burnaby, BC',
    array['Patio Cleaning'], 'website-create:existing-graph'
  );
  perform public.test_assert((v_existing #>> '{data,created}')::boolean = false, 'existing graph should be reconciled, not recreated');
  perform public.test_assert(v_existing #>> '{data,website,id}' = v_result #>> '{data,website,id}', 'existing Website changed');
  perform public.test_assert(v_existing #>> '{data,page,id}' = v_result #>> '{data,page,id}', 'existing Page changed');
  perform public.test_assert((select jsonb_agg(to_jsonb(section) order by section.order_index) = v_sections_before from public.page_sections section where section.user_id = v_user_id), 'existing sections changed');
end;
$$;

do $$
declare
  v_user_id text := '00000000-0000-4000-8000-000000000002';
  v_failed boolean := false;
begin
  insert into public.users(id) values (v_user_id);
  insert into public.websites(user_id, name, subdomain, homepage_funnel_id, created_at, updated_at)
  values (v_user_id, 'Incomplete', 'incomplete-local', null, now(), now());
  perform set_config('request.jwt.claim.sub', v_user_id, true);
  begin
    perform public.create_initial_website_graph(
      'Incomplete', '(604) 555-0102', 'Vancouver, BC', array['Wash'], 'website-create:incomplete'
    );
  exception when sqlstate 'P0002' then
    v_failed := true;
  end;
  perform public.test_assert(v_failed, 'incomplete graph must fail closed');
  perform public.test_assert((select count(*) = 0 from private.website_creation_receipts where user_id = v_user_id), 'incomplete graph created a receipt');
end;
$$;

create or replace function public.fail_required_website_step()
returns trigger
language plpgsql
as $$
begin
  if current_setting('test.fail_relation', true) = tg_table_schema || '.' || tg_table_name then
    raise exception 'forced required-step failure';
  end if;
  return new;
end;
$$;

create trigger fail_funnels before insert on public.funnels for each row execute function public.fail_required_website_step();
create trigger fail_pages before insert on public.pages for each row execute function public.fail_required_website_step();
create trigger fail_websites before insert on public.websites for each row execute function public.fail_required_website_step();
create trigger fail_routes before insert on public.website_routes for each row execute function public.fail_required_website_step();
create trigger fail_settings before insert on public.website_settings for each row execute function public.fail_required_website_step();
create trigger fail_sections before insert on public.page_sections for each row execute function public.fail_required_website_step();
create trigger fail_receipts before insert on private.website_creation_receipts for each row execute function public.fail_required_website_step();

do $$
declare
  v_relation text;
  v_user_id text;
  v_failed boolean;
  v_index integer := 10;
begin
  foreach v_relation in array array[
    'public.funnels', 'public.pages', 'public.websites', 'public.website_routes',
    'public.website_settings', 'public.page_sections', 'private.website_creation_receipts'
  ] loop
    v_user_id := '00000000-0000-4000-8000-' || lpad(v_index::text, 12, '0');
    insert into public.users(id) values (v_user_id);
    perform set_config('request.jwt.claim.sub', v_user_id, true);
    perform set_config('test.fail_relation', v_relation, true);
    v_failed := false;
    begin
      perform public.create_initial_website_graph(
        'Rollback Test', '(604) 555-0110', 'Vancouver, BC', array['Wash'],
        'website-create:rollback-' || v_index::text
      );
    exception when others then
      v_failed := true;
    end;
    perform set_config('test.fail_relation', '', true);
    perform public.test_assert(v_failed, 'required-step failure was not raised for ' || v_relation);
    perform public.test_assert((select count(*) = 0 from public.funnels where user_id = v_user_id), 'Funnel rollback failed for ' || v_relation);
    perform public.test_assert((select count(*) = 0 from public.pages where user_id = v_user_id), 'Page rollback failed for ' || v_relation);
    perform public.test_assert((select count(*) = 0 from public.websites where user_id = v_user_id), 'Website rollback failed for ' || v_relation);
    perform public.test_assert((select count(*) = 0 from public.website_settings where user_id = v_user_id), 'Settings rollback failed for ' || v_relation);
    perform public.test_assert((select count(*) = 0 from public.page_sections where user_id = v_user_id), 'Section rollback failed for ' || v_relation);
    perform public.test_assert((select count(*) = 0 from private.website_creation_receipts where user_id = v_user_id), 'Receipt rollback failed for ' || v_relation);
    v_index := v_index + 1;
  end loop;
end;
$$;

insert into public.users(id) values ('00000000-0000-4000-8000-000000000100');

do $$
declare
  v_user_id text := '00000000-0000-4000-8000-000000000100';
  v_result_one jsonb;
  v_result_two jsonb;
begin
  perform dblink_connect('website_request_one', 'dbname=' || current_database());
  perform dblink_connect('website_request_two', 'dbname=' || current_database());
  perform dblink_send_query('website_request_one', format(
    'with identity as materialized (select set_config(''request.jwt.claim.sub'', %L, true)) select public.create_initial_website_graph(''Concurrent Wash'', ''(604) 555-0120'', ''Vancouver, BC'', array[''Wash'']::text[], ''website-create:concurrent-one'') from identity',
    v_user_id
  ));
  perform dblink_send_query('website_request_two', format(
    'with identity as materialized (select set_config(''request.jwt.claim.sub'', %L, true)) select public.create_initial_website_graph(''Concurrent Wash'', ''(604) 555-0120'', ''Vancouver, BC'', array[''Wash'']::text[], ''website-create:concurrent-two'') from identity',
    v_user_id
  ));
  select result into v_result_one from dblink_get_result('website_request_one') as response(result jsonb);
  select result into v_result_two from dblink_get_result('website_request_two') as response(result jsonb);
  perform dblink_disconnect('website_request_one');
  perform dblink_disconnect('website_request_two');

  perform public.test_assert(v_result_one #>> '{data,website,id}' = v_result_two #>> '{data,website,id}', 'concurrent requests returned different Websites');
  perform public.test_assert(v_result_one #>> '{data,page,id}' = v_result_two #>> '{data,page,id}', 'concurrent requests returned different Pages');
  perform public.test_assert((select count(*) = 1 from public.websites where user_id = v_user_id), 'concurrency created duplicate Websites');
  perform public.test_assert((select count(*) = 1 from public.pages where user_id = v_user_id), 'concurrency created duplicate Pages');
  perform public.test_assert((select count(*) = 3 from public.page_sections where user_id = v_user_id), 'concurrency created duplicate sections');
end;
$$;

do $$
declare
  v_security_definer boolean;
  v_search_path text[];
begin
  select p.prosecdef, p.proconfig into v_security_definer, v_search_path
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_initial_website_graph';

  perform public.test_assert(v_security_definer, 'RPC must remain SECURITY DEFINER');
  perform public.test_assert(v_search_path @> array['search_path=""'], 'RPC must retain an empty search_path');
  perform public.test_assert(not has_function_privilege('anon', 'public.create_initial_website_graph(text,text,text,text[],text)', 'execute'), 'anonymous execution must remain denied');
  perform public.test_assert(has_function_privilege('authenticated', 'public.create_initial_website_graph(text,text,text,text[],text)', 'execute'), 'authenticated execution must remain permitted');
end;
$$;

select 'website_generation_section_alignment: ok' as result;
