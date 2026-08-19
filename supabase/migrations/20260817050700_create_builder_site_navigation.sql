-- Migration: 20260817050700_create_builder_site_navigation.sql
-- Description: Establishes canonical website navigation domain tables, drafts, and RPCs for Task 6A.

create table if not null public.builder_site_navigation_live (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  menu_scope text not null default 'primary' check (menu_scope in ('primary', 'footer')),
  items jsonb not null default '[]'::jsonb,
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint builder_site_nav_live_site_scope_unique unique (website_id, menu_scope)
);

create table if not null public.builder_site_navigation_drafts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  menu_scope text not null default 'primary' check (menu_scope in ('primary', 'footer')),
  items jsonb not null default '[]'::jsonb,
  base_revision integer not null default 0 check (base_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint builder_site_nav_draft_site_scope_unique unique (website_id, menu_scope)
);

-- Indexes
create index if not exists idx_builder_site_nav_live_website on public.builder_site_navigation_live(website_id);
create index if not exists idx_builder_site_nav_drafts_website on public.builder_site_navigation_drafts(website_id);

-- Enable & force RLS
alter table public.builder_site_navigation_live enable row level security;
alter table public.builder_site_navigation_live force row level security;

alter table public.builder_site_navigation_drafts enable row level security;
alter table public.builder_site_navigation_drafts force row level security;

-- Revoke all permissions by default
revoke all on table public.builder_site_navigation_live from public, anon, authenticated;
revoke all on table public.builder_site_navigation_drafts from public, anon, authenticated;

-- Grant access to authenticated users
grant select, insert, update, delete on table public.builder_site_navigation_live to authenticated;
grant select, insert, update, delete on table public.builder_site_navigation_drafts to authenticated;

