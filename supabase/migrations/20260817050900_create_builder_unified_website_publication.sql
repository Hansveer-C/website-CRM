-- Migration: 20260817050900_create_builder_unified_website_publication.sql
-- Description: Unified Website Publication Transaction, Server-Authoritative Publish Plan, Immutable Publication Audit Log, and Server-Authoritative DML Hardening (Phase 1B / Task 7)

-- 1. Add monotonic website-level publication revision to websites
alter table public.websites
add column if not exists publication_revision integer not null default 0;

-- 2. Create immutable website publication audit table
create table if not exists public.builder_website_publications (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  publication_revision integer not null check (publication_revision >= 1),
  published_by text references public.users(id) on delete set null,
  published_at timestamptz not null default now(),
  expected_state jsonb not null,
  summary jsonb not null,
  constraint builder_website_publications_rev_unique unique (website_id, publication_revision)
);

create index if not exists idx_builder_website_publications_lookup
  on public.builder_website_publications (website_id, publication_revision desc);

alter table public.builder_website_publications enable row level security;
alter table public.builder_website_publications force row level security;

-- Revoke default access and grant SELECT to authenticated, postgres, service_role under RLS
revoke all on table public.builder_website_publications from public, anon, authenticated;
grant select on table public.builder_website_publications to authenticated, postgres, service_role;

-- RLS: Only website owners can read their publication history
drop policy if exists "Owners can view builder website publications" on public.builder_website_publications;
create policy "Owners can view builder website publications"
  on public.builder_website_publications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.websites w
      where w.id = builder_website_publications.website_id
        and w.user_id = (select auth.uid())::text
    )
  );

