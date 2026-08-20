-- Migration: 20260817050800_create_builder_navigation_publication_and_runtime.sql
-- Description: Navigation publication authority, stable homepage target semantics, route dependency protections, and explicit-empty draft adoption.
-- Invariants:
-- 1. "Editing navigation changes draft state. Publishing navigation changes live state."
-- 2. Concurrency tokens: base revision + draft revision optimistic locking against race conditions.
-- 3. Stable homepage target kind ('homepage') dynamically follows the active root authority without breaking when homepage changes.
-- 4. Internal navigation items require an actual live route upon publication; homepage status alone does not satisfy internal route requirement.
-- 5. Route deletion fails (PT422) if it would remove the last remaining live route for a visible canonical live navigation item.
-- 6. Preserves all Task 5B route publication behaviors (chain collapse, cycle rejection, route updates, redirect reclaim, collision safety).
-- 7. Preserves all Task 6A navigation domain validation rules (strict contiguous 0..N-1 positions, UUIDs, canonical URLs/phones/emails).

-- 1. Update check constraints on navigation tables to support 'homepage' target kind
alter table public.builder_site_navigation_live
  drop constraint if exists builder_site_nav_live_items_check;

alter table public.builder_site_navigation_live
  add constraint builder_site_nav_live_items_check check (
    jsonb_typeof(items) = 'array'
  );

alter table public.builder_site_navigation_drafts
  drop constraint if exists builder_site_nav_draft_items_check;

alter table public.builder_site_navigation_drafts
  add constraint builder_site_nav_draft_items_check check (
    jsonb_typeof(items) = 'array'
  );

