-- Transactionally atomic Page Reordering RPC for the Builder.
-- Guarantees single-transaction atomicity: shared lifecycle advisory lock, row FOR UPDATE locking, optimistic expected-order validation, exact page set enforcement, and contiguous 0-based step_order assignment.

create or replace function public.reorder_builder_pages(
  p_funnel_id text,
  p_ordered_page_ids text[],
  p_expected_page_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_funnel_owner text;
  v_current_page_ids text[];
  v_page_count integer;
  v_ordered_count integer;
  v_expected_count integer;
  v_unique_ordered_count integer;
  v_unique_expected_count integer;
  v_is_noop boolean := true;
  v_result jsonb;
  i integer;
begin
  -- 1. Authenticated user verification
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_funnel_id is null or length(trim(p_funnel_id)) = 0 or length(p_funnel_id) > 128 then
    raise sqlstate 'PT404' using message = 'Funnel not found';
  end if;

  if p_ordered_page_ids is null or p_expected_page_ids is null then
    raise sqlstate 'PT400' using message = 'Invalid page order payload';
  end if;

  v_ordered_count := coalesce(array_length(p_ordered_page_ids, 1), 0);
  v_expected_count := coalesce(array_length(p_expected_page_ids, 1), 0);

  if v_ordered_count = 0 or v_expected_count = 0 or v_ordered_count <> v_expected_count then
    raise sqlstate 'PT400' using message = 'Invalid page order array length';
  end if;

  -- Validate every element in BOTH the desired order and optimistic expected snapshot.
  for i in 1..v_ordered_count loop
    if p_ordered_page_ids[i] is null or length(trim(p_ordered_page_ids[i])) = 0 then
      raise sqlstate 'PT400' using message = 'Invalid page ID in ordered list';
    end if;
    if p_expected_page_ids[i] is null or length(trim(p_expected_page_ids[i])) = 0 then
      raise sqlstate 'PT400' using message = 'Invalid page ID in expected list';
    end if;
  end loop;

  -- Duplicate IDs are invalid in either complete-order array.
  select count(distinct id) into v_unique_ordered_count
  from unnest(p_ordered_page_ids) as id;

  if v_unique_ordered_count <> v_ordered_count then
    raise sqlstate 'PT400' using message = 'Duplicate page IDs in ordered list';
  end if;

  select count(distinct id) into v_unique_expected_count
  from unnest(p_expected_page_ids) as id;

  if v_unique_expected_count <> v_expected_count then
    raise sqlstate 'PT400' using message = 'Duplicate page IDs in expected list';
  end if;

  -- 3. Verify Funnel ownership
  select user_id into v_funnel_owner
  from public.funnels
  where id = p_funnel_id;

  if not found or v_funnel_owner <> v_user_id then
    raise sqlstate 'PT404' using message = 'Funnel not found';
  end if;

  -- 4. Acquire shared lifecycle advisory transaction lock on user+funnel
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('builder-page-lifecycle:' || v_user_id || ':' || p_funnel_id, 0)
  );

  -- 5. Post-lock load and row FOR UPDATE lock of all pages in the funnel
  perform 1
  from public.pages
  where user_id = v_user_id and funnel_id = p_funnel_id
  for update;

  -- Deterministic order fallback: step_order nulls last, created_at, id
  select coalesce(array_agg(id order by step_order nulls last, created_at, id), array[]::text[])
  into v_current_page_ids
  from public.pages
  where user_id = v_user_id and funnel_id = p_funnel_id;

  v_page_count := coalesce(array_length(v_current_page_ids, 1), 0);

  -- 6. Verify funnel has pages
  if v_page_count = 0 then
    raise sqlstate 'PT404' using message = 'No pages in funnel';
  end if;

  -- 7. OPTIMISTIC CONCURRENCY CHECK: Compare current order with p_expected_page_ids
  if v_page_count <> v_expected_count then
    raise sqlstate 'PT409' using message = 'The page order changed elsewhere. Reload and try again.';
  end if;

  for i in 1..v_page_count loop
    if v_current_page_ids[i] is distinct from p_expected_page_ids[i] then
      raise sqlstate 'PT409' using message = 'The page order changed elsewhere. Reload and try again.';
    end if;
  end loop;

  -- 8. Verify p_ordered_page_ids contains EXACTLY the current set of pages in this funnel
  if exists (
    select 1
    from unnest(p_ordered_page_ids) as o_id
    where o_id not in (select unnest(v_current_page_ids))
  ) or exists (
    select 1
    from unnest(v_current_page_ids) as c_id
    where c_id not in (select unnest(p_ordered_page_ids))
  ) then
    raise sqlstate 'PT400' using message = 'Ordered list does not match funnel page set';
  end if;

  -- 9. Check if reorder is a NO-OP
  for i in 1..v_page_count loop
    if v_current_page_ids[i] <> p_ordered_page_ids[i] then
      v_is_noop := false;
      exit;
    end if;
  end loop;

  -- 10. If not a no-op, apply contiguous zero-based step_order: 0, 1, ..., N-1
  if not v_is_noop then
    update public.pages
    set step_order = u.idx - 1
    from unnest(p_ordered_page_ids) with ordinality as u(page_id, idx)
    where public.pages.id = u.page_id
      and public.pages.user_id = v_user_id
      and public.pages.funnel_id = p_funnel_id;
  end if;

  -- 11. Build canonical JSON result
  select jsonb_build_object(
    'funnel_id', p_funnel_id,
    'pages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'user_id', p.user_id,
            'name', p.name,
            'slug', p.slug,
            'status', p.status,
            'seo_title', p.seo_title,
            'seo_description', p.seo_description,
            'seo_keywords', p.seo_keywords,
            'created_at', p.created_at,
            'funnel_id', p.funnel_id,
            'step_type', p.step_type,
            'step_order', p.step_order
          )
          order by p.step_order asc
        )
        from public.pages p
        where p.user_id = v_user_id and p.funnel_id = p_funnel_id
      ),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.reorder_builder_pages(text, text[], text[]) from public, anon;
grant execute on function public.reorder_builder_pages(text, text[], text[]) to authenticated;

comment on function public.reorder_builder_pages(text, text[], text[]) is
  'Transactionally reorders builder pages within an owned funnel using shared lifecycle advisory locking, row FOR UPDATE locking, and optimistic expected-order concurrency verification.';
