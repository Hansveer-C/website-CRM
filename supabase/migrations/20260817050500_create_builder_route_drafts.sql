-- Migration: 20260817050500_create_builder_route_drafts.sql
-- Description: Canonical Builder Route Lifecycle & Draft Route Staging Authority (Phase 1B / Task 5A)
-- Invariants:
-- 1. Public route authority remains public.website_routes.
-- 2. Builder route modifications are staged in public.builder_route_drafts without mutating live routes.
-- 3. Root route '/' is reserved and governed exclusively by Task 4 homepage lifecycle.
-- 4. Reserved platform routes (/api, /preview, /builder, etc.) are strictly rejected.
-- 5. Staging rename or deletion leaves live routes 100% untouched.

create table if not exists public.builder_route_drafts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  route_id uuid references public.website_routes(id) on delete cascade,
  path text not null,
  funnel_id text not null references public.funnels(id) on delete cascade,
  action text not null default 'upsert',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint builder_route_drafts_action_check check (action in ('upsert', 'delete')),
  constraint builder_route_drafts_website_funnel_key unique (website_id, funnel_id)
);

create index if not exists idx_builder_route_drafts_website_id on public.builder_route_drafts(website_id);
create index if not exists idx_builder_route_drafts_path on public.builder_route_drafts(website_id, path);

alter table public.builder_route_drafts enable row level security;

