-- Transactionally atomic Draft Homepage Selection and Publish Promotion RPCs for the Builder.
-- Guarantees Option B semantics:
-- 1. "Set home" modifies ONLY websites.draft_homepage_funnel_id (draft state).
-- 2. Setting draft to the currently live homepage clears draft_homepage_funnel_id to NULL.
-- 3. Live homepage_funnel_id and website_routes('/') remain 100% UNTOUCHED until explicit publication.
-- 4. publish_builder_homepage verifies the destination root page is published, atomically promotes draft to live, and synchronizes website_routes('/').

alter table public.websites
add column if not exists draft_homepage_funnel_id text;

create or replace function public.set_builder_draft_homepage(
  p_website_id uuid,
  p_funnel_id text,
  p_expected_draft_homepage_funnel_id text default null
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
  v_current_live_homepage_funnel_id text;
  v_current_draft_homepage_funnel_id text;
  v_is_associated boolean;
  v_next_draft_homepage text;
  v_result jsonb;
  v_now timestamp with time zone := pg_catalog.clock_timestamp();
begin
  -- 1. Authenticated user verification
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if p_funnel_id is null or length(trim(p_funnel_id)) = 0 or length(p_funnel_id) > 128 then
    raise sqlstate 'PT400' using message = 'Invalid funnel ID';
  end if;

  -- 3. Acquire website-level lifecycle advisory transaction lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- 4. Post-lock load and row FOR UPDATE lock of the website
  select true, homepage_funnel_id, draft_homepage_funnel_id
  into v_website_exists, v_current_live_homepage_funnel_id, v_current_draft_homepage_funnel_id
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- 5. Verify desired Funnel exists and is owned by the same user
  select user_id
  into v_funnel_owner
  from public.funnels
  where id = p_funnel_id;

  if not found or v_funnel_owner <> v_user_id then
    raise sqlstate 'PT404' using message = 'Funnel not found';
  end if;

  -- 6. Verify desired Funnel is an associated destination for this website
  select (
    exists (
      select 1
      from public.website_routes
      where website_id = p_website_id and funnel_id = p_funnel_id
    )
    or coalesce(v_current_live_homepage_funnel_id = p_funnel_id, false)
    or coalesce(v_current_draft_homepage_funnel_id = p_funnel_id, false)
  ) into v_is_associated;

  if coalesce(v_is_associated, false) is not true then
    raise sqlstate 'PT400' using message = 'Funnel is not an associated destination for this website';
  end if;

  -- 7. OPTIMISTIC CONCURRENCY CHECK: Compare current draft state with p_expected_draft_homepage_funnel_id
  if v_current_draft_homepage_funnel_id is distinct from p_expected_draft_homepage_funnel_id then
    raise sqlstate 'PT409' using message = 'The draft homepage changed elsewhere. Reload and try again.';
  end if;

  -- 8. Determine next draft state
  -- If user chose the currently live homepage, clear the draft override to NULL
  if p_funnel_id = v_current_live_homepage_funnel_id then
    v_next_draft_homepage := null;
  else
    v_next_draft_homepage := p_funnel_id;
  end if;

  -- Apply update to draft_homepage_funnel_id only if changed
  if v_current_draft_homepage_funnel_id is distinct from v_next_draft_homepage then
    update public.websites
    set draft_homepage_funnel_id = v_next_draft_homepage,
        updated_at = v_now
    where id = p_website_id and user_id = v_user_id;
  end if;

  -- 9. Build canonical JSON return
  select jsonb_build_object(
    'website', jsonb_build_object(
      'id', w.id,
      'user_id', w.user_id,
      'name', w.name,
      'domain', w.domain,
      'subdomain', w.subdomain,
      'homepage_funnel_id', w.homepage_funnel_id,
      'draft_homepage_funnel_id', w.draft_homepage_funnel_id,
      'created_at', w.created_at,
      'updated_at', w.updated_at
    )
  ) into v_result
  from public.websites w
  where w.id = p_website_id and w.user_id = v_user_id;

  return v_result;
end;
$$;

-- Backward-compatible wrapper for set_builder_homepage pointing to set_builder_draft_homepage
create or replace function public.set_builder_homepage(
  p_website_id uuid,
  p_funnel_id text,
  p_expected_homepage_funnel_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.set_builder_draft_homepage(p_website_id, p_funnel_id, p_expected_homepage_funnel_id);
end;
$$;

-- Atomic Promotion RPC: Promotes draft_homepage_funnel_id to live homepage_funnel_id and updates '/' route
create or replace function public.publish_builder_homepage(
  p_website_id uuid,
  p_expected_draft_homepage_funnel_id text default null,
  p_expected_homepage_funnel_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website_exists boolean;
  v_live_homepage text;
  v_draft_homepage text;
  v_target_page_id text;
  v_target_is_published boolean;
  v_result jsonb;
  v_now timestamp with time zone := pg_catalog.clock_timestamp();
begin
  -- 1. Authenticated user verification
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  -- 2. Acquire website-level lifecycle advisory transaction lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- 3. Post-lock load and row FOR UPDATE lock of the website
  select true, homepage_funnel_id, draft_homepage_funnel_id
  into v_website_exists, v_live_homepage, v_draft_homepage
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website_exists is not true then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- 4. Optimistic concurrency checks
  if p_expected_draft_homepage_funnel_id is not null and v_draft_homepage is distinct from p_expected_draft_homepage_funnel_id then
    raise sqlstate 'PT409' using message = 'The draft homepage changed elsewhere. Reload and try again.';
  end if;

  if p_expected_homepage_funnel_id is not null and v_live_homepage is distinct from p_expected_homepage_funnel_id then
    raise sqlstate 'PT409' using message = 'The live homepage changed elsewhere. Reload and try again.';
  end if;

  -- 5. If no draft homepage is staged, it is a no-op success
  if v_draft_homepage is null or v_draft_homepage = v_live_homepage then
    select jsonb_build_object(
      'website', jsonb_build_object(
        'id', w.id,
        'user_id', w.user_id,
        'name', w.name,
        'domain', w.domain,
        'subdomain', w.subdomain,
        'homepage_funnel_id', w.homepage_funnel_id,
        'draft_homepage_funnel_id', w.draft_homepage_funnel_id,
        'created_at', w.created_at,
        'updated_at', w.updated_at
      )
    ) into v_result
    from public.websites w
    where w.id = p_website_id and w.user_id = v_user_id;

    return v_result;
  end if;

  -- 6. Verify destination Funnel exists and belongs to user
  if not exists (
    select 1 from public.funnels where id = v_draft_homepage and user_id = v_user_id
  ) then
    raise sqlstate 'PT404' using message = 'Draft homepage funnel not found';
  end if;

  -- 7. Resolve the destination root page inside the draft funnel
  select id
  into v_target_page_id
  from public.pages
  where funnel_id = v_draft_homepage and user_id = v_user_id
  order by
    case when lower(trim(slug)) = 'home' then 0
         when lower(trim(name)) = 'home' then 1
         else 2 end,
    step_order asc nulls last,
    id asc
  limit 1;

  if v_target_page_id is null then
    raise sqlstate 'PT400' using message = 'No pages exist in the selected homepage destination';
  end if;

  -- 8. Verify the resolved root page is published
  -- Check builder_publication_targets or legacy published status
  select (
    exists (
      select 1 from public.builder_publication_targets
      where website_id = p_website_id and page_id = v_target_page_id
    ) or exists (
      select 1 from public.pages
      where id = v_target_page_id and status = 'published'
    )
  ) into v_target_is_published;

  if coalesce(v_target_is_published, false) is not true then
    raise sqlstate 'PT400' using message = 'The selected homepage is not published yet. Publish that page before making it live.';
  end if;

  -- 9. ATOMIC PROMOTION: Update live homepage_funnel_id, clear draft, update root route '/'
  update public.websites
  set homepage_funnel_id = v_draft_homepage,
      draft_homepage_funnel_id = null,
      updated_at = v_now
  where id = p_website_id and user_id = v_user_id;

  insert into public.website_routes (id, website_id, path, funnel_id, created_at)
  values (
    pg_catalog.gen_random_uuid(),
    p_website_id,
    '/',
    v_draft_homepage,
    v_now
  )
  on conflict (website_id, path)
  do update set funnel_id = excluded.funnel_id;

  -- 10. Return canonical JSON
  select jsonb_build_object(
    'website', jsonb_build_object(
      'id', w.id,
      'user_id', w.user_id,
      'name', w.name,
      'domain', w.domain,
      'subdomain', w.subdomain,
      'homepage_funnel_id', w.homepage_funnel_id,
      'draft_homepage_funnel_id', w.draft_homepage_funnel_id,
      'created_at', w.created_at,
      'updated_at', w.updated_at
    )
  ) into v_result
  from public.websites w
  where w.id = p_website_id and w.user_id = v_user_id;

  return v_result;
end;
$$;

revoke all on function public.set_builder_draft_homepage(uuid, text, text) from public, anon;
grant execute on function public.set_builder_draft_homepage(uuid, text, text) to authenticated;

revoke all on function public.set_builder_homepage(uuid, text, text) from public, anon;
grant execute on function public.set_builder_homepage(uuid, text, text) to authenticated;

revoke all on function public.publish_builder_homepage(uuid, text, text) from public, anon;
grant execute on function public.publish_builder_homepage(uuid, text, text) to authenticated;

comment on function public.set_builder_draft_homepage(uuid, text, text) is
  'Transactionally updates the website draft homepage funnel using website-level lifecycle advisory locking, row FOR UPDATE locking, and optimistic expected-draft concurrency verification without mutating live homepage state.';

comment on function public.publish_builder_homepage(uuid, text, text) is
  'Transactionally promotes the draft homepage funnel to the live homepage funnel and synchronizes the root route after proving the target root page is published.';
