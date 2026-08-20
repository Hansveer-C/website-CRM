-- Migration: 20260817050800_create_builder_navigation_publication_and_runtime.sql
-- Description: Navigation Atomic Publication, Homepage Stable Semantics, and Runtime Authority (Phase 1B / Task 6B)
-- Invariants:
-- 1. Navigation editing changes draft state. Navigation publication changes live state.
-- 2. Public sites never read draft navigation tables.
-- 3. Visible internal navigation items must resolve to published live routes or homepage before standalone publication.
-- 4. Route publication cannot delete destinations required by visible live canonical navigation links.
-- 5. Staging empty array [] when no canonical live row exists is treated as an explicit draft adoption, not auto-cleaned.

-- Update stage_builder_site_navigation_draft to support explicit empty draft adoption and target_kind 'homepage'
create or replace function public.stage_builder_site_navigation_draft(
  p_website_id uuid,
  p_menu_scope text default 'primary',
  p_items jsonb default '[]'::jsonb,
  p_expected_base_revision integer default null,
  p_expected_draft_revision integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_menu_scope text := coalesce(nullif(trim(p_menu_scope), ''), 'primary');
  v_live_row record;
  v_draft_row record;
  v_current_live_revision integer := 0;
  v_current_draft_revision integer := 0;
  v_next_draft_revision integer := 1;
  v_item jsonb;
  v_item_id text;
  v_label text;
  v_target_kind text;
  v_target_val text;
  v_pos integer;
  v_pos_text text;
  v_pos_expected integer := 0;
  v_visible boolean;
  v_is_cta boolean;
  v_normalized_items jsonb := '[]'::jsonb;
  v_seen_ids text[] := array[]::text[];
  v_live_homepage_funnel_id text;
  v_funnel_owner text;
  v_funnel_associated boolean;
  v_is_live_equal boolean := false;
  v_now timestamptz := pg_catalog.clock_timestamp();
  c_uuid_regex constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  -- 1. Authentication check
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if v_menu_scope not in ('primary', 'footer') then
    raise sqlstate 'PT400' using message = 'Invalid menu scope: must be primary or footer';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise sqlstate 'PT400' using message = 'Navigation items must be a JSON array';
  end if;

  -- 3. Acquire website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- 4. Validate website ownership
  select true, homepage_funnel_id into v_website_exists, v_live_homepage_funnel_id
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- 5. Lock and retrieve current live & draft state
  select * into v_live_row
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = v_menu_scope
  for update;

  if found then
    v_current_live_revision := v_live_row.revision;
  end if;

  select * into v_draft_row
  from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = v_menu_scope
  for update;

  if found then
    v_current_draft_revision := v_draft_row.draft_revision;
  end if;

  -- 6. Concurrency checks
  if p_expected_base_revision is not null and p_expected_base_revision <> v_current_live_revision then
    raise sqlstate 'PT409' using message = 'Navigation has been modified live elsewhere. Reload and try again.';
  end if;

  if p_expected_draft_revision is not null and p_expected_draft_revision <> v_current_draft_revision then
    raise sqlstate 'PT409' using message = 'Navigation draft has been modified elsewhere. Reload and try again.';
  end if;

  -- 7. Validate and normalize each navigation item
  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise sqlstate 'PT400' using message = 'Navigation item must be an object';
    end if;

    v_item_id := trim(coalesce(v_item->>'id', ''));
    if v_item_id = '' or v_item_id !~* c_uuid_regex then
      raise sqlstate 'PT400' using message = 'Item ID must be a valid UUID format';
    end if;

    if v_item_id = any(v_seen_ids) then
      raise sqlstate 'PT400' using message = 'Duplicate navigation item ID: ' || v_item_id;
    end if;
    v_seen_ids := array_append(v_seen_ids, v_item_id);

    v_label := trim(coalesce(v_item->>'label', ''));
    if v_label = '' then
      raise sqlstate 'PT400' using message = 'Navigation label cannot be empty';
    end if;
    if length(v_label) > 100 then
      raise sqlstate 'PT400' using message = 'Navigation label cannot exceed 100 characters';
    end if;
    if v_label ~ '[\u0000-\u001F\u007F-\u009F]' then
      raise sqlstate 'PT400' using message = 'Navigation label contains invalid characters';
    end if;

    v_target_kind := coalesce(v_item->>'target_kind', '');
    if v_target_kind not in ('internal', 'external', 'phone', 'email', 'homepage') then
      raise sqlstate 'PT400' using message = 'Invalid target_kind: must be internal, external, phone, email, or homepage';
    end if;

    v_target_val := trim(coalesce(v_item->>'target_value', ''));

    if v_target_kind = 'homepage' then
      v_target_val := '__homepage__';
    elsif v_target_kind = 'internal' then
      if v_target_val = '' then
        raise sqlstate 'PT400' using message = 'Internal navigation item must specify a target destination/funnel ID';
      end if;

      if v_target_val <> '__homepage__' then
        -- Validate destination belongs to this tenant
        select user_id into v_funnel_owner
        from public.funnels
        where id = v_target_val;

        if not found or v_funnel_owner <> v_user_id then
          raise sqlstate 'PT404' using message = 'Internal destination not found or not owned by user';
        end if;

        -- Validate destination is associated with THIS website
        select (
          (v_live_homepage_funnel_id is not null and v_live_homepage_funnel_id = v_target_val)
          or exists (
            select 1 from public.website_routes
            where website_id = p_website_id and funnel_id = v_target_val
          )
          or exists (
            select 1 from public.builder_route_drafts
            where website_id = p_website_id and funnel_id = v_target_val
          )
        ) into v_funnel_associated;

        if coalesce(v_funnel_associated, false) is not true then
          raise sqlstate 'PT404' using message = 'Internal destination not associated with this website';
        end if;
      end if;
    elsif v_target_kind = 'external' then
      if v_target_val = '' then
        raise sqlstate 'PT400' using message = 'External URL cannot be empty';
      end if;
      if v_target_val ~ '[\u0000-\u001F\u007F-\u009F]' then
        raise sqlstate 'PT400' using message = 'External URL contains invalid characters';
      end if;
      if v_target_val !~* '^https?://' then
        raise sqlstate 'PT400' using message = 'External URL must use http:// or https:// scheme';
      end if;
    elsif v_target_kind = 'phone' then
      if v_target_val = '' then
        raise sqlstate 'PT400' using message = 'Phone number cannot be empty';
      end if;
      if v_target_val ~ '[\u0000-\u001F\u007F-\u009F]' then
        raise sqlstate 'PT400' using message = 'Phone number contains invalid characters';
      end if;
      if v_target_val !~ '^[+]?[\d\s().-]{3,30}$' then
        raise sqlstate 'PT400' using message = 'Invalid phone number format';
      end if;
    elsif v_target_kind = 'email' then
      if v_target_val = '' then
        raise sqlstate 'PT400' using message = 'Email address cannot be empty';
      end if;
      if v_target_val ~ '[\u0000-\u001F\u007F-\u009F]' then
        raise sqlstate 'PT400' using message = 'Email address contains invalid characters';
      end if;
      if v_target_val !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise sqlstate 'PT400' using message = 'Invalid email address format';
      end if;
      v_target_val := lower(v_target_val);
    end if;

    if jsonb_typeof(v_item->'position') <> 'number' then
      raise sqlstate 'PT400' using message = 'Position must be a number';
    end if;

    v_pos_text := v_item->>'position';
    if v_pos_text !~ '^[0-9]+$' then
      raise sqlstate 'PT400' using message = 'Position must be a whole non-negative integer';
    end if;

    v_pos := v_pos_text::integer;
    if v_pos < 0 then
      raise sqlstate 'PT400' using message = 'Position must be non-negative';
    end if;

    if jsonb_typeof(v_item->'visible') <> 'boolean' then
      raise sqlstate 'PT400' using message = 'Visible property must be a boolean';
    end if;
    v_visible := (v_item->>'visible')::boolean;

    if jsonb_typeof(v_item->'is_cta') <> 'boolean' then
      raise sqlstate 'PT400' using message = 'is_cta property must be a boolean';
    end if;
    v_is_cta := (v_item->>'is_cta')::boolean;

    v_normalized_items := v_normalized_items || jsonb_build_object(
      'id', v_item_id,
      'label', v_label,
      'target_kind', v_target_kind,
      'target_value', v_target_val,
      'position', v_pos_expected,
      'visible', v_visible,
      'is_cta', v_is_cta
    );
    v_pos_expected := v_pos_expected + 1;
  end loop;

  -- 8. Redundant draft check
  -- CRITICAL TASK 6B SEMANTICS:
  -- Only auto-clean redundant draft if a canonical LIVE row actually exists and is equal.
  -- If NO live row exists, staging [] creates a draft with items: [] to allow explicit empty adoption!
  if v_live_row.id is not null then
    if v_normalized_items = coalesce(v_live_row.items, '[]'::jsonb) then
      v_is_live_equal := true;
    end if;
  end if;

  if v_is_live_equal then
    if v_draft_row.id is not null then
      delete from public.builder_site_navigation_drafts
      where website_id = p_website_id and menu_scope = v_menu_scope;
    end if;

    return jsonb_build_object(
      'website_id', p_website_id,
      'menu_scope', v_menu_scope,
      'items', coalesce(v_live_row.items, '[]'::jsonb),
      'is_draft', false,
      'base_revision', v_current_live_revision,
      'draft_revision', 0,
      'live_revision', v_current_live_revision,
      'updated_at', coalesce(v_live_row.updated_at, v_now)
    );
  end if;

  -- 9. Upsert new draft revision
  if v_draft_row.id is not null then
    v_next_draft_revision := v_draft_row.draft_revision + 1;
  else
    v_next_draft_revision := 1;
  end if;

  insert into public.builder_site_navigation_drafts (
    website_id,
    menu_scope,
    items,
    base_revision,
    draft_revision,
    updated_at
  )
  values (
    p_website_id,
    v_menu_scope,
    v_normalized_items,
    v_current_live_revision,
    v_next_draft_revision,
    v_now
  )
  on conflict (website_id, menu_scope)
  do update set
    items = excluded.items,
    base_revision = excluded.base_revision,
    draft_revision = excluded.draft_revision,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'website_id', p_website_id,
    'menu_scope', v_menu_scope,
    'items', v_normalized_items,
    'is_draft', true,
    'base_revision', v_current_live_revision,
    'draft_revision', v_next_draft_revision,
    'live_revision', v_current_live_revision,
    'updated_at', v_now
  );
