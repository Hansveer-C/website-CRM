-- Migration: 20260817050600_create_builder_route_redirects_and_publication.sql
-- Description: Route Redirects Authority and Atomic Route Publication (Phase 1B / Task 5B)
-- Invariants:
-- 1. "Editing changes draft state. Publishing changes live state."
-- 2. public.website_routes remains live route authority.
-- 3. public.website_route_redirects records live HTTP 308 redirects for published route renames.
-- 4. Route publication is atomic at website scope; failed publish leaves live routing 100% intact.
-- 5. Root route '/' remains exclusively owned and published through Task 4 homepage lifecycle.
-- 6. Unpublished page destinations reject route publication to prevent public 404s.

create table if not exists public.website_route_redirects (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  from_path text not null,
  to_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_route_redirects_website_from_key unique (website_id, from_path),
  constraint website_route_redirects_not_self check (from_path <> to_path)
);

create index if not exists idx_website_route_redirects_lookup on public.website_route_redirects(website_id, from_path);

alter table public.website_route_redirects enable row level security;

-- RLS Policies
drop policy if exists "Users can select route redirects of their websites" on public.website_route_redirects;
create policy "Users can select route redirects of their websites"
  on public.website_route_redirects
  for select
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_route_redirects.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can insert route redirects of their websites" on public.website_route_redirects;
create policy "Users can insert route redirects of their websites"
  on public.website_route_redirects
  for insert
  with check (
    exists (
      select 1 from public.websites w
      where w.id = website_route_redirects.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can update route redirects of their websites" on public.website_route_redirects;
create policy "Users can update route redirects of their websites"
  on public.website_route_redirects
  for update
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_route_redirects.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

drop policy if exists "Users can delete route redirects of their websites" on public.website_route_redirects;
create policy "Users can delete route redirects of their websites"
  on public.website_route_redirects
  for delete
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_route_redirects.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

-- RPC: Atomic Route Publication
create or replace function public.publish_builder_routes(
  p_website_id uuid,
  p_expected_draft_count integer default null
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
  v_draft record;
  v_funnel_owner text;
  v_destination_published boolean;
  v_old_live_path text;
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
  select count(*) into v_draft_count
  from public.builder_route_drafts
  where website_id = p_website_id;

  if v_draft_count = 0 then
    return jsonb_build_object(
      'success', true,
      'published_count', 0,
      'message', 'No route drafts to publish'
    );
  end if;

  -- 6. Optimistic concurrency check on draft count
  if p_expected_draft_count is not null and v_draft_count <> p_expected_draft_count then
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

  -- 11. Clear successfully published route drafts
  delete from public.builder_route_drafts
  where website_id = p_website_id;

  return jsonb_build_object(
    'success', true,
    'published_count', v_draft_count
  );
end;
$$;

-- Revoke from public, anon; Grant to authenticated, postgres, service_role
revoke all on function public.publish_builder_routes(uuid, integer) from public, anon;
grant execute on function public.publish_builder_routes(uuid, integer) to authenticated, postgres, service_role;
