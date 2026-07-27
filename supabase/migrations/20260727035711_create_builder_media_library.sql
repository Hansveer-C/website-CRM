-- Builder media metadata and least-privilege Storage access.
-- Existing object bytes are deliberately not moved or deleted.

update storage.buckets
set public = true,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'media';

create table public.builder_media_assets (
  id uuid primary key,
  user_id text not null references public.users(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  bucket_id text not null default 'media' check (bucket_id = 'media'),
  object_path text not null unique,
  display_name text not null check (length(btrim(display_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  width integer not null check (width between 1 and 8000),
  height integer not null check (height between 1 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint builder_media_assets_pixel_limit check ((width::bigint * height::bigint) <= 40000000),
  constraint builder_media_assets_owner_path check (
    object_path = user_id || '/' || website_id::text || '/' || id::text ||
      case mime_type
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'image/webp' then '.webp'
      end
  )
);

create index builder_media_assets_website_created_idx
  on public.builder_media_assets (website_id, created_at desc, id desc);

create index builder_media_assets_user_website_idx
  on public.builder_media_assets (user_id, website_id);

create function public.set_builder_media_asset_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_builder_media_asset_updated_at
before update on public.builder_media_assets
for each row execute function public.set_builder_media_asset_updated_at();

alter table public.builder_media_assets enable row level security;

create policy builder_media_assets_select_owner
on public.builder_media_assets
for select
to authenticated
using (
  user_id = (select auth.uid())::text
  and exists (
    select 1 from public.websites website
    where website.id = website_id
      and website.user_id = (select auth.uid())::text
  )
);

create policy builder_media_assets_insert_owner
on public.builder_media_assets
for insert
to authenticated
with check (
  user_id = (select auth.uid())::text
  and exists (
    select 1 from public.websites website
    where website.id = website_id
      and website.user_id = (select auth.uid())::text
  )
);

create policy builder_media_assets_update_owner
on public.builder_media_assets
for update
to authenticated
using (
  user_id = (select auth.uid())::text
  and exists (
    select 1 from public.websites website
    where website.id = website_id
      and website.user_id = (select auth.uid())::text
  )
)
with check (
  user_id = (select auth.uid())::text
  and exists (
    select 1 from public.websites website
    where website.id = website_id
      and website.user_id = (select auth.uid())::text
  )
);

create policy builder_media_assets_delete_owner
on public.builder_media_assets
for delete
to authenticated
using (
  user_id = (select auth.uid())::text
  and exists (
    select 1 from public.websites website
    where website.id = website_id
      and website.user_id = (select auth.uid())::text
  )
);

revoke all on table public.builder_media_assets from anon;
revoke all on table public.builder_media_assets from public;
revoke all on table public.builder_media_assets from authenticated;
grant select, insert, update, delete on table public.builder_media_assets to authenticated;

drop policy if exists "Allow public read access to media" on storage.objects;
drop policy if exists "Allow tenant-scoped inserts" on storage.objects;
drop policy if exists "Allow tenant-scoped updates" on storage.objects;
drop policy if exists "Allow tenant-scoped deletes" on storage.objects;

create policy builder_media_objects_select_owner
on storage.objects
for select
to authenticated
using (
  bucket_id = 'media'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(storage.objects.name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
  and exists (
    select 1 from public.websites website
    where website.id::text = (storage.foldername(storage.objects.name))[2]
      and website.user_id = (select auth.uid())::text
  )
);

create policy builder_media_objects_insert_owner
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(storage.objects.name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
  and exists (
    select 1 from public.websites website
    where website.id::text = (storage.foldername(storage.objects.name))[2]
      and website.user_id = (select auth.uid())::text
  )
);

create policy builder_media_objects_update_owner
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(storage.objects.name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
  and exists (
    select 1 from public.websites website
    where website.id::text = (storage.foldername(storage.objects.name))[2]
      and website.user_id = (select auth.uid())::text
  )
)
with check (
  bucket_id = 'media'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(storage.objects.name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
  and exists (
    select 1 from public.websites website
    where website.id::text = (storage.foldername(storage.objects.name))[2]
      and website.user_id = (select auth.uid())::text
  )
);

create policy builder_media_objects_delete_owner
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(storage.objects.name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
  and exists (
    select 1 from public.websites website
    where website.id::text = (storage.foldername(storage.objects.name))[2]
      and website.user_id = (select auth.uid())::text
  )
);