-- RLS Policies for builder_route_drafts
drop policy if exists "Users can select route drafts of their websites" on public.builder_route_drafts;
create policy "Users can select route drafts of their websites"
  on public.builder_route_drafts
  for select
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_route_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can insert route drafts of their websites" on public.builder_route_drafts;
create policy "Users can insert route drafts of their websites"
  on public.builder_route_drafts
  for insert
  with check (
    exists (
      select 1 from public.websites w
      where w.id = builder_route_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can update route drafts of their websites" on public.builder_route_drafts;
create policy "Users can update route drafts of their websites"
  on public.builder_route_drafts
  for update
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_route_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can delete route drafts of their websites" on public.builder_route_drafts;
create policy "Users can delete route drafts of their websites"
  on public.builder_route_drafts
  for delete
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_route_drafts.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

-- RPC: Set / Stage Route Draft (Create or Update / Rename)
create or replace function public.set_builder_route_draft(
  p_website_id uuid,
  p_funnel_id text,
  p_path text,
  p_route_id uuid default null,
  p_expected_draft_path text default null,
  p_expected_live_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_funnel_owner text;
  v_normalized_path text;
  v_live_route_id uuid;
  v_current_live_path text;
  v_draft_id uuid;
  v_current_draft_path text;
  v_current_draft_action text;
  v_collision boolean := false;
  v_result jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_seg text;
  v_segs text[];
begin
  -- 1. Authentication check
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if p_funnel_id is null or length(trim(p_funnel_id)) = 0 then
    raise sqlstate 'PT400' using message = 'Funnel ID is required';
  end if;

  if p_path is null or length(trim(p_path)) = 0 then
    raise sqlstate 'PT400' using message = 'Path is required';
  end if;

  -- 3. Path normalization & validation
  v_normalized_path := trim(p_path);

  -- Reject query params, fragments, percent encoding
  if v_normalized_path like '%?%' or v_normalized_path like '%#%' then
    raise sqlstate 'PT400' using message = 'Path cannot contain query parameters or fragments';
  end if;

  if v_normalized_path like '%\%%' then
    raise sqlstate 'PT400' using message = 'Percent-encoded characters are not supported in route paths';
  end if;

  -- Replace backslashes with slashes
  v_normalized_path := replace(v_normalized_path, '\', '/');

  -- Ensure leading slash
  if not v_normalized_path like '/%' then
    v_normalized_path := '/' || v_normalized_path;
  end if;

  -- Lowercase
  v_normalized_path := lower(v_normalized_path);

  -- Collapse duplicate slashes: e.g. //+ -> /
  while v_normalized_path like '%//%' loop
    v_normalized_path := replace(v_normalized_path, '//', '/');
  end loop;

  -- Strip trailing slash unless root '/'
  if length(v_normalized_path) > 1 and v_normalized_path like '%/' then
    v_normalized_path := substr(v_normalized_path, 1, length(v_normalized_path) - 1);
  end if;

  -- Root route check (Reserved for Task 4 homepage lifecycle)
  if v_normalized_path = '/' then
    raise sqlstate 'PT400' using message = 'Root route "/" is reserved and managed exclusively through homepage selection.';
  end if;

  -- Length check
  if length(v_normalized_path) > 256 then
    raise sqlstate 'PT400' using message = 'Path exceeds maximum allowed length of 256 characters';
  end if;

  -- Segment validation
  v_segs := string_to_array(substr(v_normalized_path, 2), '/');
  foreach v_seg in array v_segs loop
    if v_seg = '.' or v_seg = '..' then
      raise sqlstate 'PT400' using message = 'Path traversal segments are forbidden';
    end if;
    if v_seg !~ '^[a-z0-9_.-]+$' then
      raise sqlstate 'PT400' using message = 'Path contains invalid characters. Use letters, numbers, hyphens, or underscores.';
    end if;
  end loop;

  -- Reserved system routes check
  if v_normalized_path in (
    '/api', '/preview', '/builder', '/dashboard', '/login', '/register',
    '/logout', '/auth', '/settings', '/assets', '/static', '/crm',
    '/admin', '/home', '/robots.txt', '/sitemap.xml', '/favicon.ico', '/.well-known'
  ) or v_normalized_path like '/api/%'
    or v_normalized_path like '/preview/%'
    or v_normalized_path like '/builder/%'
    or v_normalized_path like '/dashboard/%'
    or v_normalized_path like '/auth/%'
    or v_normalized_path like '/settings/%'
    or v_normalized_path like '/assets/%'
    or v_normalized_path like '/static/%'
    or v_normalized_path like '/crm/%'
    or v_normalized_path like '/admin/%'
    or substr(v_normalized_path, 1, 2) = '/_'
    or v_normalized_path like '/.well-known/%' then
    raise sqlstate 'PT400' using message = 'Path is a reserved system route and cannot be used for a page URL.';
  end if;

  -- 4. Acquire website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- 5. Validate website ownership
  select true into v_website_exists
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- 6. Validate destination funnel ownership
  select user_id into v_funnel_owner
  from public.funnels
  where id = p_funnel_id;

  if not found or v_funnel_owner <> v_user_id then
    raise sqlstate 'PT404' using message = 'Funnel not found';
  end if;

  -- 7. Identify existing live route
  if p_route_id is not null then
    select id, path into v_live_route_id, v_current_live_path
    from public.website_routes
    where id = p_route_id and website_id = p_website_id;

    if not found then
      raise sqlstate 'PT404' using message = 'Specified route not found on this website';
    end if;
  else
    select id, path into v_live_route_id, v_current_live_path
    from public.website_routes
    where website_id = p_website_id and funnel_id = p_funnel_id
    limit 1;
  end if;

  -- 8. Identify existing draft record
  select id, path, action
  into v_draft_id, v_current_draft_path, v_current_draft_action
  from public.builder_route_drafts
  where website_id = p_website_id
    and (
      (p_route_id is not null and route_id = p_route_id)
      or funnel_id = p_funnel_id
    )
  limit 1;

  -- 9. Optimistic concurrency check
  if p_expected_draft_path is not null and v_current_draft_path is distinct from p_expected_draft_path then
    raise sqlstate 'PT409' using message = 'The route was modified elsewhere. Reload and try again.';
  end if;

  if p_expected_live_path is not null and v_current_live_path is distinct from p_expected_live_path then
    raise sqlstate 'PT409' using message = 'The live route changed elsewhere. Reload and try again.';
  end if;

  -- 10. Collision check: Ensure v_normalized_path is not claimed by another live route or draft upsert
  select (
    exists (
      select 1 from public.website_routes wr
      where wr.website_id = p_website_id
        and wr.path = v_normalized_path
        and wr.id <> coalesce(v_live_route_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and not exists (
          select 1 from public.builder_route_drafts brd
          where brd.website_id = p_website_id
            and brd.route_id = wr.id
            and brd.action = 'delete'
        )
    )
    or exists (
      select 1 from public.builder_route_drafts brd
      where brd.website_id = p_website_id
        and brd.path = v_normalized_path
        and brd.action = 'upsert'
        and brd.funnel_id <> p_funnel_id
    )
  ) into v_collision;

  if coalesce(v_collision, false) is true then
    raise sqlstate 'PT409' using message = 'Path is already in use by another page on this website';
  end if;

  -- 11. Revert check: If user sets draft path back to current live path, clear the draft row
  if v_current_live_path is not null and v_current_live_path = v_normalized_path then
    if v_draft_id is not null then
      delete from public.builder_route_drafts
      where id = v_draft_id;
    end if;

    return jsonb_build_object('success', true, 'draft', null);
  end if;

  -- 12. Upsert draft record
  insert into public.builder_route_drafts (
    id,
    website_id,
    route_id,
    path,
    funnel_id,
    action,
    updated_at
  ) values (
    coalesce(v_draft_id, pg_catalog.gen_random_uuid()),
    p_website_id,
    v_live_route_id,
    v_normalized_path,
    p_funnel_id,
    'upsert',
    v_now
  )
  on conflict (website_id, funnel_id)
  do update set
    route_id = excluded.route_id,
    path = excluded.path,
    action = excluded.action,
    updated_at = excluded.updated_at
  returning jsonb_build_object(
    'id', builder_route_drafts.id,
    'website_id', builder_route_drafts.website_id,
    'route_id', builder_route_drafts.route_id,
    'path', builder_route_drafts.path,
    'funnel_id', builder_route_drafts.funnel_id,
    'action', builder_route_drafts.action,
    'created_at', builder_route_drafts.created_at,
    'updated_at', builder_route_drafts.updated_at
  ) into v_result;

  return jsonb_build_object('success', true, 'draft', v_result);
end;
$$;

-- RPC: Delete Route Draft (Stage Deletion of Live Route or Cancel Draft Route)
create or replace function public.delete_builder_route_draft(
  p_website_id uuid,
  p_route_id uuid default null,
  p_funnel_id text default null,
  p_expected_draft_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_live_route_id uuid;
  v_live_path text;
  v_live_funnel text;
  v_draft_id uuid;
  v_draft_path text;
  v_draft_action text;
  v_result jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if p_route_id is null and (p_funnel_id is null or length(trim(p_funnel_id)) = 0) then
    raise sqlstate 'PT400' using message = 'Route ID or Funnel ID is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  select true into v_website_exists
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- Find live route
  if p_route_id is not null then
    select id, path, funnel_id into v_live_route_id, v_live_path, v_live_funnel
    from public.website_routes
    where id = p_route_id and website_id = p_website_id;
  else
    select id, path, funnel_id into v_live_route_id, v_live_path, v_live_funnel
    from public.website_routes
    where website_id = p_website_id and funnel_id = p_funnel_id
    limit 1;
  end if;

  if v_live_path = '/' then
    raise sqlstate 'PT400' using message = 'Root homepage route cannot be deleted through route management.';
  end if;

  -- Find draft
  select id, path, action into v_draft_id, v_draft_path, v_draft_action
  from public.builder_route_drafts
  where website_id = p_website_id
    and (
      (p_route_id is not null and route_id = p_route_id)
      or (p_funnel_id is not null and funnel_id = p_funnel_id)
    )
  limit 1;

  if p_expected_draft_path is not null and v_draft_path is distinct from p_expected_draft_path then
    raise sqlstate 'PT409' using message = 'The route was modified elsewhere. Reload and try again.';
  end if;

  if v_live_route_id is null and v_draft_id is not null then
    -- Draft-only route: delete completely
    delete from public.builder_route_drafts where id = v_draft_id;
    return jsonb_build_object('success', true, 'draft', null);
  end if;

  if v_live_route_id is not null then
    -- Live route exists: stage deletion
    insert into public.builder_route_drafts (
      id,
      website_id,
      route_id,
      path,
      funnel_id,
      action,
      updated_at
    ) values (
      coalesce(v_draft_id, pg_catalog.gen_random_uuid()),
      p_website_id,
      v_live_route_id,
      v_live_path,
      v_live_funnel,
      'delete',
      v_now
    )
    on conflict (website_id, funnel_id)
    do update set
      route_id = excluded.route_id,
      path = excluded.path,
      action = excluded.action,
      updated_at = excluded.updated_at
    returning jsonb_build_object(
      'id', builder_route_drafts.id,
      'website_id', builder_route_drafts.website_id,
      'route_id', builder_route_drafts.route_id,
      'path', builder_route_drafts.path,
      'funnel_id', builder_route_drafts.funnel_id,
      'action', builder_route_drafts.action,
      'created_at', builder_route_drafts.created_at,
      'updated_at', builder_route_drafts.updated_at
    ) into v_result;

    return jsonb_build_object('success', true, 'draft', v_result);
  end if;

  raise sqlstate 'PT404' using message = 'Route not found';
end;
$$;

-- RPC: Revert Route Draft
create or replace function public.revert_builder_route_draft(
  p_website_id uuid,
  p_route_id uuid default null,
  p_funnel_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  select true into v_website_exists
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  delete from public.builder_route_drafts
  where website_id = p_website_id
    and (
      (p_route_id is not null and route_id = p_route_id)
      or (p_funnel_id is not null and funnel_id = p_funnel_id)
    );

  return jsonb_build_object('success', true, 'draft', null);
end;
$$;

-- RPC: Get Effective Builder Routes (Merged Live + Draft for Authenticated Builder)
create or replace function public.get_builder_effective_routes(
  p_website_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_routes jsonb;
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

  with live as (
    select
      wr.id,
      wr.website_id,
      wr.path as live_path,
      wr.funnel_id,
      d.id as draft_id,
      d.path as draft_path,
      d.action as draft_action
    from public.website_routes wr
    left join public.builder_route_drafts d
      on d.website_id = wr.website_id and (d.route_id = wr.id or d.funnel_id = wr.funnel_id)
    where wr.website_id = p_website_id
  ),
  draft_only as (
    select
      d.id,
      d.website_id,
      null::text as live_path,
      d.funnel_id,
      d.id as draft_id,
      d.path as draft_path,
      d.action as draft_action
    from public.builder_route_drafts d
    where d.website_id = p_website_id
      and d.route_id is null
      and d.action = 'upsert'
      and not exists (
        select 1 from public.website_routes wr
        where wr.website_id = d.website_id and wr.funnel_id = d.funnel_id
      )
  ),
  combined as (
    select
      l.id,
      l.website_id,
      case
        when l.draft_action = 'upsert' then l.draft_path
        else l.live_path
      end as path,
      l.funnel_id,
      l.live_path,
      l.draft_path,
      (l.draft_action = 'upsert' and l.draft_path is distinct from l.live_path) as is_draft_override,
      (l.draft_action = 'delete') as is_staged_delete,
      false as is_new_draft
    from live l

    union all

    select
      dro.id,
      dro.website_id,
      dro.draft_path as path,
      dro.funnel_id,
      null::text as live_path,
      dro.draft_path,
      true as is_draft_override,
      false as is_staged_delete,
      true as is_new_draft
    from draft_only dro
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'website_id', c.website_id,
        'path', c.path,
        'funnel_id', c.funnel_id,
        'live_path', c.live_path,
        'draft_path', c.draft_path,
        'is_draft_override', c.is_draft_override,
        'is_staged_delete', c.is_staged_delete,
        'is_new_draft', c.is_new_draft
      ) order by c.path
    ),
    '[]'::jsonb
  ) into v_routes
  from combined c;

  return jsonb_build_object('success', true, 'routes', v_routes);
end;
$$;

-- Revoke from public, anon; Grant to authenticated, postgres, service_role
revoke all on function public.set_builder_route_draft(uuid, text, text, uuid, text, text) from public, anon;
grant execute on function public.set_builder_route_draft(uuid, text, text, uuid, text, text) to authenticated, postgres, service_role;

revoke all on function public.delete_builder_route_draft(uuid, uuid, text, text) from public, anon;
grant execute on function public.delete_builder_route_draft(uuid, uuid, text, text) to authenticated, postgres, service_role;

revoke all on function public.revert_builder_route_draft(uuid, uuid, text) from public, anon;
grant execute on function public.revert_builder_route_draft(uuid, uuid, text) to authenticated, postgres, service_role;

revoke all on function public.get_builder_effective_routes(uuid) from public, anon;
grant execute on function public.get_builder_effective_routes(uuid) to authenticated, postgres, service_role;
