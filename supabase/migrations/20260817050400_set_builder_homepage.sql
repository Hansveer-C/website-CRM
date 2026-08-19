-- Transactionally atomic Homepage Selection RPC for the Builder.
-- Guarantees single-transaction atomicity: website-level lifecycle advisory lock, row FOR UPDATE locking, optimistic expected-homepage concurrency verification, destination ownership & association verification, and synchronized root '/' route update.

create or replace function public.set_builder_homepage(
  p_website_id uuid,
  p_funnel_id text,
  p_expected_homepage_funnel_id text
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
  v_current_homepage_funnel_id text;
  v_is_associated boolean;
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
  select true, homepage_funnel_id
  into v_website_exists, v_current_homepage_funnel_id
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
  -- (either it is currently the homepage_funnel_id or it is mapped in website_routes for this website)
  select exists (
    select 1
    from public.website_routes
    where website_id = p_website_id and funnel_id = p_funnel_id
  ) or (v_current_homepage_funnel_id = p_funnel_id)
  into v_is_associated;

  if not v_is_associated then
    raise sqlstate 'PT400' using message = 'Funnel is not an associated destination for this website';
  end if;

  -- 7. OPTIMISTIC CONCURRENCY CHECK: Compare current homepage with p_expected_homepage_funnel_id
  if v_current_homepage_funnel_id is distinct from p_expected_homepage_funnel_id then
    raise sqlstate 'PT409' using message = 'The homepage changed elsewhere. Reload and try again.';
  end if;

  -- 8. Apply update (if not a no-op)
  if v_current_homepage_funnel_id is distinct from p_funnel_id then
    update public.websites
    set homepage_funnel_id = p_funnel_id,
        updated_at = v_now
    where id = p_website_id and user_id = v_user_id;

    -- Synchronize root route '/' in website_routes to point to the new homepage funnel
    insert into public.website_routes(id, website_id, path, funnel_id, created_at)
    values (
      pg_catalog.gen_random_uuid(),
      p_website_id,
      '/',
      p_funnel_id,
      v_now
    )
    on conflict (website_id, path)
    do update set funnel_id = excluded.funnel_id;
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
      'created_at', w.created_at,
      'updated_at', w.updated_at
    )
  ) into v_result
  from public.websites w
  where w.id = p_website_id and w.user_id = v_user_id;

  return v_result;
end;
$$;

revoke all on function public.set_builder_homepage(uuid, text, text) from public, anon;
grant execute on function public.set_builder_homepage(uuid, text, text) to authenticated;

comment on function public.set_builder_homepage(uuid, text, text) is
  'Transactionally updates the website homepage funnel using website-level lifecycle advisory locking, row FOR UPDATE locking, optimistic expected-homepage concurrency verification, and synchronized root route update.';