end;
$$;

-- RPC: Atomic Navigation Publication
create or replace function public.publish_builder_site_navigation(
  p_website_id uuid,
  p_menu_scope text default 'primary',
  p_expected_base_revision integer default null,
  p_expected_draft_revision integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_menu_scope text := coalesce(nullif(trim(p_menu_scope), ''), 'primary');
  v_live_homepage_funnel_id text;
  v_live_row record;
  v_draft_row record;
  v_current_live_revision integer := 0;
  v_next_live_revision integer := 1;
  v_item jsonb;
  v_item_visible boolean;
  v_target_kind text;
  v_target_val text;
  v_item_label text;
  v_target_resolves boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  -- 1. Authentication check
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if v_menu_scope not in ('primary', 'footer') then
    raise sqlstate 'PT400' using message = 'Invalid menu scope: must be primary or footer';
  end if;

  -- 3. Acquire website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- 4. Validate website ownership
  select true, homepage_funnel_id into v_website_exists, v_live_homepage_funnel_id
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- 5. Lock draft row
  select * into v_draft_row
  from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = v_menu_scope
  for update;

  if not found then
    raise sqlstate 'PT404' using message = 'No navigation draft found to publish';
  end if;

  -- 6. Lock live row
  select * into v_live_row
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = v_menu_scope
  for update;

  if found then
    v_current_live_revision := v_live_row.revision;
  end if;

  -- 7. Concurrency token checks
  if p_expected_base_revision is not null and p_expected_base_revision <> v_current_live_revision then
    raise sqlstate 'PT409' using message = 'Navigation has been modified live elsewhere. Reload and try again.';
  end if;

  if p_expected_draft_revision is null or p_expected_draft_revision <> v_draft_row.draft_revision then
    raise sqlstate 'PT409' using message = 'Navigation draft has been modified elsewhere. Reload and try again.';
  end if;

  -- 8. Standalone Publication Target Validation
  -- For each VISIBLE internal navigation item, ensure it resolves in LIVE state:
  -- (either stable homepage __homepage__, current live homepage funnel, or a current live route in website_routes)
  for v_item in select * from jsonb_array_elements(v_draft_row.items) loop
    v_item_visible := coalesce((v_item->>'visible')::boolean, true);
    v_target_kind := v_item->>'target_kind';
    v_target_val := v_item->>'target_value';
    v_item_label := v_item->>'label';

    if v_item_visible and v_target_kind = 'internal' and v_target_val <> '__homepage__' then
      select (
        (v_live_homepage_funnel_id is not null and v_live_homepage_funnel_id = v_target_val)
        or exists (
          select 1 from public.website_routes
          where website_id = p_website_id and funnel_id = v_target_val
        )
      ) into v_target_resolves;

      if coalesce(v_target_resolves, false) is not true then
        raise sqlstate 'PT422' using message = 'Visible navigation item "' || v_item_label || '" targets an internal destination that is not published in live routes. Publish that route first.';
      end if;
    end if;
  end loop;

  -- 9. Upsert live navigation row
  v_next_live_revision := v_current_live_revision + 1;

  insert into public.builder_site_navigation_live (
    website_id,
    menu_scope,
    items,
    revision,
    updated_at
  )
  values (
    p_website_id,
    v_menu_scope,
    v_draft_row.items,
    v_next_live_revision,
    v_now
  )
  on conflict (website_id, menu_scope)
  do update set
    items = excluded.items,
    revision = excluded.revision,
    updated_at = excluded.updated_at;

  -- 10. Delete the published draft
  delete from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = v_menu_scope;

  return jsonb_build_object(
    'success', true,
    'website_id', p_website_id,
    'menu_scope', v_menu_scope,
    'items', v_draft_row.items,
    'is_draft', false,
    'base_revision', v_next_live_revision,
    'draft_revision', 0,
    'live_revision', v_next_live_revision,
    'updated_at', v_now
  );
end;
$$;

-- Update publish_builder_routes with Live Navigation Dependency Protection
create or replace function public.publish_builder_routes(
  p_website_id uuid,
  p_expected_draft_count integer default null,
  p_expected_draft_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_draft_count integer := 0;
  v_current_draft_ids text[];
  v_draft record;
  v_funnel_owner text;
  v_destination_published boolean;
  v_old_live_path text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_live_nav_row record;
  v_nav_item jsonb;
  v_nav_item_visible boolean;
  v_nav_target_kind text;
  v_nav_target_val text;
  v_nav_label text;
begin
  -- 1. Authentication check
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  -- 3. Acquire website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- 4. Validate website ownership
  select true into v_website_exists
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- 5. Count and validate drafts
  select count(*), coalesce(array_agg(id::text order by id), array[]::text[])
  into v_draft_count, v_current_draft_ids
  from public.builder_route_drafts
  where website_id = p_website_id;

  if v_draft_count = 0 then
    return jsonb_build_object(
      'success', true,
      'published_count', 0,
      'message', 'No route drafts to publish'
    );
  end if;

  -- 6. Optimistic concurrency check on draft count and IDs
  if p_expected_draft_count is not null and v_draft_count <> p_expected_draft_count then
    raise sqlstate 'PT409' using message = 'The route drafts were modified elsewhere. Reload and try again.';
  end if;

  if p_expected_draft_ids is not null and v_current_draft_ids <> p_expected_draft_ids then
    raise sqlstate 'PT409' using message = 'The route drafts were modified elsewhere. Reload and try again.';
  end if;

  -- 7. Pre-validation loop across all drafts
  for v_draft in (
    select id, route_id, path, funnel_id, action
    from public.builder_route_drafts
    where website_id = p_website_id
  ) loop
    -- Destination funnel ownership
    select user_id into v_funnel_owner
    from public.funnels
    where id = v_draft.funnel_id;

    if not found or v_funnel_owner <> v_user_id then
      raise sqlstate 'PT404' using message = 'Funnel not found for draft route';
    end if;

    -- Root route protection
    if v_draft.path = '/' then
      raise sqlstate 'PT400' using message = 'Root homepage route cannot be published through route management.';
    end if;

    -- If delete action, verify navigation dependency
    if v_draft.action = 'delete' then
      for v_live_nav_row in (
        select items
        from public.builder_site_navigation_live
        where website_id = p_website_id
      ) loop
        for v_nav_item in select * from jsonb_array_elements(v_live_nav_row.items) loop
          v_nav_item_visible := coalesce((v_nav_item->>'visible')::boolean, true);
          v_nav_target_kind := v_nav_item->>'target_kind';
          v_nav_target_val := v_nav_item->>'target_value';
          v_nav_label := v_nav_item->>'label';

          if v_nav_item_visible and v_nav_target_kind = 'internal' and v_nav_target_val = v_draft.funnel_id then
            raise sqlstate 'PT422' using message = 'Cannot publish route deletion: visible live navigation item "' || v_nav_label || '" depends on this route destination. Update or publish navigation first.';
          end if;
        end loop;
      end loop;
    end if;

    -- If upsert, ensure destination funnel has at least one published page/revision
    if v_draft.action = 'upsert' then
      select (
        exists (
          select 1 from public.pages p
          where p.funnel_id = v_draft.funnel_id
            and p.status = 'published'
        )
        or exists (
          select 1 from public.builder_publication_targets bpt
          join public.pages p on p.id = bpt.page_id
          where p.funnel_id = v_draft.funnel_id
        )
      ) into v_destination_published;

      if coalesce(v_destination_published, false) is not true then
        raise sqlstate 'PT400' using message = 'Destination for route ' || v_draft.path || ' is not published yet. Publish that page before making its route live.';
      end if;

      -- Live collision check: Ensure no OTHER live route on this website claims this path
      -- (unless that other live route is also being renamed/deleted in this batch)
      if exists (
        select 1 from public.website_routes wr
        where wr.website_id = p_website_id
          and wr.path = v_draft.path
          and wr.id <> coalesce(v_draft.route_id, '00000000-0000-0000-0000-000000000000'::uuid)
          and not exists (
            select 1 from public.builder_route_drafts other_d
            where other_d.website_id = p_website_id
              and other_d.route_id = wr.id
              and (other_d.action = 'delete' or (other_d.action = 'upsert' and other_d.path <> v_draft.path))
          )
      ) then
        raise sqlstate 'PT409' using message = 'Path ' || v_draft.path || ' is already in use by another live page on this website';
      end if;
    end if;
  end loop;

  -- 8. Execution: Apply staged deletes
  for v_draft in (
    select id, route_id, path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'delete'
  ) loop
    if v_draft.route_id is not null then
      delete from public.website_routes
      where id = v_draft.route_id and website_id = p_website_id;
    end if;
  end loop;

  -- 9. Execution: Apply renames
  for v_draft in (
    select id, route_id, path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'upsert' and route_id is not null
  ) loop
    select path into v_old_live_path
    from public.website_routes
    where id = v_draft.route_id and website_id = p_website_id;

    if v_old_live_path is not null and v_old_live_path is distinct from v_draft.path then
      if v_old_live_path = '/' then
        raise sqlstate 'PT400' using message = 'Root homepage route cannot be renamed through route management.';
      end if;

      -- If destination path previously existed as a redirect source, remove it (live route wins)
      delete from public.website_route_redirects
      where website_id = p_website_id and from_path = v_draft.path;

      -- Create/update redirect from old path to new path
      insert into public.website_route_redirects (
        id,
        website_id,
        from_path,
        to_path,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        p_website_id,
        v_old_live_path,
        v_draft.path,
        v_now,
        v_now
      )
      on conflict (website_id, from_path)
      do update set
        to_path = excluded.to_path,
        updated_at = excluded.updated_at;

      -- Update the live route path
      update public.website_routes
      set path = v_draft.path
      where id = v_draft.route_id and website_id = p_website_id;
    end if;
  end loop;

  -- 10. Execution: Apply newly staged routes (inserts)
  for v_draft in (
    select id, path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'upsert' and route_id is null
  ) loop
    -- Clean up any redirect pointing from this new path
    delete from public.website_route_redirects
    where website_id = p_website_id and from_path = v_draft.path;

    insert into public.website_routes (
      website_id,
      path,
      funnel_id,
      created_at
    )
    values (
      p_website_id,
      v_draft.path,
      v_draft.funnel_id,
      v_now
    );
  end loop;

  -- 11. Atomic draft cleanup
  delete from public.builder_route_drafts
  where website_id = p_website_id;

  return jsonb_build_object(
    'success', true,
    'published_count', v_draft_count,
    'message', 'Route drafts published successfully'
  );
end;
$$;

-- Security & Permissions
revoke all on function public.publish_builder_site_navigation(uuid, text, integer, integer) from public, anon;
grant execute on function public.publish_builder_site_navigation(uuid, text, integer, integer) to authenticated;
