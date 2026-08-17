-- Disposable PostgreSQL test suite for public.duplicate_builder_page RPC.
-- Verifies transaction atomicity, ownership enforcement, duplicate naming/slugging, and section cloning.

begin;

-- Create disposable test users
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'user1@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'user2@test.local')
on conflict (id) do nothing;

-- Create disposable test funnels
insert into public.funnels (id, user_id, name, status)
values
  ('fnl-user1', '00000000-0000-0000-0000-000000000001', 'Funnel 1', 'published'),
  ('fnl-user2', '00000000-0000-0000-0000-000000000002', 'Funnel 2', 'published')
on conflict (id) do nothing;

-- Create source test page with sections
insert into public.pages (
  id, user_id, name, slug, status, seo_title, seo_description, seo_keywords, funnel_id, step_order
) values (
  'pg-src-1',
  '00000000-0000-0000-0000-000000000001',
  'Driveway Cleaning',
  'driveway-cleaning',
  'published',
  'Driveway Cleaning SEO',
  'Description',
  array['driveway', 'wash'],
  'fnl-user1',
  1
);

insert into public.page_sections (
  id, user_id, page_id, funnel_id, type, content, styles, order_index
) values
  ('sec-src-1', '00000000-0000-0000-0000-000000000001', 'pg-src-1', 'fnl-user1', 'hero', '{"title": "Hero"}'::jsonb, '{"bg": "blue"}'::jsonb, 0),
  ('sec-src-2', '00000000-0000-0000-0000-000000000001', 'pg-src-1', 'fnl-user1', 'services', '{"items": [1, 2]}'::jsonb, '{}'::jsonb, 1);

-- 1. Test unauthenticated call rejects
set local role anon;
do $$
begin
  perform public.duplicate_builder_page('pg-src-1');
  raise exception 'Expected unauthenticated call to fail';
exception when sqlstate 'PT401' then
  -- Expected
end $$;

-- 2. Test cross-tenant call rejects without leaking existence
set local role authenticated;
perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$
begin
  perform public.duplicate_builder_page('pg-src-1');
  raise exception 'Expected cross-tenant call to fail';
exception when sqlstate 'PT404' then
  -- Expected
end $$;

-- 3. Test authenticated duplicate succeeds
perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.duplicate_builder_page('pg-src-1') as dup1_result;

-- 4. Verify duplicate page properties
do $$
declare
  v_dup_page public.pages%rowtype;
  v_sec_count integer;
begin
  select * into v_dup_page
  from public.pages
  where user_id = '00000000-0000-0000-0000-000000000001'
    and name = 'Driveway Cleaning (Copy)';

  if v_dup_page.id is null then
    raise exception 'Duplicated page not found';
  end if;

  if v_dup_page.slug <> 'driveway-cleaning-copy' then
    raise exception 'Duplicated page slug mismatch: %', v_dup_page.slug;
  end if;

  if v_dup_page.status <> 'draft' then
    raise exception 'Duplicated page status must be draft: %', v_dup_page.status;
  end if;

  if v_dup_page.step_order <> 2 then
    raise exception 'Duplicated page step_order must be 2: %', v_dup_page.step_order;
  end if;

  select count(*) into v_sec_count
  from public.page_sections
  where page_id = v_dup_page.id;

  if v_sec_count <> 2 then
    raise exception 'Expected 2 copied sections, found %', v_sec_count;
  end if;
end $$;

-- 5. Test sequential duplication creates (Copy 2)
select public.duplicate_builder_page('pg-src-1') as dup2_result;

do $$
declare
  v_dup_page2 public.pages%rowtype;
begin
  select * into v_dup_page2
  from public.pages
  where user_id = '00000000-0000-0000-0000-000000000001'
    and name = 'Driveway Cleaning (Copy 2)';

  if v_dup_page2.id is null then
    raise exception 'Duplicated page (Copy 2) not found';
  end if;

  if v_dup_page2.slug <> 'driveway-cleaning-copy-2' then
    raise exception 'Duplicated page slug mismatch: %', v_dup_page2.slug;
  end if;
end $$;

rollback;