-- RLS Policies for builder_site_navigation_live
drop policy if exists "Users can view navigation of their websites" on public.builder_site_navigation_live;
create policy "Users can view navigation of their websites"
  on public.builder_site_navigation_live
  for select
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_live.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can insert navigation of their websites" on public.builder_site_navigation_live;
create policy "Users can insert navigation of their websites"
  on public.builder_site_navigation_live
  for insert
  with check (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_live.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can update navigation of their websites" on public.builder_site_navigation_live;
create policy "Users can update navigation of their websites"
  on public.builder_site_navigation_live
  for update
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_live.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can delete navigation of their websites" on public.builder_site_navigation_live;
create policy "Users can delete navigation of their websites"
  on public.builder_site_navigation_live
  for delete
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_live.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

-- RLS Policies for builder_site_navigation_drafts
drop policy if exists "Users can view navigation drafts of their websites" on public.builder_site_navigation_drafts;
create policy "Users can view navigation drafts of their websites"
  on public.builder_site_navigation_drafts
  for select
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can insert navigation drafts of their websites" on public.builder_site_navigation_drafts;
create policy "Users can insert navigation drafts of their websites"
  on public.builder_site_navigation_drafts
  for insert
  with check (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can update navigation drafts of their websites" on public.builder_site_navigation_drafts;
create policy "Users can update navigation drafts of their websites"
  on public.builder_site_navigation_drafts
  for update
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can delete navigation drafts of their websites" on public.builder_site_navigation_drafts;
create policy "Users can delete navigation drafts of their websites"
  on public.builder_site_navigation_drafts
  for delete
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_site_navigation_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

-- RPC: Get Effective Navigation
create or replace function public.get_builder_effective_site_navigation(
  p_website_id uuid,
  p_menu_scope text default 'primary'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_live record;
  v_draft record;
  v_effective_items jsonb;
  v_is_draft boolean := false;
  v_live_revision integer := 0;
  v_base_revision integer := 0;
  v_updated_at timestamptz;
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  select true into v_website_exists
  from public.websites
  where id = p_website_id and user_id = v_user_id;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- Read live navigation
  select items, revision, updated_at into v_live
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = coalesce(p_menu_scope, 'primary');

  if found then
    v_live_revision := v_live.revision;
    v_effective_items := v_live.items;
    v_updated_at := v_live.updated_at;
  else
    v_effective_items := '[]'::jsonb;
    v_updated_at := pg_catalog.clock_timestamp();
  end if;

  -- Read draft navigation
  select items, base_revision, updated_at into v_draft
  from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = coalesce(p_menu_scope, 'primary');

  if found then
    v_is_draft := true;
    v_effective_items := v_draft.items;
    v_base_revision := v_draft.base_revision;
    v_updated_at := v_draft.updated_at;
  else
    v_base_revision := v_live_revision;
  end if;

  return jsonb_build_object(
    'website_id', p_website_id,
    'menu_scope', coalesce(p_menu_scope, 'primary'),
    'items', v_effective_items,
    'is_draft', v_is_draft,
    'base_revision', v_base_revision,
    'live_revision', v_live_revision,
    'updated_at', v_updated_at
  );
end;
$$;

-- RPC: Stage Navigation Draft
create or replace function public.stage_builder_site_navigation_draft(
  p_website_id uuid,
  p_menu_scope text,
  p_items jsonb,
  p_expected_base_revision integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_menu_scope text := coalesce(p_menu_scope, 'primary');
  v_live record;
  v_live_revision integer := 0;
  v_live_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_id text;
  v_label text;
  v_target_kind text;
  v_target_value text;
  v_position integer;
  v_funnel_owner text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_seen_ids text[] := array[]::text[];
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
  select true into v_website_exists
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- Fetch live revision for optimistic concurrency check
  select items, revision into v_live
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = v_menu_scope;

  if found then
    v_live_revision := v_live.revision;
    v_live_items := v_live.items;
  end if;

  if p_expected_base_revision is not null and p_expected_base_revision <> v_live_revision then
    raise sqlstate 'PT409' using message = 'The navigation configuration was modified elsewhere. Reload and try again.';
  end if;

  -- Validate each item in the proposed array
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_id := trim(v_item->>'id');
    v_label := trim(v_item->>'label');
    v_target_kind := trim(v_item->>'target_kind');
    v_target_value := trim(v_item->>'target_value');

    if v_item_id is null or v_item_id = '' then
      raise sqlstate 'PT400' using message = 'Each navigation item must have a valid non-empty ID';
    end if;

    if v_item_id = any(v_seen_ids) then
      raise sqlstate 'PT400' using message = 'Duplicate navigation item ID detected';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_item_id);

    if v_label is null or v_label = '' then
      raise sqlstate 'PT400' using message = 'Navigation item label cannot be empty';
    end if;

    if length(v_label) > 100 then
      raise sqlstate 'PT400' using message = 'Navigation item label cannot exceed 100 characters';
    end if;

    if v_target_kind not in ('internal', 'external', 'phone', 'email') then
      raise sqlstate 'PT400' using message = 'Invalid navigation target kind';
    end if;

    if v_target_value is null or v_target_value = '' then
      raise sqlstate 'PT400' using message = 'Navigation target value cannot be empty';
    end if;

    -- Validate internal target ownership
    if v_target_kind = 'internal' then
      select user_id into v_funnel_owner
      from public.funnels
      where id = v_target_value;

      if not found or v_funnel_owner <> v_user_id then
        raise sqlstate 'PT404' using message = 'Internal destination not found or not owned by user';
      end if;
    end if;

    v_idx := v_idx + 1;
  end loop;

  -- If draft snapshot matches live snapshot exactly, clear the draft row (no-op / auto-clean)
  if p_items = v_live_items then
    delete from public.builder_site_navigation_drafts
    where website_id = p_website_id and menu_scope = v_menu_scope;

    return jsonb_build_object(
      'success', true,
      'is_draft', false,
      'base_revision', v_live_revision,
      'message', 'Draft matches live navigation; redundant draft cleared'
    );
  end if;

  -- Upsert draft snapshot
  insert into public.builder_site_navigation_drafts (
    website_id,
    menu_scope,
    items,
    base_revision,
    created_at,
    updated_at
  ) values (
    p_website_id,
    v_menu_scope,
    p_items,
    v_live_revision,
    v_now,
    v_now
  )
  on conflict (website_id, menu_scope)
  do update set
    items = excluded.items,
    base_revision = excluded.base_revision,
    updated_at = v_now;

  return jsonb_build_object(
    'success', true,
    'is_draft', true,
    'base_revision', v_live_revision,
    'message', 'Draft navigation staged successfully'
  );
end;
$$;

-- RPC: Revert Navigation Draft
create or replace function public.revert_builder_site_navigation_draft(
  p_website_id uuid,
  p_menu_scope text default 'primary'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_menu_scope text := coalesce(p_menu_scope, 'primary');
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  -- Acquire website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- Validate website ownership
  select true into v_website_exists
  from public.websites
  where id = p_website_id and user_id = v_user_id;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- Delete draft row
  delete from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = v_menu_scope;

  return public.get_builder_effective_site_navigation(p_website_id, v_menu_scope);
end;
$$;

-- Grants for RPC functions
grant execute on function public.get_builder_effective_site_navigation(uuid, text) to authenticated;
grant execute on function public.stage_builder_site_navigation_draft(uuid, text, jsonb, integer) to authenticated;
grant execute on function public.revert_builder_site_navigation_draft(uuid, text) to authenticated;
