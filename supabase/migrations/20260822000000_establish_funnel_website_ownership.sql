-- Phase 1C / Task 7C.6C.2A: canonical ownership for website-owned funnels.
-- Standalone/marketing funnels intentionally retain a NULL website_id.

alter table public.funnels add column if not exists website_id uuid;

do $$ begin
  alter table public.websites add constraint websites_id_user_id_key unique (id, user_id);
exception when duplicate_object then null;
end $$;

-- Validate the legacy relation before assigning the canonical column. Never pick
-- a Website for a Funnel that is ambiguous, missing, or tenant-inconsistent.
do $$
begin
  if exists (
    with candidates as (
      select funnel_id, website_id from public.website_routes
      union all select homepage_funnel_id, id from public.websites where homepage_funnel_id is not null
      union all select draft_homepage_funnel_id, id from public.websites where draft_homepage_funnel_id is not null
    )
    select 1 from candidates c
    left join public.websites w on w.id = c.website_id
    left join public.funnels f on f.id = c.funnel_id
    group by c.funnel_id
    having count(distinct c.website_id) > 1
       or bool_or(w.id is null or f.id is null or f.user_id <> w.user_id)
  ) then
    raise exception 'cannot backfill funnels.website_id: ambiguous, missing, or tenant-inconsistent website reference';
  end if;
end $$;

with candidates as (
  select funnel_id, website_id from public.website_routes
  union all select homepage_funnel_id, id from public.websites where homepage_funnel_id is not null
  union all select draft_homepage_funnel_id, id from public.websites where draft_homepage_funnel_id is not null
), deterministic as (
  select funnel_id, min(website_id) as website_id
  from candidates group by funnel_id having count(distinct website_id) = 1
)
update public.funnels funnel
set website_id = deterministic.website_id
from deterministic
where funnel.id = deterministic.funnel_id and funnel.website_id is null;

do $$ begin
  alter table public.funnels add constraint funnels_website_user_id_fkey
    foreign key (website_id, user_id) references public.websites(id, user_id) on delete set null (website_id);
exception when duplicate_object then null;
end $$;
create index if not exists funnels_website_id_idx on public.funnels(website_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.assert_website_funnel_ownership(p_website_id uuid, p_funnel_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_website_user text; v_funnel_user text; v_funnel_website uuid;
begin
  select user_id into v_website_user from public.websites where id = p_website_id;
  select user_id, website_id into v_funnel_user, v_funnel_website from public.funnels where id = p_funnel_id;
  if v_website_user is null or v_funnel_user is null or v_funnel_user <> v_website_user or v_funnel_website is distinct from p_website_id then
    raise exception using errcode = '23514', message = 'Funnel must belong to the selected website and tenant';
  end if;
end $$;

create or replace function private.enforce_website_funnel_route_ownership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_website_funnel_ownership(new.website_id, new.funnel_id);
  return new;
end $$;

create or replace function private.enforce_website_homepage_funnel_ownership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.homepage_funnel_id is not null then perform private.assert_website_funnel_ownership(new.id, new.homepage_funnel_id); end if;
  if new.draft_homepage_funnel_id is not null then perform private.assert_website_funnel_ownership(new.id, new.draft_homepage_funnel_id); end if;
  return new;
end $$;

drop trigger if exists website_routes_funnel_website_ownership on public.website_routes;
create constraint trigger website_routes_funnel_website_ownership
after insert or update on public.website_routes
deferrable initially deferred for each row execute function private.enforce_website_funnel_route_ownership();

drop trigger if exists builder_route_drafts_funnel_website_ownership on public.builder_route_drafts;
create constraint trigger builder_route_drafts_funnel_website_ownership
after insert or update on public.builder_route_drafts
deferrable initially deferred for each row execute function private.enforce_website_funnel_route_ownership();

drop trigger if exists websites_homepage_funnel_website_ownership on public.websites;
create constraint trigger websites_homepage_funnel_website_ownership
after insert or update on public.websites
deferrable initially deferred for each row execute function private.enforce_website_homepage_funnel_ownership();

-- The legacy bootstrap creates its Funnel before its Website. Keep the public
-- contract intact, but assign canonical ownership before deferred checks fire.
alter function public.create_initial_website_graph(text, text, text, text[], text)
  rename to create_initial_website_graph_legacy;
revoke all on function public.create_initial_website_graph_legacy(text, text, text, text[], text) from public, anon, authenticated;

create function public.create_initial_website_graph(
  p_business_name text, p_phone_number text, p_city text, p_services text[], p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_website_id uuid; v_funnel_id text;
begin
  v_result := public.create_initial_website_graph_legacy(p_business_name, p_phone_number, p_city, p_services, p_idempotency_key);
  v_website_id := (v_result #>> '{data,website,id}')::uuid;
  v_funnel_id := v_result #>> '{data,funnel,id}';
  if v_website_id is null or v_funnel_id is null then
    raise exception 'initial website graph returned an invalid website/funnel result';
  end if;
  update public.funnels set website_id = v_website_id
  where id = v_funnel_id and website_id is null;
  perform private.assert_website_funnel_ownership(v_website_id, v_funnel_id);
  return v_result;
end $$;
revoke all on function public.create_initial_website_graph(text, text, text, text[], text) from public, anon;
grant execute on function public.create_initial_website_graph(text, text, text, text[], text) to authenticated;