-- RPC 1: Get Server-Authoritative Website Publish Plan
create or replace function public.get_builder_website_publish_plan(
  p_website_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website record;
  v_pub_revision integer := 0;
  v_live_homepage text;
  v_draft_homepage text;
  v_effective_homepage text;
  v_homepage_changed boolean := false;
  v_homepage_label text := '';
  v_live_homepage_label text := '';

  -- Route drafts
  v_draft_route_rec record;
  v_expected_route_drafts jsonb := '[]'::jsonb;
  v_route_creates jsonb := '[]'::jsonb;
  v_route_updates jsonb := '[]'::jsonb;
  v_route_deletes jsonb := '[]'::jsonb;
  v_has_route_changes boolean := false;

  -- Navigation
  v_primary_draft record;
  v_primary_live record;
  v_footer_draft record;
  v_footer_live record;
  v_has_primary_draft boolean := false;
  v_has_footer_draft boolean := false;
  v_primary_items jsonb := '[]'::jsonb;
  v_footer_items jsonb := '[]'::jsonb;
  v_primary_expected jsonb;
  v_footer_expected jsonb;

  -- Pages / Content
  v_pending_pages jsonb := '[]'::jsonb;
  v_expected_pages jsonb := '[]'::jsonb;
  v_has_page_changes boolean := false;
  v_page_rec record;
  v_save_rev bigint;
  v_doc_hash text;
  v_target_pub_rev_id uuid;
  v_target_doc_fp text;
  v_page_doc jsonb;
  v_saved_fp text;

  -- Projected State Collections
  v_projected_routes jsonb := '[]'::jsonb;
  v_projected_funnels text[] := array[]::text[];
  v_projected_paths text[] := array[]::text[];
  v_live_route_rec record;

  -- Blockers & Warnings
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_pending_domains text[] := array[]::text[];
  v_has_pending_changes boolean := false;
  v_is_publishable boolean := true;
  v_collision_paths text[];

  -- Helper vars
  v_item jsonb;
  v_item_label text;
  v_target_kind text;
  v_target_val text;
  v_item_vis boolean;
  v_expected_state jsonb;
  v_summary jsonb;
begin
  -- 1. Authentication
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  -- 2. Validate website ownership
  select id, user_id, name, homepage_funnel_id, draft_homepage_funnel_id, coalesce(publication_revision, 0) as pub_rev
  into v_website
  from public.websites
  where id = p_website_id and user_id = v_user_id;

  if not found or v_website.id is null then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  v_pub_revision := v_website.pub_rev;
  v_live_homepage := v_website.homepage_funnel_id;
  v_draft_homepage := v_website.draft_homepage_funnel_id;

  -- 3. Evaluate Homepage
  if v_draft_homepage is not null and v_draft_homepage <> coalesce(v_live_homepage, '') then
    v_effective_homepage := v_draft_homepage;
    v_homepage_changed := true;
    v_has_pending_changes := true;
    v_pending_domains := array_append(v_pending_domains, 'homepage');
  else
    v_effective_homepage := v_live_homepage;
  end if;

  if v_effective_homepage is not null then
    select name into v_homepage_label from public.funnels where id = v_effective_homepage and user_id = v_user_id;
  end if;
  if v_live_homepage is not null then
    select name into v_live_homepage_label from public.funnels where id = v_live_homepage and user_id = v_user_id;
  end if;

  -- 4. Evaluate Route Drafts (Ordered deterministically by ID)
  for v_draft_route_rec in (
    select id, route_id, path, funnel_id, action
    from public.builder_route_drafts
    where website_id = p_website_id
    order by id asc
  ) loop
    v_has_route_changes := true;
    v_expected_route_drafts := v_expected_route_drafts || jsonb_build_object(
      'id', v_draft_route_rec.id,
      'route_id', v_draft_route_rec.route_id,
      'action', v_draft_route_rec.action,
      'path', v_draft_route_rec.path,
      'funnel_id', v_draft_route_rec.funnel_id
    );

    if v_draft_route_rec.action = 'delete' then
      v_route_deletes := v_route_deletes || jsonb_build_object('id', v_draft_route_rec.id, 'route_id', v_draft_route_rec.route_id, 'path', v_draft_route_rec.path, 'funnel_id', v_draft_route_rec.funnel_id);
    elsif v_draft_route_rec.route_id is not null then
      v_route_updates := v_route_updates || jsonb_build_object('id', v_draft_route_rec.id, 'route_id', v_draft_route_rec.route_id, 'path', v_draft_route_rec.path, 'funnel_id', v_draft_route_rec.funnel_id);
    else
      v_route_creates := v_route_creates || jsonb_build_object('id', v_draft_route_rec.id, 'path', v_draft_route_rec.path, 'funnel_id', v_draft_route_rec.funnel_id);
    end if;
  end loop;

  if v_has_route_changes then
    v_has_pending_changes := true;
    v_pending_domains := array_append(v_pending_domains, 'routes');
  end if;

  -- 5. Evaluate Primary Navigation
  select items, base_revision, draft_revision into v_primary_draft
  from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = 'primary';

  select items, revision into v_primary_live
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = 'primary';

  if v_primary_draft.items is not null then
    v_has_primary_draft := true;
    v_has_pending_changes := true;
    v_pending_domains := array_append(v_pending_domains, 'primary_navigation');
    v_primary_items := v_primary_draft.items;
    v_primary_expected := jsonb_build_object(
      'is_draft', true,
      'base_revision', v_primary_draft.base_revision,
      'draft_revision', v_primary_draft.draft_revision,
      'live_revision', coalesce(v_primary_live.revision, 0)
    );
  else
    v_primary_items := coalesce(v_primary_live.items, '[]'::jsonb);
    v_primary_expected := jsonb_build_object(
      'is_draft', false,
      'base_revision', 0,
      'draft_revision', 0,
      'live_revision', coalesce(v_primary_live.revision, 0)
    );
  end if;

  -- 6. Evaluate Footer Navigation
  select items, base_revision, draft_revision into v_footer_draft
  from public.builder_site_navigation_drafts
  where website_id = p_website_id and menu_scope = 'footer';

  select items, revision into v_footer_live
  from public.builder_site_navigation_live
  where website_id = p_website_id and menu_scope = 'footer';

  if v_footer_draft.items is not null then
    v_has_footer_draft := true;
    v_has_pending_changes := true;
    v_pending_domains := array_append(v_pending_domains, 'footer_navigation');
    v_footer_items := v_footer_draft.items;
    v_footer_expected := jsonb_build_object(
      'is_draft', true,
      'base_revision', v_footer_draft.base_revision,
      'draft_revision', v_footer_draft.draft_revision,
      'live_revision', coalesce(v_footer_live.revision, 0)
    );
  else
    v_footer_items := coalesce(v_footer_live.items, '[]'::jsonb);
    v_footer_expected := jsonb_build_object(
      'is_draft', false,
      'base_revision', 0,
      'draft_revision', 0,
      'live_revision', coalesce(v_footer_live.revision, 0)
    );
  end if;

  -- 7. Build Projected Final Route Set
  -- A. Add live non-root routes that are NOT deleted or renamed in drafts
  for v_live_route_rec in (
    select id, path, funnel_id
    from public.website_routes
    where website_id = p_website_id
      and path <> '/'
      and id not in (
        select coalesce(route_id, '00000000-0000-0000-0000-000000000000'::uuid)
        from public.builder_route_drafts
        where website_id = p_website_id and route_id is not null
      )
    order by path asc
  ) loop
    v_projected_routes := v_projected_routes || jsonb_build_object('path', v_live_route_rec.path, 'funnel_id', v_live_route_rec.funnel_id);
    v_projected_paths := array_append(v_projected_paths, v_live_route_rec.path);
  end loop;

  -- B. Add route draft upserts/creates (ordered deterministically by path asc)
  for v_draft_route_rec in (
    select path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'upsert'
    order by path asc
  ) loop
    v_projected_routes := v_projected_routes || jsonb_build_object('path', v_draft_route_rec.path, 'funnel_id', v_draft_route_rec.funnel_id);
    v_projected_paths := array_append(v_projected_paths, v_draft_route_rec.path);
  end loop;

  -- C. Add projected homepage root route '/'
  if v_effective_homepage is not null then
    v_projected_routes := v_projected_routes || jsonb_build_object('path', '/', 'funnel_id', v_effective_homepage);
    v_projected_paths := array_append(v_projected_paths, '/');
  end if;

  -- Derive projected funnels directly from projected routes entries
  select array_agg(distinct (r->>'funnel_id'))
  into v_projected_funnels
  from jsonb_array_elements(v_projected_routes) as r;
  v_projected_funnels := coalesce(v_projected_funnels, array[]::text[]);

  -- 8. Evaluate Participating Pages from Projected Funnels
  for v_page_rec in (
    select p.id, p.user_id, p.funnel_id, p.name, p.slug, p.status, coalesce(p.step_order, 0) as step_order
    from public.pages p
    where p.user_id = v_user_id
      and p.funnel_id = any(v_projected_funnels)
    order by p.id asc
  ) loop
    -- Fetch authoritative save revision from private.page_section_save_revisions
    select revision, document_hash
    into v_save_rev, v_doc_hash
    from private.page_section_save_revisions
    where page_id = v_page_rec.id;

    v_save_rev := coalesce(v_save_rev, 0);
    v_doc_hash := coalesce(v_doc_hash, pg_catalog.md5('[]'));

    -- Fetch current publication target and revision fingerprint
    select bpt.published_revision_id, bpr.document_fingerprint
    into v_target_pub_rev_id, v_target_doc_fp
    from public.builder_publication_targets bpt
    left join public.builder_published_revisions bpr
      on bpr.id = bpt.published_revision_id and bpr.website_id = p_website_id and bpr.page_id = v_page_rec.id
    where bpt.website_id = p_website_id and bpt.page_id = v_page_rec.id;

    -- Construct canonical saved BuilderDocument
    select jsonb_build_object(
      'schemaVersion', 1,
      'page', jsonb_build_object(
        'id', v_page_rec.id,
        'user_id', v_page_rec.user_id,
        'funnel_id', v_page_rec.funnel_id,
        'name', v_page_rec.name,
        'slug', v_page_rec.slug,
        'status', 'published',
        'step_order', v_page_rec.step_order
      ),
      'sections', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'page_id', s.page_id,
              'type', s.type,
              'order', s.order_index,
              'content', s.content,
              'styles', coalesce(s.styles, '{}'::jsonb)
            ) order by s.order_index asc, s.id asc
          )
          from public.page_sections s
          where s.page_id = v_page_rec.id and s.user_id = v_user_id
        ),
        '[]'::jsonb
      )
    ) into v_page_doc;

    v_saved_fp := pg_catalog.md5(v_page_doc::text);

    -- Check if content actually changed or page was never published
    if v_target_pub_rev_id is null or v_saved_fp is distinct from v_target_doc_fp then
      v_has_page_changes := true;
      v_pending_pages := v_pending_pages || jsonb_build_object(
        'page_id', v_page_rec.id,
        'name', v_page_rec.name,
        'slug', v_page_rec.slug
      );
    end if;

    -- Record authoritative content save token and canonical document fingerprint in expected_state
    v_expected_pages := v_expected_pages || jsonb_build_object(
      'page_id', v_page_rec.id,
      'save_revision', v_save_rev,
      'section_document_hash', v_doc_hash,
      'canonical_document_fingerprint', v_saved_fp,
      'current_published_revision_id', v_target_pub_rev_id
    );
  end loop;

  if v_has_page_changes then
    v_has_pending_changes := true;
    v_pending_domains := array_append(v_pending_domains, 'pages');
  end if;

  -- 9. VALIDATION & BLOCKER DETECTION
  -- A. Homepage Validation
  if v_effective_homepage is null then
    v_blockers := v_blockers || jsonb_build_object('domain', 'homepage', 'code', 'HOMEPAGE_MISSING', 'message', 'Website has no homepage assigned.');
  else
    if not exists (select 1 from public.funnels where id = v_effective_homepage and user_id = v_user_id) then
      v_blockers := v_blockers || jsonb_build_object('domain', 'homepage', 'code', 'HOMEPAGE_FUNNEL_NOT_FOUND', 'message', 'The assigned homepage funnel no longer exists.');
    end if;
  end if;

  -- B. Route Collisions Validation against Projected Paths
  select array_agg(p) into v_collision_paths
  from (
    select unnest(v_projected_paths) as p
    group by p
    having count(*) > 1
  ) c;

  if v_collision_paths is not null and array_length(v_collision_paths, 1) > 0 then
    v_blockers := v_blockers || jsonb_build_object(
      'domain', 'routes',
      'code', 'ROUTE_PATH_COLLISION',
      'message', 'Duplicate route path collision detected in projected routes: ' || array_to_string(v_collision_paths, ', ')
    );
  end if;

  -- C. Primary Navigation Validation against Projected Routes
  if v_has_primary_draft and jsonb_array_length(v_primary_items) > 0 then
    for v_item in select * from jsonb_array_elements(v_primary_items) loop
      v_target_kind := v_item->>'target_kind';
      v_target_val := v_item->>'target_value';
      v_item_vis := coalesce((v_item->>'visible')::boolean, true);
      v_item_label := coalesce(v_item->>'label', 'Untitled');

      if v_item_vis and v_target_kind = 'internal' then
        if not (v_target_val = any(v_projected_funnels)) then
          v_blockers := v_blockers || jsonb_build_object(
            'domain', 'primary_navigation',
            'code', 'NAV_TARGET_UNROUTED',
            'message', 'Primary navigation link "' || v_item_label || '" points to a destination without a public route.'
          );
        end if;
      end if;
    end loop;
  end if;

  -- D. Footer Navigation Validation against Projected Routes
  if v_has_footer_draft and jsonb_array_length(v_footer_items) > 0 then
    for v_item in select * from jsonb_array_elements(v_footer_items) loop
      v_target_kind := v_item->>'target_kind';
      v_target_val := v_item->>'target_value';
      v_item_vis := coalesce((v_item->>'visible')::boolean, true);
      v_item_label := coalesce(v_item->>'label', 'Untitled');

      if v_item_vis and v_target_kind = 'internal' then
        if not (v_target_val = any(v_projected_funnels)) then
          v_blockers := v_blockers || jsonb_build_object(
            'domain', 'footer_navigation',
            'code', 'NAV_TARGET_UNROUTED',
            'message', 'Footer navigation link "' || v_item_label || '" points to a destination without a public route.'
          );
        end if;
      end if;
    end loop;
  end if;

  -- 10. Construct Canonical Expected State Token
  v_expected_state := jsonb_build_object(
    'publication_revision', v_pub_revision,
    'homepage', jsonb_build_object(
      'draft_funnel_id', v_draft_homepage,
      'live_funnel_id', v_live_homepage
    ),
    'route_drafts', v_expected_route_drafts,
    'primary_navigation', v_primary_expected,
    'footer_navigation', v_footer_expected,
    'pages', v_expected_pages
  );

  -- 11. Construct Summary Object
  v_summary := jsonb_build_object(
    'homepage', jsonb_build_object(
      'changed', v_homepage_changed,
      'current_live', v_live_homepage_label,
      'next_live', v_homepage_label
    ),
    'routes', jsonb_build_object(
      'has_changes', v_has_route_changes,
      'creates', v_route_creates,
      'updates', v_route_updates,
      'deletes', v_route_deletes
    ),
    'primary_navigation', jsonb_build_object(
      'has_changes', v_has_primary_draft,
      'item_count', jsonb_array_length(v_primary_items),
      'is_empty', (jsonb_array_length(v_primary_items) = 0)
    ),
    'footer_navigation', jsonb_build_object(
      'has_changes', v_has_footer_draft,
      'item_count', jsonb_array_length(v_footer_items),
      'is_empty', (jsonb_array_length(v_footer_items) = 0)
    ),
    'pages', jsonb_build_object(
      'has_changes', v_has_page_changes,
      'count', jsonb_array_length(v_pending_pages),
      'items', v_pending_pages
    )
  );

  v_is_publishable := (jsonb_array_length(v_blockers) = 0);

  return jsonb_build_object(
    'website_id', p_website_id,
    'publication_revision', v_pub_revision,
    'has_pending_changes', v_has_pending_changes,
    'pending_domains', to_jsonb(v_pending_domains),
    'expected_state', v_expected_state,
    'summary', v_summary,
    'blockers', v_blockers,
    'warnings', v_warnings,
    'is_publishable', v_is_publishable
  );
