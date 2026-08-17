-- Transactionally atomic Page Creation and Duplication RPCs for the Builder.
-- Guarantees single-transaction atomicity: page creation, section cloning, name/slug deduplication, and order assignment.

-- ============================================================================
-- 1. CREATE BUILDER PAGE RPC
-- ============================================================================

create or replace function public.create_builder_page(
  p_name text,
  p_slug text,
  p_funnel_id text,
  p_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_funnel_owner text;
  v_new_page_id text;
  v_name text;
  v_slug text;
  v_step_order integer;
  v_created_page public.pages%rowtype;
  v_result jsonb;
begin
  -- 1. Authenticated user verification
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation: Name
  v_name := trim(coalesce(p_name, ''));
  if v_name = '' then
    raise sqlstate 'PT422' using message = 'Page name is required';
  end if;
  if length(v_name) > 120 then
    raise sqlstate 'PT422' using message = 'Page name must be 120 characters or fewer';
  end if;
  if v_name ~ '[\x01-\x1f\x7f]' then
    raise sqlstate 'PT422' using message = 'Page name contains invalid control characters';
  end if;

  -- 3. Input validation: Slug
  v_slug := lower(trim(coalesce(p_slug, '')));
  v_slug := regexp_replace(v_slug, '^/+|/+$', '', 'g');
  v_slug := regexp_replace(v_slug, '[\s_-]+', '-', 'g');
  if v_slug = '' then
    raise sqlstate 'PT422' using message = 'Page slug is required';
  end if;
  if length(v_slug) > 120 then
    raise sqlstate 'PT422' using message = 'URL slug must be 120 characters or fewer';
  end if;
  if not (v_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') then
    raise sqlstate 'PT422' using message = 'Invalid URL slug format';
  end if;
  if v_slug in ('home', 'api', 'builder', 'functions', 'login', 'preview', 'website-dashboard') then
    raise sqlstate 'PT422' using message = 'URL slug is reserved';
  end if;

  if p_funnel_id is null or length(trim(p_funnel_id)) = 0 then
    raise sqlstate 'PT422' using message = 'Funnel ID is required';
  end if;

  -- 4. Verify target funnel ownership
  select user_id into v_funnel_owner
  from public.funnels
  where id = p_funnel_id;

  if not found or v_funnel_owner <> v_user_id then
    raise sqlstate 'PT403' using message = 'Funnel ownership required';
  end if;

  -- 5. Acquire shared lifecycle advisory transaction lock on user+funnel
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-page-lifecycle:' || v_user_id || ':' || p_funnel_id, 0)
  );

  -- 6. Check for idempotent retry or ID conflict if p_id is supplied
  v_new_page_id := trim(coalesce(p_id, ''));
  if v_new_page_id <> '' then
    if length(v_new_page_id) > 128 then
      raise sqlstate 'PT422' using message = 'Invalid page ID';
    end if;

    select * into v_created_page
    from public.pages
    where id = v_new_page_id;

    if found then
      if v_created_page.user_id = v_user_id
         and v_created_page.name = v_name
         and v_created_page.slug = v_slug
         and v_created_page.funnel_id = p_funnel_id
         and v_created_page.status = 'draft' then
        -- Idempotent return of existing draft Page
        select jsonb_build_object(
          'id', v_created_page.id,
          'user_id', v_created_page.user_id,
          'name', v_created_page.name,
          'slug', v_created_page.slug,
          'status', v_created_page.status,
          'seo_title', coalesce(v_created_page.seo_title, ''),
          'seo_description', coalesce(v_created_page.seo_description, ''),
          'seo_keywords', coalesce(v_created_page.seo_keywords, '{}'::text[]),
          'schema_markup', coalesce(v_created_page.schema_markup, ''),
          'created_at', to_char(v_created_page.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'funnel_id', v_created_page.funnel_id,
          'step_type', v_created_page.step_type,
          'step_order', v_created_page.step_order
        ) into v_result;
        return v_result;
      else
        raise sqlstate 'PT409' using message = 'Page ID already exists';
      end if;
    end if;
  else
    v_new_page_id := 'pg_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  end if;

  -- 7. Enforce slug uniqueness within tenant
  if exists (select 1 from public.pages where user_id = v_user_id and lower(slug) = v_slug) then
    raise sqlstate 'PT409' using message = 'Another page in this account already uses this URL.';
  end if;

  -- 8. Deterministically assign step_order under advisory lock
  select coalesce(max(step_order), -1) + 1 into v_step_order
  from public.pages
  where user_id = v_user_id and funnel_id = p_funnel_id and step_order is not null;
  if v_step_order < 0 then
    v_step_order := 0;
  end if;

  -- 9. Insert new draft Page
  insert into public.pages(
    id,
    user_id,
    name,
    slug,
    status,
    seo_title,
    seo_description,
    seo_keywords,
    schema_markup,
    created_at,
    funnel_id,
    step_type,
    step_order
  ) values (
    v_new_page_id,
    v_user_id,
    v_name,
    v_slug,
    'draft',
    null,
    null,
    '{}'::text[],
    null,
    now(),
    p_funnel_id,
    'page',
    v_step_order
  )
  returning * into v_created_page;

  -- 10. Return canonical JSON
  select jsonb_build_object(
    'id', v_created_page.id,
    'user_id', v_created_page.user_id,
    'name', v_created_page.name,
    'slug', v_created_page.slug,
    'status', v_created_page.status,
    'seo_title', coalesce(v_created_page.seo_title, ''),
    'seo_description', coalesce(v_created_page.seo_description, ''),
    'seo_keywords', coalesce(v_created_page.seo_keywords, '{}'::text[]),
    'schema_markup', coalesce(v_created_page.schema_markup, ''),
    'created_at', to_char(v_created_page.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'funnel_id', v_created_page.funnel_id,
    'step_type', v_created_page.step_type,
    'step_order', v_created_page.step_order
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_builder_page(text, text, text, text) from public, anon;
grant execute on function public.create_builder_page(text, text, text, text) to authenticated;

comment on function public.create_builder_page(text, text, text, text) is
  'Transactionally creates a draft builder page in an owned funnel with server-determined step order and idempotency.';

-- ============================================================================
-- 2. DUPLICATE BUILDER PAGE RPC
-- ============================================================================

create or replace function public.duplicate_builder_page(
  p_page_id text,
  p_new_page_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_source_page public.pages%rowtype;
  v_funnel_owner text;
  v_destination_funnel_id text;
  v_new_page_id text;
  v_new_name text;
  v_new_slug text;
  v_step_order integer;
  v_created_page public.pages%rowtype;
  v_result jsonb;

  -- Naming helper variables
  v_root_name text;
  v_copy_num integer;
  v_suffix text;
  v_max_base_len integer;
  v_name_candidate text;
  v_name_index integer;

  -- Slug helper variables
  v_root_slug text;
  v_slug_copy_num integer;
  v_slug_suffix text;
  v_max_slug_base_len integer;
  v_slug_candidate text;
  v_slug_index integer;
begin
  -- 1. Authenticated user verification
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_page_id is null or length(trim(p_page_id)) = 0 or length(p_page_id) > 128 then
    raise sqlstate 'PT404' using message = 'Page not found';
  end if;

  -- 3. Load source Page and verify ownership
  select * into v_source_page
  from public.pages
  where id = p_page_id;

  if not found or v_source_page.user_id <> v_user_id then
    raise sqlstate 'PT404' using message = 'Page not found';
  end if;

  v_destination_funnel_id := v_source_page.funnel_id;

  -- 4. Verify source Funnel ownership if funnel_id is present
  if v_destination_funnel_id is not null and v_destination_funnel_id <> '' then
    select user_id into v_funnel_owner
    from public.funnels
    where id = v_destination_funnel_id;

    if not found or v_funnel_owner <> v_user_id then
      raise sqlstate 'PT403' using message = 'Corrupt or unowned funnel relationship';
    end if;
  end if;

  -- 5. Acquire shared lifecycle advisory transaction lock on user+funnel
  if v_destination_funnel_id is not null and v_destination_funnel_id <> '' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('builder-page-lifecycle:' || v_user_id || ':' || v_destination_funnel_id, 0)
    );
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('builder-page-lifecycle:' || v_user_id || ':nofunnel', 0)
    );
  end if;

  -- 6. Allocate collision-resistant new Page ID
  v_new_page_id := trim(coalesce(p_new_page_id, ''));
  if v_new_page_id = '' then
    v_new_page_id := 'pg_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  elsif length(v_new_page_id) > 128 then
    raise sqlstate 'PT422' using message = 'Invalid new page ID';
  end if;

  if exists (select 1 from public.pages where id = v_new_page_id) then
    raise sqlstate 'PT409' using message = 'Page ID already exists';
  end if;

  -- 7. Deterministically allocate unique duplicate name reserving suffix capacity
  v_root_name := regexp_replace(v_source_page.name, '\s+\(Copy(?:\s+\d+)?\)$', '', 'i');
  if v_root_name is null or length(trim(v_root_name)) = 0 then
    v_root_name := 'Untitled page';
  end if;

  if v_source_page.name ~* '\s+\(Copy\s+(\d+)\)$' then
    v_copy_num := (regexp_matches(v_source_page.name, '\s+\(Copy\s+(\d+)\)$', 'i'))[1]::integer;
  elsif v_source_page.name ~* '\s+\(Copy\)$' then
    v_copy_num := 1;
  else
    v_copy_num := null;
  end if;

  if v_copy_num is null then
    v_suffix := ' (Copy)';
    v_max_base_len := 120 - length(v_suffix);
    v_name_candidate := substring(v_root_name from 1 for v_max_base_len) || v_suffix;
    if not exists (select 1 from public.pages where user_id = v_user_id and lower(name) = lower(v_name_candidate)) then
      v_new_name := v_name_candidate;
    end if;
  end if;

  if v_new_name is null then
    v_name_index := coalesce(v_copy_num, 1) + 1;
    while v_name_index < 1000 loop
      v_suffix := ' (Copy ' || v_name_index || ')';
      v_max_base_len := 120 - length(v_suffix);
      v_name_candidate := substring(v_root_name from 1 for v_max_base_len) || v_suffix;
      if not exists (select 1 from public.pages where user_id = v_user_id and lower(name) = lower(v_name_candidate)) then
        v_new_name := v_name_candidate;
        exit;
      end if;
      v_name_index := v_name_index + 1;
    end loop;
  end if;

  if v_new_name is null then
    v_suffix := ' (Copy ' || extract(epoch from now())::bigint || ')';
    v_max_base_len := 120 - length(v_suffix);
    v_new_name := substring(v_root_name from 1 for v_max_base_len) || v_suffix;
  end if;

  -- 8. Deterministically allocate unique duplicate slug reserving suffix capacity
  v_root_slug := regexp_replace(v_source_page.slug, '-copy(?:-\d+)?$', '');
  if v_root_slug is null or length(trim(v_root_slug)) = 0 then
    v_root_slug := 'page';
  end if;

  if v_source_page.slug ~ '-copy-(\d+)$' then
    v_slug_copy_num := (regexp_matches(v_source_page.slug, '-copy-(\d+)$'))[1]::integer;
  elsif v_source_page.slug ~ '-copy$' then
    v_slug_copy_num := 1;
  else
    v_slug_copy_num := null;
  end if;

  if v_slug_copy_num is null then
    v_slug_suffix := '-copy';
    v_max_slug_base_len := 120 - length(v_slug_suffix);
    v_slug_candidate := substring(v_root_slug from 1 for v_max_slug_base_len) || v_slug_suffix;
    if not exists (select 1 from public.pages where user_id = v_user_id and lower(slug) = lower(v_slug_candidate)) then
      v_new_slug := v_slug_candidate;
    end if;
  end if;

  if v_new_slug is null then
    v_slug_index := coalesce(v_slug_copy_num, 1) + 1;
    while v_slug_index < 1000 loop
      v_slug_suffix := '-copy-' || v_slug_index;
      v_max_slug_base_len := 120 - length(v_slug_suffix);
      v_slug_candidate := substring(v_root_slug from 1 for v_max_slug_base_len) || v_slug_suffix;
      if not exists (select 1 from public.pages where user_id = v_user_id and lower(slug) = lower(v_slug_candidate)) then
        v_new_slug := v_slug_candidate;
        exit;
      end if;
      v_slug_index := v_slug_index + 1;
    end loop;
  end if;

  if v_new_slug is null then
    v_slug_suffix := '-copy-' || extract(epoch from now())::bigint;
    v_max_slug_base_len := 120 - length(v_slug_suffix);
    v_new_slug := substring(v_root_slug from 1 for v_max_slug_base_len) || v_slug_suffix;
  end if;

  -- 9. Deterministically assign step_order within target funnel
  if v_destination_funnel_id is not null and v_destination_funnel_id <> '' then
    select coalesce(max(step_order), -1) + 1 into v_step_order
    from public.pages
    where user_id = v_user_id and funnel_id = v_destination_funnel_id and step_order is not null;
    if v_step_order < 0 then
      v_step_order := null;
    end if;
  else
    v_step_order := null;
  end if;

  -- 10. Insert new draft Page
  insert into public.pages(
    id,
    user_id,
    name,
    slug,
    status,
    seo_title,
    seo_description,
    seo_keywords,
    schema_markup,
    created_at,
    funnel_id,
    step_type,
    step_order
  ) values (
    v_new_page_id,
    v_user_id,
    v_new_name,
    v_new_slug,
    'draft',
    v_source_page.seo_title,
    v_source_page.seo_description,
    coalesce(v_source_page.seo_keywords, '{}'::text[]),
    v_source_page.schema_markup,
    now(),
    v_destination_funnel_id,
    v_source_page.step_type,
    v_step_order
  )
  returning * into v_created_page;

  -- 11. Deep-copy all sections losslessly with fresh generated IDs (NO funnel_id column on page_sections!)
  insert into public.page_sections(
    id,
    user_id,
    page_id,
    type,
    content,
    styles,
    order_index,
    created_at
  )
  select
    'sec_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    v_user_id,
    v_new_page_id,
    s.type,
    s.content,
    s.styles,
    row_number() over (order by coalesce(s.order_index, 0), s.id) - 1,
    now()
  from public.page_sections s
  where s.page_id = p_page_id
    and s.user_id = v_user_id
  order by coalesce(s.order_index, 0), s.id;

  -- 12. Build and return canonical JSON structure
  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', v_created_page.id,
      'user_id', v_created_page.user_id,
      'name', v_created_page.name,
      'slug', v_created_page.slug,
      'status', v_created_page.status,
      'seo_title', coalesce(v_created_page.seo_title, ''),
      'seo_description', coalesce(v_created_page.seo_description, ''),
      'seo_keywords', coalesce(v_created_page.seo_keywords, '{}'::text[]),
      'schema_markup', coalesce(v_created_page.schema_markup, ''),
      'created_at', to_char(v_created_page.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'funnel_id', v_created_page.funnel_id,
      'step_type', v_created_page.step_type,
      'step_order', v_created_page.step_order
    ),
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sec.id,
          'page_id', sec.page_id,
          'type', sec.type,
          'content', sec.content,
          'styles', sec.styles,
          'order', sec.order_index,
          'variant', case
            when sec.content ? '__builder_variant' then sec.content->>'__builder_variant'
            else null
          end
        ) order by sec.order_index
      )
      from public.page_sections sec
      where sec.page_id = v_new_page_id
        and sec.user_id = v_user_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.duplicate_builder_page(text, text) from public, anon;
grant execute on function public.duplicate_builder_page(text, text) to authenticated;

comment on function public.duplicate_builder_page(text, text) is
  'Transactionally duplicates a builder page and all of its sections for the authenticated owner.';