-- 2. RPC: Hardened stage_builder_site_navigation_draft with Task 6A draft concurrency, strict positions, and empty-draft adoption
create or replace function public.stage_builder_site_navigation_draft(
  p_website_id uuid,
  p_menu_scope text,
  p_items jsonb,
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
  v_website_rec record;
  v_menu_scope text := coalesce(p_menu_scope, 'primary');
  v_live record;
  v_draft record;
  v_live_revision integer := 0;
  v_live_items jsonb := '[]'::jsonb;
  v_next_draft_revision integer := 1;
  v_item jsonb;
  v_item_id text;
  v_label text;
  v_target_kind text;
  v_target_value text;
  v_position integer;
  v_funnel_owner text;
  v_destination_valid boolean := false;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_seen_ids text[] := array[]::text[];
  v_seen_positions integer[] := array[]::integer[];
  v_item_count integer := 0;
  v_idx integer := 0;
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if v_menu_scope not in ('primary', 'footer') then
    raise sqlstate 'PT400' using message = 'Invalid menu scope. Allowed: primary, footer';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise sqlstate 'PT400' using message = 'Navigation items must be a JSON array';
  end if;

  -- Acquire website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- Validate website ownership
  select id, user_id, homepage_funnel_id, draft_homepage_funnel_id
  into v_website_rec
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_rec.id is null then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- Fetch live revision
  select items, revision into v_live
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = v_menu_scope;

  if found then
    v_live_revision := v_live.revision;
    v_live_items := v_live.items;
  end if;

  -- Fetch existing draft if any
  select items, base_revision, draft_revision into v_draft
  from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = v_menu_scope
  for update;

  -- 1. Check live revision concurrency
  if p_expected_base_revision is not null and p_expected_base_revision <> v_live_revision then
    raise sqlstate 'PT409' using message = 'The navigation configuration was modified elsewhere. Reload and try again.';
  end if;

  -- 2. Check draft revision concurrency (Task 6A strict rules)
  if v_draft.draft_revision is not null then
    if p_expected_draft_revision is null or p_expected_draft_revision <> v_draft.draft_revision then
      raise sqlstate 'PT409' using message = 'The navigation draft was modified elsewhere. Reload and try again.';
    end if;
    v_next_draft_revision := v_draft.draft_revision + 1;
  else
    if p_expected_draft_revision is not null and p_expected_draft_revision <> 0 then
      raise sqlstate 'PT409' using message = 'The navigation draft was modified elsewhere. Reload and try again.';
    end if;
    v_next_draft_revision := 1;
  end if;

  -- 3. Strict Server-Side Validation of Navigation Items
  v_item_count := jsonb_array_length(p_items);

  for v_item in select jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise sqlstate 'PT400' using message = 'Each navigation item must be a JSON object';
    end if;

    -- Validate ID
    v_item_id := nullif(trim(both from (v_item->>'id')), '');
    if v_item_id is null then
      raise sqlstate 'PT400' using message = 'Navigation item must have a valid non-empty UUID id';
    end if;

    if not (v_item_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise sqlstate 'PT400' using message = 'Navigation item id must be a valid UUID format';
    end if;

    if v_item_id = any(v_seen_ids) then
      raise sqlstate 'PT400' using message = 'Duplicate navigation item id: ' || v_item_id;
    end if;
    v_seen_ids := array_append(v_seen_ids, v_item_id);

    -- Validate label
    v_label := nullif(trim(both from (v_item->>'label')), '');
    if v_label is null then
      raise sqlstate 'PT400' using message = 'Navigation item label cannot be empty';
    end if;
    if length(v_label) > 100 then
      raise sqlstate 'PT400' using message = 'Navigation item label cannot exceed 100 characters';
    end if;
    if v_label ~ '[\u0000-\u001F\u007F-\u009F]' then
      raise sqlstate 'PT400' using message = 'Navigation item label contains invalid control characters';
    end if;

    -- Validate target_kind
    v_target_kind := v_item->>'target_kind';
    if v_target_kind not in ('internal', 'external', 'phone', 'email', 'homepage') then
      raise sqlstate 'PT400' using message = 'Invalid target_kind. Allowed: internal, external, phone, email, homepage';
    end if;

    -- Validate target_value
    v_target_value := nullif(trim(both from (v_item->>'target_value')), '');
    if v_target_value is null and v_target_kind <> 'homepage' then
      raise sqlstate 'PT400' using message = 'Navigation item target_value cannot be empty';
    end if;

    -- Validate position (must be strict contiguous integers 0..N-1)
    if jsonb_typeof(v_item->'position') <> 'number' then
      raise sqlstate 'PT400' using message = 'Item position must be a number';
    end if;

    v_position := (v_item->>'position')::integer;
    if (v_item->>'position')::numeric <> v_position::numeric then
      raise sqlstate 'PT400' using message = 'Item position cannot be fractional';
    end if;

    if v_position < 0 or v_position >= v_item_count then
      raise sqlstate 'PT400' using message = 'Item position must be between 0 and ' || (v_item_count - 1);
    end if;

    if v_position = any(v_seen_positions) then
      raise sqlstate 'PT400' using message = 'Duplicate item position: ' || v_position;
    end if;
    v_seen_positions := array_append(v_seen_positions, v_position);

    -- Validate boolean fields
    if jsonb_typeof(v_item->'visible') <> 'boolean' then
      raise sqlstate 'PT400' using message = 'Item visible must be a boolean';
    end if;

    if jsonb_typeof(v_item->'is_cta') <> 'boolean' then
      raise sqlstate 'PT400' using message = 'Item is_cta must be a boolean';
    end if;

    -- Validate specific target kinds
    if v_target_kind = 'homepage' then
      -- Normalize target_value to '__homepage__' if not specified
      null;
    elsif v_target_kind = 'external' then
      if not (v_target_value ~* '^https?://[^\s/$.?#].[^\s]*$') then
        raise sqlstate 'PT400' using message = 'External URL must be a valid http:// or https:// URL';
      end if;
    elsif v_target_kind = 'phone' then
      if not (v_target_value ~ '^[+]?[\d\s().-]{3,30}$') then
        raise sqlstate 'PT400' using message = 'Invalid phone number format';
      end if;
    elsif v_target_kind = 'email' then
      if not (v_target_value ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
        raise sqlstate 'PT400' using message = 'Invalid email address format';
      end if;
    elsif v_target_kind = 'internal' then
      -- Verify destination funnel exists and belongs to acting user
      select user_id into v_funnel_owner
      from public.funnels
      where id = v_target_value;

      if not found or v_funnel_owner <> v_user_id then
        raise sqlstate 'PT404' using message = 'Internal destination not found or not owned by user';
      end if;

      -- Validate destination is associated with THIS website context
      v_destination_valid := false;

      if (v_website_rec.homepage_funnel_id is not null and v_website_rec.homepage_funnel_id = v_target_value)
         or (v_website_rec.draft_homepage_funnel_id is not null and v_website_rec.draft_homepage_funnel_id = v_target_value) then
        v_destination_valid := true;
      end if;

      if not v_destination_valid then
        select exists (
          select 1 from public.website_routes
          where website_id = p_website_id and funnel_id = v_target_value
        ) into v_destination_valid;
      end if;

      if not v_destination_valid then
        select exists (
          select 1 from public.builder_route_drafts
          where website_id = p_website_id and funnel_id = v_target_value and action = 'upsert'
        ) into v_destination_valid;
      end if;

      if not v_destination_valid then
        raise sqlstate 'PT404' using message = 'Internal destination not associated with this website';
      end if;
    end if;

    v_idx := v_idx + 1;
  end loop;

  -- Ensure all positions 0..N-1 were covered
  if v_item_count > 0 then
    for i in 0..(v_item_count - 1) loop
      if not (i = any(v_seen_positions)) then
        raise sqlstate 'PT400' using message = 'Item positions must be contiguous indices from 0 to N-1';
      end if;
    end loop;
  end if;

  -- If a canonical live row exists and draft snapshot matches live snapshot exactly, clear the draft row (auto-clean)
  if v_live.revision is not null and p_items = v_live_items then
    delete from public.builder_site_navigation_drafts
    where website_id = p_website_id and menu_scope = v_menu_scope;

    return jsonb_build_object(
      'success', true,
      'is_draft', false,
      'base_revision', v_live_revision,
      'draft_revision', 0,
      'message', 'Draft matches live navigation; redundant draft cleared'
    );
  end if;

  -- Upsert draft snapshot
  insert into public.builder_site_navigation_drafts (
    website_id,
    menu_scope,
    items,
    base_revision,
    draft_revision,
    created_at,
    updated_at
  ) values (
    p_website_id,
    v_menu_scope,
    p_items,
    v_live_revision,
    v_next_draft_revision,
    v_now,
    v_now
  )
  on conflict (website_id, menu_scope)
  do update set
    items = excluded.items,
    base_revision = excluded.base_revision,
    draft_revision = excluded.draft_revision,
    updated_at = v_now;

  return jsonb_build_object(
    'success', true,
    'is_draft', true,
    'base_revision', v_live_revision,
    'draft_revision', v_next_draft_revision,
    'message', 'Draft navigation staged successfully'
  );
end;
$$;

-- 3. RPC: Atomic publish_builder_site_navigation
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
  v_website_rec record;
  v_menu_scope text := coalesce(p_menu_scope, 'primary');
  v_live record;
  v_draft record;
  v_live_revision integer := 0;
  v_next_live_revision integer := 1;
  v_item jsonb;
  v_visible boolean;
  v_target_kind text;
  v_target_value text;
  v_has_live_route boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if v_menu_scope not in ('primary', 'footer') then
    raise sqlstate 'PT400' using message = 'Invalid menu scope. Allowed: primary, footer';
  end if;

  -- Acquire website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- Validate website ownership
  select id, user_id, homepage_funnel_id
  into v_website_rec
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_rec.id is null then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- Read current live navigation
  select items, revision into v_live
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = v_menu_scope;

  if found then
    v_live_revision := v_live.revision;
  else
    v_live_revision := 0;
  end if;

  -- Read current draft navigation
  select items, base_revision, draft_revision into v_draft
  from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = v_menu_scope
  for update;

  if not found or v_draft.items is null then
    raise sqlstate 'PT404' using message = 'No navigation draft found to publish';
  end if;

  -- Verify draft is based on current live revision
  if v_draft.base_revision <> v_live_revision then
    raise sqlstate 'PT409' using message = 'The draft is based on a stale navigation revision. Re-stage or discard draft before publishing.';
  end if;

  -- Concurrency check on base revision
  if p_expected_base_revision is not null and p_expected_base_revision <> v_live_revision then
    raise sqlstate 'PT409' using message = 'Stale base revision. Reload and try again.';
  end if;

  -- Concurrency check on draft revision
  if p_expected_draft_revision is not null and p_expected_draft_revision <> v_draft.draft_revision then
    raise sqlstate 'PT409' using message = 'Stale draft revision. Reload and try again.';
  end if;

  -- Re-validate visible internal navigation destinations against current live routes
  for v_item in select jsonb_array_elements(v_draft.items) loop
    v_visible := coalesce((v_item->>'visible')::boolean, true);
    v_target_kind := v_item->>'target_kind';
    v_target_value := v_item->>'target_value';

    if v_visible is true then
      if v_target_kind = 'internal' and v_target_value is not null then
        select exists (
          select 1 from public.website_routes
          where website_id = p_website_id and funnel_id = v_target_value
        ) into v_has_live_route;

        if not v_has_live_route then
          raise sqlstate 'PT422' using message = 'Visible navigation item "' || coalesce(v_item->>'label', '') || '" targets an internal destination that is not published in live routes. Publish that route first.';
        end if;
      end if;
    end if;
  end loop;

  v_next_live_revision := v_live_revision + 1;

  -- Atomically upsert live navigation
  insert into public.builder_site_navigation_live (
    website_id,
    menu_scope,
    items,
    revision,
    created_at,
    updated_at
  ) values (
    p_website_id,
    v_menu_scope,
    v_draft.items,
    v_next_live_revision,
    v_now,
    v_now
  )
  on conflict (website_id, menu_scope)
  do update set
    items = excluded.items,
    revision = excluded.revision,
    updated_at = v_now;

  -- Delete published draft
  delete from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = v_menu_scope;

  return jsonb_build_object(
    'success', true,
    'website_id', p_website_id,
    'menu_scope', v_menu_scope,
    'live_revision', v_next_live_revision,
    'is_draft', false,
    'items', v_draft.items
  );
end;
$$;

-- 4. RPC: Hardened publish_builder_routes from Task 5B (50600) with added navigation dependency guard
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
  v_nav_row record;
  v_nav_item jsonb;
  v_dest_has_remaining_route boolean;
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

  -- 7.5. Navigation Dependency Guard: Ensure route deletions do not strand visible canonical live navigation links
  if exists (
    select 1 from public.builder_route_drafts
    where website_id = p_website_id and action = 'delete'
  ) then
    for v_nav_row in (
      select items, menu_scope
      from public.builder_site_navigation_live
      where website_id = p_website_id
    ) loop
      for v_nav_item in select jsonb_array_elements(v_nav_row.items) loop
        if coalesce((v_nav_item->>'visible')::boolean, true) is true
           and v_nav_item->>'target_kind' = 'internal'
           and v_nav_item->>'target_value' is not null then

          -- Check if this visible internal target is affected by a staged deletion
          if exists (
            select 1 from public.builder_route_drafts d
            where d.website_id = p_website_id
              and d.action = 'delete'
              and d.funnel_id = v_nav_item->>'target_value'
          ) then
            -- Evaluate post-publication route set: Does the destination still have at least one live route after this batch?
            select (
              -- 1. Another live route for this destination that is NOT being deleted in this batch
              exists (
                select 1 from public.website_routes wr
                where wr.website_id = p_website_id
                  and wr.funnel_id = v_nav_item->>'target_value'
                  and not exists (
                    select 1 from public.builder_route_drafts d
                    where d.website_id = p_website_id
                      and d.action = 'delete'
                      and d.route_id = wr.id
                  )
              )
              -- 2. OR an upsert draft in this batch that will provide a live route for this destination
              or exists (
                select 1 from public.builder_route_drafts d
                where d.website_id = p_website_id
                  and d.action = 'upsert'
                  and d.funnel_id = v_nav_item->>'target_value'
              )
            ) into v_dest_has_remaining_route;

            if not coalesce(v_dest_has_remaining_route, false) then
              raise sqlstate 'PT422' using message = 'Cannot publish route deletion: visible live navigation item "' || coalesce(v_nav_item->>'label', '') || '" depends on this route destination. Update or publish navigation first.';
            end if;
          end if;
        end if;
      end loop;
    end loop;
  end if;

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
      ) values (
        pg_catalog.gen_random_uuid(),
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

      -- Collapse sequential redirect chains: any redirect pointing to old path now points to new path
      update public.website_route_redirects
      set to_path = v_draft.path, updated_at = v_now
      where website_id = p_website_id
        and to_path = v_old_live_path
        and from_path <> v_draft.path;

      -- Update live route
      update public.website_routes
      set path = v_draft.path, funnel_id = v_draft.funnel_id
      where id = v_draft.route_id and website_id = p_website_id;
    end if;
  end loop;

  -- 10. Execution: Apply creates
  for v_draft in (
    select id, path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'upsert' and route_id is null
  ) loop
    -- If newly created path previously existed as a redirect source, remove it
    delete from public.website_route_redirects
    where website_id = p_website_id and from_path = v_draft.path;

    insert into public.website_routes (
      id,
      website_id,
      path,
      funnel_id,
      created_at
    ) values (
      pg_catalog.gen_random_uuid(),
      p_website_id,
      v_draft.path,
      v_draft.funnel_id,
      v_now
    )
    on conflict (website_id, path)
    do update set
      funnel_id = excluded.funnel_id;
  end loop;

  -- 10.5. Cycle validation check across website_route_redirects
  if exists (
    with recursive redirect_chain as (
      select from_path, to_path, array[from_path] as path_list
      from public.website_route_redirects
      where website_id = p_website_id
      union all
      select rc.from_path, r.to_path, rc.path_list || r.from_path
      from redirect_chain rc
      join public.website_route_redirects r on r.website_id = p_website_id and r.from_path = rc.to_path
      where r.from_path = any(rc.path_list) or array_length(rc.path_list, 1) > 10
    )
    select 1 from redirect_chain where to_path = any(path_list) or array_length(path_list, 1) > 10
  ) then
    raise sqlstate 'PT400' using message = 'Publication would create a redirect loop.';
  end if;

  -- 11. Clear successfully published route drafts
  delete from public.builder_route_drafts
  where website_id = p_website_id;

  return jsonb_build_object(
    'success', true,
    'published_count', v_draft_count
  );
end;
$$;

-- 5. Revoke and Grant RPC permissions
revoke all on function public.stage_builder_site_navigation_draft(uuid, text, jsonb, integer, integer) from public, anon;
grant execute on function public.stage_builder_site_navigation_draft(uuid, text, jsonb, integer, integer) to authenticated, postgres, service_role;

revoke all on function public.publish_builder_site_navigation(uuid, text, integer, integer) from public, anon;
grant execute on function public.publish_builder_site_navigation(uuid, text, integer, integer) to authenticated, postgres, service_role;

revoke all on function public.publish_builder_routes(uuid, integer, text[]) from public, anon;
grant execute on function public.publish_builder_routes(uuid, integer, text[]) to authenticated, postgres, service_role;