end;
$$;

revoke all on function public.get_builder_website_publish_plan(uuid) from public, anon;
grant execute on function public.get_builder_website_publish_plan(uuid) to authenticated, postgres, service_role;


-- RPC 2: Publish Entire Website Atomically
create or replace function public.publish_builder_website(
  p_website_id uuid,
  p_expected_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_website record;
  v_plan jsonb;
  v_current_expected jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_effective_homepage text;
  v_draft_homepage text;
  v_pub_revision integer;
  v_summary jsonb;
  v_publication_id uuid;

  -- Locking helpers
  v_projected_routes jsonb := '[]'::jsonb;
  v_projected_paths text[] := array[]::text[];
  v_projected_funnels text[] := array[]::text[];
  v_live_route_rec record;
  v_draft_route_rec record;
  v_lock_funnel_id text;
  v_frozen_page_ids text[] := array[]::text[];
  v_lock_page_id text;

  -- Page mutation vars
  v_page_rec record;
  v_page_doc jsonb;
  v_doc_fp text;
  v_target_pub_rev_id uuid;
  v_target_doc_fp text;
  v_revision_id uuid;

  -- Route mutation vars
  v_draft_route record;
  v_old_live_path text;
  v_old_live_funnel text;
  v_new_route_id uuid;
  v_reclaim_id uuid;
begin
  -- 1. Authentication
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if p_expected_state is null or jsonb_typeof(p_expected_state) <> 'object' then
    raise sqlstate 'PT400' using message = 'Expected state token is required and must be an object';
  end if;

  -- 2. Acquire standard website lifecycle advisory lock
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-website-lifecycle:' || v_user_id || ':' || p_website_id::text, 0)
  );

  -- 3. Lock website row
  select id, user_id, name, homepage_funnel_id, draft_homepage_funnel_id, coalesce(publication_revision, 0) as pub_rev
  into v_website
  from public.websites
  where id = p_website_id and user_id = v_user_id
  for update;

  if not found or v_website.id is null then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  -- Derive projected funnels to identify participating funnels
  v_effective_homepage := coalesce(v_website.draft_homepage_funnel_id, v_website.homepage_funnel_id);

  for v_live_route_rec in (
    select id, path, funnel_id
    from public.website_routes
    where website_id = p_website_id
      and path <> '/'
      and id not in (
        select coalesce(route_id, '00000000-0000-0000-0000-000000000000'::uuid)
        from public.builder_route_drafts
        where website_id = p_website_id and route_id is not null
      )
    order by path asc
  ) loop
    v_projected_routes := v_projected_routes || jsonb_build_object('path', v_live_route_rec.path, 'funnel_id', v_live_route_rec.funnel_id);
  end loop;

  for v_draft_route_rec in (
    select path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'upsert'
    order by path asc
  ) loop
    v_projected_routes := v_projected_routes || jsonb_build_object('path', v_draft_route_rec.path, 'funnel_id', v_draft_route_rec.funnel_id);
  end loop;

  if v_effective_homepage is not null then
    v_projected_routes := v_projected_routes || jsonb_build_object('path', '/', 'funnel_id', v_effective_homepage);
  end if;

  select array_agg(distinct (r->>'funnel_id'))
  into v_projected_funnels
  from jsonb_array_elements(v_projected_routes) as r;
  v_projected_funnels := coalesce(v_projected_funnels, array[]::text[]);

  -- 4. Acquire page lifecycle advisory lock for EVERY projected participating funnel in deterministic ascending order
  for v_lock_funnel_id in (
    select distinct f
    from unnest(v_projected_funnels) as f
    where f is not null and f <> ''
    order by f asc
  ) loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('builder-page-lifecycle:' || v_user_id || ':' || v_lock_funnel_id, 0)
    );
  end loop;

  -- 5. Enumerate and FREEZE exact participating page IDs server-side in deterministic order
  select array_agg(p.id order by p.id asc)
  into v_frozen_page_ids
  from public.pages p
  where p.user_id = v_user_id
    and p.funnel_id = any(v_projected_funnels);
  v_frozen_page_ids := coalesce(v_frozen_page_ids, array[]::text[]);

  -- 6. Acquire page-sections advisory locks for every frozen page ID in deterministic ascending order
  for v_lock_page_id in (
    select unnest(v_frozen_page_ids) as id
    order by id asc
  ) loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('page-sections:' || v_lock_page_id, 0)
    );
  end loop;

  -- 7. Lock participating pages rows for update in deterministic ascending order
  perform 1
  from public.pages p
  where p.id = any(v_frozen_page_ids)
  order by p.id asc
  for update;

  -- 8. Reconstruct server-authoritative publish plan under lock
  v_plan := public.get_builder_website_publish_plan(p_website_id);
  v_current_expected := v_plan->'expected_state';

  -- 9. Strict optimistic concurrency check
  if v_current_expected is distinct from p_expected_state then
    raise sqlstate 'PT409' using message = 'Website changes were updated elsewhere. Reload the publish summary before continuing.';
  end if;

  -- 10. No changes check
  if not (v_plan->>'has_pending_changes')::boolean then
    return jsonb_build_object(
      'success', true,
      'status', 'NO_CHANGES',
      'message', 'Everything is already published.',
      'publication_revision', v_website.pub_rev
    );
  end if;

  -- 11. Blocker check (Abort transaction if any blocker exists in projected final state)
  if not (v_plan->>'is_publishable')::boolean or jsonb_array_length(v_plan->'blockers') > 0 then
    raise sqlstate 'PT409' using message = coalesce(
      'Publication blocked: ' || (v_plan->'blockers'->0->>'message'),
      'Publication blocked due to validation errors in projected website state.'
    );
  end if;

  -- 12. EXECUTE ATOMIC PROMOTION MUTATIONS

  -- A. Pages / Content Publication Targets (Publish ONLY changed content, iterating over FROZEN page IDs)
  for v_page_rec in (
    select p.id, p.user_id, p.funnel_id, p.name, p.slug, p.status, coalesce(p.step_order, 0) as step_order
    from public.pages p
    where p.id = any(v_frozen_page_ids)
    order by p.id asc
  ) loop
    -- Construct canonical BuilderDocument from page_sections
    select jsonb_build_object(
      'schemaVersion', 1,
      'page', jsonb_build_object(
        'id', v_page_rec.id,
        'user_id', v_page_rec.user_id,
        'funnel_id', v_page_rec.funnel_id,
        'name', v_page_rec.name,
        'slug', v_page_rec.slug,
        'status', 'published',
        'step_order', v_page_rec.step_order
      ),
      'sections', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'page_id', s.page_id,
              'type', s.type,
              'order', s.order_index,
              'content', s.content,
              'styles', coalesce(s.styles, '{}'::jsonb)
            ) order by s.order_index asc, s.id asc
          )
          from public.page_sections s
          where s.page_id = v_page_rec.id and s.user_id = v_user_id
        ),
        '[]'::jsonb
      )
    ) into v_page_doc;

    v_doc_fp := pg_catalog.md5(v_page_doc::text);

    -- Fetch current publication target and fingerprint
    select bpt.published_revision_id, bpr.document_fingerprint
    into v_target_pub_rev_id, v_target_doc_fp
    from public.builder_publication_targets bpt
    left join public.builder_published_revisions bpr
      on bpr.id = bpt.published_revision_id and bpr.website_id = p_website_id and bpr.page_id = v_page_rec.id
    where bpt.website_id = p_website_id and bpt.page_id = v_page_rec.id;

    -- Publish ONLY if content actually changed or never published before
    if v_target_pub_rev_id is null or v_doc_fp is distinct from v_target_doc_fp then
      v_revision_id := pg_catalog.gen_random_uuid();

      -- Create published revision record
      insert into public.builder_published_revisions (
        id, website_id, page_id, created_at, created_by, schema_version, document, document_fingerprint
      ) values (
        v_revision_id, p_website_id, v_page_rec.id, v_now, v_user_id, 1, v_page_doc, v_doc_fp
      );

      -- Upsert publication target
      insert into public.builder_publication_targets (
        website_id, page_id, published_revision_id, published_at, published_by
      ) values (
        p_website_id, v_page_rec.id, v_revision_id, v_now, v_user_id
      )
      on conflict (website_id, page_id)
      do update set
        published_revision_id = excluded.published_revision_id,
        published_at = excluded.published_at,
        published_by = excluded.published_by;

      -- Set page status published
      update public.pages
      set status = 'published'
      where id = v_page_rec.id and user_id = v_user_id;
    end if;
  end loop;

  -- B. Homepage Promotion
  v_draft_homepage := v_website.draft_homepage_funnel_id;
  if v_draft_homepage is not null and v_draft_homepage <> coalesce(v_website.homepage_funnel_id, '') then
    update public.websites
    set homepage_funnel_id = v_draft_homepage,
        draft_homepage_funnel_id = null,
        updated_at = v_now
    where id = p_website_id and user_id = v_user_id;

    -- Upsert root route '/' to point to new homepage
    insert into public.website_routes (
      website_id, path, funnel_id, created_at
    ) values (
      p_website_id, '/', v_draft_homepage, v_now
    )
    on conflict (website_id, path)
    do update set
      funnel_id = excluded.funnel_id;
  end if;

  -- C. Route Drafts Promotion
  -- Staged Deletions
  for v_draft_route in (
    select id, route_id, path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'delete' and route_id is not null
  ) loop
    delete from public.website_routes
    where id = v_draft_route.route_id and website_id = p_website_id;
  end loop;

  -- Staged Updates / Renames
  for v_draft_route in (
    select id, route_id, path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'upsert' and route_id is not null
  ) loop
    select path, funnel_id into v_old_live_path, v_old_live_funnel
    from public.website_routes
    where id = v_draft_route.route_id and website_id = p_website_id;

    if v_old_live_path is not null then
      if v_old_live_path is distinct from v_draft_route.path then
        -- Path changed (Rename): Update live route, create redirect, and collapse chains
        update public.website_routes
        set path = v_draft_route.path,
            funnel_id = v_draft_route.funnel_id
        where id = v_draft_route.route_id and website_id = p_website_id;

        -- Create redirect from old path to new path
        insert into public.website_route_redirects (
          website_id, from_path, to_path, created_at, updated_at
        ) values (
          p_website_id, v_old_live_path, v_draft_route.path, v_now, v_now
        )
        on conflict (website_id, from_path)
        do update set
          to_path = excluded.to_path,
          updated_at = excluded.updated_at;

        -- Collapse existing chains pointing to old path
        update public.website_route_redirects
        set to_path = v_draft_route.path,
            updated_at = v_now
        where website_id = p_website_id
          and to_path = v_old_live_path
          and from_path <> v_draft_route.path;

        -- Delete self-referential redirect if any
        delete from public.website_route_redirects
        where website_id = p_website_id and from_path = to_path;

        -- Reclaim redirect if new path was previously a redirect
        delete from public.website_route_redirects
        where website_id = p_website_id and from_path = v_draft_route.path;
      else
        -- Same path, destination funnel change only:
        update public.website_routes
        set funnel_id = v_draft_route.funnel_id
        where id = v_draft_route.route_id and website_id = p_website_id;
      end if;
    end if;
  end loop;

  -- Staged Creates
  for v_draft_route in (
    select id, path, funnel_id
    from public.builder_route_drafts
    where website_id = p_website_id and action = 'upsert' and route_id is null
  ) loop
    insert into public.website_routes (
      website_id, path, funnel_id, created_at
    ) values (
      p_website_id, v_draft_route.path, v_draft_route.funnel_id, v_now
    )
    on conflict (website_id, path)
    do update set
      funnel_id = excluded.funnel_id;

    -- Reclaim redirect if new path was previously a redirect
    delete from public.website_route_redirects
    where website_id = p_website_id and from_path = v_draft_route.path;
  end loop;

  -- Clear route drafts table for this website
  delete from public.builder_route_drafts
  where website_id = p_website_id;

  -- D. Navigation Drafts Promotion
  -- Primary Navigation
  if exists (select 1 from public.builder_site_navigation_drafts where website_id = p_website_id and menu_scope = 'primary') then
    insert into public.builder_site_navigation_live (
      website_id, menu_scope, items, revision, updated_at
    )
    select
      p_website_id, 'primary', d.items, coalesce(l.revision, 0) + 1, v_now
    from public.builder_site_navigation_drafts d
    left join public.builder_site_navigation_live l
      on l.website_id = p_website_id and l.menu_scope = 'primary'
    where d.website_id = p_website_id and d.menu_scope = 'primary'
    on conflict (website_id, menu_scope)
    do update set
      items = excluded.items,
      revision = public.builder_site_navigation_live.revision + 1,
      updated_at = excluded.updated_at;

    delete from public.builder_site_navigation_drafts
    where website_id = p_website_id and menu_scope = 'primary';
  end if;

  -- Footer Navigation
  if exists (select 1 from public.builder_site_navigation_drafts where website_id = p_website_id and menu_scope = 'footer') then
    insert into public.builder_site_navigation_live (
      website_id, menu_scope, items, revision, updated_at
    )
    select
      p_website_id, 'footer', d.items, coalesce(l.revision, 0) + 1, v_now
    from public.builder_site_navigation_drafts d
    left join public.builder_site_navigation_live l
      on l.website_id = p_website_id and l.menu_scope = 'footer'
    where d.website_id = p_website_id and d.menu_scope = 'footer'
    on conflict (website_id, menu_scope)
    do update set
      items = excluded.items,
      revision = public.builder_site_navigation_live.revision + 1,
      updated_at = excluded.updated_at;

    delete from public.builder_site_navigation_drafts
    where website_id = p_website_id and menu_scope = 'footer';
  end if;

  -- E. Increment Website Monotonic Publication Revision
  v_pub_revision := v_website.pub_rev + 1;

  update public.websites
  set publication_revision = v_pub_revision,
      updated_at = v_now
  where id = p_website_id and user_id = v_user_id;

  -- F. Create Immutable Website Publication Record
  v_publication_id := pg_catalog.gen_random_uuid();
  v_summary := v_plan->'summary';

  insert into public.builder_website_publications (
    id, website_id, publication_revision, published_by, published_at, expected_state, summary
  ) values (
    v_publication_id, p_website_id, v_pub_revision, v_user_id, v_now, p_expected_state, v_summary
  );

  return jsonb_build_object(
    'success', true,
    'publication_id', v_publication_id,
    'publication_revision', v_pub_revision,
    'published_at', v_now,
    'summary', v_summary
  );
