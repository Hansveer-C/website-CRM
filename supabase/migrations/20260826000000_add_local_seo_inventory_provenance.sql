-- Forward-only reconciliation: 20260825000000 is already applied in production.
create schema if not exists private;

create table if not exists private.local_seo_pages (
  user_id text not null references public.users(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  funnel_id text not null references public.funnels(id) on delete cascade,
  page_id text not null references public.pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id),
  unique (website_id, funnel_id)
);
revoke all on table private.local_seo_pages from public, anon, authenticated;

-- Preserve the deployed function verbatim and add provenance directly after the
-- existing route authority write, inside its transaction and lock ordering.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_local_seo_draft_batch(uuid,text[],text[],text)'::regprocedure) into definition;
  if definition is null or position('perform public.set_builder_route_draft(p_website_id, v_funnel_id, ''/'' || v_slug, null, null, null);' in definition) = 0 then
    raise exception 'Expected deployed Local SEO generation function was not found';
  end if;
  definition := replace(
    definition,
    'perform public.set_builder_route_draft(p_website_id, v_funnel_id, ''/'' || v_slug, null, null, null);',
    'perform public.set_builder_route_draft(p_website_id, v_funnel_id, ''/'' || v_slug, null, null, null); insert into private.local_seo_pages(user_id, website_id, funnel_id, page_id) values (v_user_id, p_website_id, v_funnel_id, v_page->>''id'');'
  );
  execute definition;
end;
$$;
revoke all on function public.create_local_seo_draft_batch(uuid, text[], text[], text) from public, anon;
grant execute on function public.create_local_seo_draft_batch(uuid, text[], text[], text) to authenticated;

create or replace function public.get_local_seo_inventory(p_website_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id text := (select auth.uid())::text; v_pages jsonb;
begin
  if v_user_id is null or v_user_id = '' then raise sqlstate 'PT401' using message = 'Authentication required'; end if;
  if p_website_id is null or not exists (select 1 from public.websites where id = p_website_id and user_id = v_user_id) then raise sqlstate 'PT404' using message = 'Website not found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('website_id', registry.website_id, 'funnel_id', registry.funnel_id, 'page_id', registry.page_id, 'service', funnel.service_type, 'city', funnel.city, 'path', coalesce(live.path, draft.path), 'publication_state', case when live.path is not null then 'live' else 'draft' end) order by coalesce(live.path, draft.path)), '[]'::jsonb)
  into v_pages from private.local_seo_pages registry
  join public.funnels funnel on funnel.id = registry.funnel_id and funnel.user_id = v_user_id and funnel.website_id = p_website_id
  left join public.builder_route_drafts draft on draft.website_id = p_website_id and draft.funnel_id = registry.funnel_id and draft.action = 'upsert'
  left join public.website_routes live on live.website_id = p_website_id and live.funnel_id = registry.funnel_id
  where registry.user_id = v_user_id and registry.website_id = p_website_id and coalesce(live.path, draft.path) is not null;
  return jsonb_build_object('success', true, 'data', jsonb_build_object('website_id', p_website_id, 'pages', v_pages));
end;
$$;
revoke all on function public.get_local_seo_inventory(uuid) from public, anon;
grant execute on function public.get_local_seo_inventory(uuid) to authenticated;
