-- Transactionally atomic Page + Sections duplication for the Builder.
-- Guarantees single-transaction atomicity: page creation, section cloning, name/slug deduplication, and order assignment.

create or replace function public.duplicate_builder_page(
  p_page_id text,
  p_new_page_id text default null,
  p_name text default null,
  p_slug text default null,
  p_destination_funnel_id text default null
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
  v_name_candidate text;
  v_name_index integer;

  -- Slug helper variables
  v_root_slug text;
  v_slug_copy_num integer;
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

  -- 3. Acquire user-scoped advisory transaction lock to serialize naming, slug, and order allocation
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('duplicate-builder-page:' || v_user_id, 0)
  );

  -- 4. Load source Page and verify ownership
  select * into v_source_page
  from public.pages
  where id = p_page_id;

  if not found or v_source_page.user_id <> v_user_id then
    raise sqlstate 'PT404' using message = 'Page not found';
  end if;

  -- 5. Determine and verify target funnel ownership
  v_destination_funnel_id := nullif(trim(coalesce(p_destination_funnel_id, v_source_page.funnel_id)), '');
  if v_destination_funnel_id is not null then
    select user_id into v_funnel_owner
    from public.funnels
    where id = v_destination_funnel_id;

    if not found or v_funnel_owner <> v_user_id then
      raise sqlstate 'PT403' using message = 'Funnel ownership required';
    end if;
  end if;

  -- 6. Allocate collision-resistant new Page ID
  v_new_page_id := trim(coalesce(p_new_page_id, ''));
  if v_new_page_id = '' then
    v_new_page_id := 'pg_' || encode(gen_random_bytes(16), 'hex');
  elsif length(v_new_page_id) > 128 then
    raise sqlstate 'PT422' using message = 'Invalid new page ID';
  end if;

  if exists (select 1 from public.pages where id = v_new_page_id) then
    raise sqlstate 'PT409' using message = 'Page ID already exists';
  end if;

  -- 7. Deterministically allocate unique duplicate name
  if p_name is not null and length(trim(p_name)) > 0 then
    v_new_name := trim(p_name);
    if length(v_new_name) > 120 then
      raise sqlstate 'PT422' using message = 'Page name must be 120 characters or fewer';
    end if;
  else
    -- Extract root name and any existing (Copy N) suffix
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
      v_name_candidate := substring(v_root_name || ' (Copy)' from 1 for 120);
      if not exists (select 1 from public.pages where user_id = v_user_id and lower(name) = lower(v_name_candidate)) then
        v_new_name := v_name_candidate;
      end if;
    end if;

    if v_new_name is null then
      v_name_index := coalesce(v_copy_num, 1) + 1;
      while v_name_index < 1000 loop
        v_name_candidate := substring(v_root_name || ' (Copy ' || v_name_index || ')' from 1 for 120);
        if not exists (select 1 from public.pages where user_id = v_user_id and lower(name) = lower(v_name_candidate)) then
          v_new_name := v_name_candidate;
          exit;
        end if;
        v_name_index := v_name_index + 1;
      end loop;
    end if;

    if v_new_name is null then
      v_new_name := substring(v_root_name || ' (Copy ' || extract(epoch from now())::bigint || ')' from 1 for 120);
    end if;
  end if;

  -- 8. Deterministically allocate unique duplicate slug
  if p_slug is not null and length(trim(p_slug)) > 0 then
    v_new_slug := lower(trim(p_slug));
    v_new_slug := regexp_replace(v_new_slug, '^/+|/+$', '', 'g');
    v_new_slug := regexp_replace(v_new_slug, '[\s_-]+', '-', 'g');
    if length(v_new_slug) > 120 then
      raise sqlstate 'PT422' using message = 'URL slug must be 120 characters or fewer';
    end if;
    if exists (select 1 from public.pages where user_id = v_user_id and lower(slug) = v_new_slug) then
      raise sqlstate 'PT409' using message = 'Another page in this account already uses this URL.';
    end if;
  else
    -- Extract root slug and any existing -copy-N suffix
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
      v_slug_candidate := substring(v_root_slug || '-copy' from 1 for 120);
      if not exists (select 1 from public.pages where user_id = v_user_id and lower(slug) = lower(v_slug_candidate)) then
        v_new_slug := v_slug_candidate;
      end if;
    end if;

    if v_new_slug is null then
      v_slug_index := coalesce(v_slug_copy_num, 1) + 1;
      while v_slug_index < 1000 loop
        v_slug_candidate := substring(v_root_slug || '-copy-' || v_slug_index from 1 for 120);
        if not exists (select 1 from public.pages where user_id = v_user_id and lower(slug) = lower(v_slug_candidate)) then
          v_new_slug := v_slug_candidate;
          exit;
        end if;
        v_slug_index := v_slug_index + 1;
      end loop;
    end if;

    if v_new_slug is null then
      v_new_slug := substring(v_root_slug || '-copy-' || extract(epoch from now())::bigint from 1 for 120);
    end if;
  end if;

  -- 9. Deterministically assign step_order within target funnel
  if v_destination_funnel_id is not null then
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

  -- 11. Deep-copy all sections losslessly with fresh generated IDs
  insert into public.page_sections(
    id,
    user_id,
    page_id,
    funnel_id,
    type,
    content,
    styles,
    order_index,
    created_at
  )
  select
    'sec_' || encode(gen_random_bytes(16), 'hex'),
    v_user_id,
    v_new_page_id,
    v_destination_funnel_id,
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
          'funnel_id', sec.funnel_id,
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

revoke all on function public.duplicate_builder_page(text, text, text, text, text) from public, anon;
grant execute on function public.duplicate_builder_page(text, text, text, text, text) to authenticated;

comment on function public.duplicate_builder_page(text, text, text, text, text) is
  'Transactionally duplicates a builder page and all of its sections for the authenticated owner.';
