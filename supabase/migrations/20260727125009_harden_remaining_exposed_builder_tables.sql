begin;

alter table public.funnel_templates enable row level security;
alter table public.funnel_templates force row level security;
alter table public.template_steps enable row level security;
alter table public.template_steps force row level security;
alter table public.website_layouts enable row level security;
alter table public.website_layouts force row level security;

revoke all on table public.funnel_templates from public, anon, authenticated;
revoke all on table public.template_steps from public, anon, authenticated;
revoke all on table public.website_layouts from public, anon, authenticated;

grant select on table public.funnel_templates to authenticated;
grant select on table public.template_steps to authenticated;
grant select, insert, update, delete on table public.website_layouts to authenticated;

create policy "Authenticated users can read shared funnel templates"
on public.funnel_templates
for select
to authenticated
using ((select auth.uid()) is not null);

create policy "Authenticated users can read shared template steps"
on public.template_steps
for select
to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.funnel_templates as template
    where template.id = template_steps.template_id
  )
);

create policy "Website owners can read layouts"
on public.website_layouts
for select
to authenticated
using (
  exists (
    select 1
    from public.websites as website
    where website.id = website_layouts.website_id
      and website.user_id = (select auth.uid())::text
  )
);

create policy "Website owners can create layouts"
on public.website_layouts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.websites as website
    where website.id = website_layouts.website_id
      and website.user_id = (select auth.uid())::text
  )
);

create policy "Website owners can update layouts"
on public.website_layouts
for update
to authenticated
using (
  exists (
    select 1
    from public.websites as website
    where website.id = website_layouts.website_id
      and website.user_id = (select auth.uid())::text
  )
)
with check (
  exists (
    select 1
    from public.websites as website
    where website.id = website_layouts.website_id
      and website.user_id = (select auth.uid())::text
  )
);

create policy "Website owners can delete layouts"
on public.website_layouts
for delete
to authenticated
using (
  exists (
    select 1
    from public.websites as website
    where website.id = website_layouts.website_id
      and website.user_id = (select auth.uid())::text
  )
);

commit;
