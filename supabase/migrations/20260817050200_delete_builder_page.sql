-- Transactionally atomic Page Deletion RPC for the Builder.
-- Guarantees single-transaction atomicity: page graph deletion, section cascade, and last-page invariant protection.

create or replace function public.delete_builder_page(
  p_page_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_target_page public.pages%rowtype;
  v_funnel_owner text;
  v_funnel_id text;
  v_page_count integer;
  v_result jsonb;
begin
  -- 1. Authenticated user verification
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;

  -- 2. Input validation
  if p_page_id is null or length(trim(p_page_id)) = 0 or length(p_page_id) > 128 then
    raise sqlstate 'PT404' using message = 'Page not found';
  end if;

  -- 3. Load target Page and verify ownership
  select * into v_target_page
  from public.pages
  where id = p_page_id;

  if not found or v_target_page.user_id <> v_user_id then
    raise sqlstate 'PT404' using message = 'Page not found';
  end if;

  v_funnel_id := v_target_page.funnel_id;

  -- 4. Verify Funnel ownership if funnel_id is present
  if v_funnel_id is not null and v_funnel_id <> '' then
    select user_id into v_funnel_owner
    from public.funnels
    where id = v_funnel_id;

    if not found or v_funnel_owner <> v_user_id then
      raise sqlstate 'PT403' using message = 'Corrupt or unowned funnel relationship';
    end if;
  end if;

  -- 5. Acquire shared lifecycle advisory transaction lock on user+funnel
  if v_funnel_id is not null and v_funnel_id <> '' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('builder-page-lifecycle:' || v_user_id || ':' || v_funnel_id, 0)
    );
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('builder-page-lifecycle:' || v_user_id || ':nofunnel', 0)
    );
  end if;

  -- 6. Enforce LAST_PAGE invariant: check remaining pages in funnel
  if v_funnel_id is not null and v_funnel_id <> '' then
    select count(*) into v_page_count
    from public.pages
    where user_id = v_user_id and funnel_id = v_funnel_id;

    if v_page_count <= 1 then
      raise sqlstate 'PT422' using message = 'Cannot delete the only page in this website';
    end if;
  end if;

  -- 7. Execute deletion (Cascading FKs handle page_sections, page_section_save_revisions, etc.)
  delete from public.pages
  where id = p_page_id
    and user_id = v_user_id;

  -- 8. Return canonical JSON result
  select jsonb_build_object(
    'id', p_page_id,
    'funnel_id', v_funnel_id,
    'deleted', true
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.delete_builder_page(text) from public, anon;
grant execute on function public.delete_builder_page(text) to authenticated;

comment on function public.delete_builder_page(text) is
  'Transactionally deletes a builder page and its owned section graph for the authenticated owner, enforcing minimum page count.';