end;
$$;

revoke all on function public.publish_builder_website(uuid, jsonb) from public, anon;
grant execute on function public.publish_builder_website(uuid, jsonb) to authenticated, postgres, service_role;


-- RPC 3: Get Website Publication History
create or replace function public.get_builder_website_publication_history(
  p_website_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_history jsonb := '[]'::jsonb;
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  if p_website_id is null then
    raise sqlstate 'PT400' using message = 'Website ID is required';
  end if;

  if not exists (select 1 from public.websites where id = p_website_id and user_id = v_user_id) then
    raise sqlstate 'PT404' using message = 'Website not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'publication_revision', p.publication_revision,
        'published_by', p.published_by,
        'published_at', p.published_at,
        'summary', p.summary
      ) order by p.publication_revision desc
    ),
    '[]'::jsonb
  ) into v_history
  from (
    select id, publication_revision, published_by, published_at, summary
    from public.builder_website_publications
    where website_id = p_website_id
    order by publication_revision desc
    limit coalesce(p_limit, 20)
  ) p;

  return jsonb_build_object(
    'website_id', p_website_id,
    'publications', v_history
  );
end;
$$;

revoke all on function public.get_builder_website_publication_history(uuid, integer) from public, anon;
grant execute on function public.get_builder_website_publication_history(uuid, integer) to authenticated, postgres, service_role;


-- ============================================================================
-- 3. DML Security & Server-Authoritative Privilege Hardening (Phase 1B / Task 7)
-- ============================================================================

-- A. public.page_sections: Direct write privileges revoked from anon/authenticated
revoke insert, update, delete on table public.page_sections from public, anon, authenticated;
grant select on table public.page_sections to authenticated, postgres, service_role;

-- B. Route tables: Direct write privileges revoked from anon/authenticated
revoke insert, update, delete on table public.builder_route_drafts from public, anon, authenticated;
grant select on table public.builder_route_drafts to authenticated, postgres, service_role;

revoke insert, update, delete on table public.website_routes from public, anon, authenticated;
grant select on table public.website_routes to authenticated, anon, postgres, service_role;

revoke insert, update, delete on table public.website_route_redirects from public, anon, authenticated;
grant select on table public.website_route_redirects to authenticated, anon, postgres, service_role;

-- C. Navigation tables: Direct write privileges revoked from anon/authenticated
revoke insert, update, delete on table public.builder_site_navigation_drafts from public, anon, authenticated;
grant select on table public.builder_site_navigation_drafts to authenticated, postgres, service_role;

revoke insert, update, delete on table public.builder_site_navigation_live from public, anon, authenticated;
grant select on table public.builder_site_navigation_live to authenticated, anon, postgres, service_role;

-- D. public.pages: Revoke direct lifecycle mutations (insert, delete, and restricted columns)
revoke insert, delete, update on table public.pages from public, anon, authenticated;
grant select on table public.pages to authenticated, postgres, service_role;
grant update (name, slug, seo_title, seo_description) on table public.pages to authenticated, postgres, service_role;

-- E. public.websites: Revoke direct publication-field updates
revoke insert, delete, update on table public.websites from public, anon, authenticated;
grant select on table public.websites to authenticated, anon, postgres, service_role;
grant update (name, domain, subdomain) on table public.websites to authenticated, postgres, service_role;

-- F. Publication revision & target tables: Direct write privileges revoked
revoke insert, update, delete on table public.builder_published_revisions from public, anon, authenticated;
grant select on table public.builder_published_revisions to authenticated, anon, postgres, service_role;

revoke insert, update, delete on table public.builder_publication_targets from public, anon, authenticated;
grant select on table public.builder_publication_targets to authenticated, anon, postgres, service_role;
