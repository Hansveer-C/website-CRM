create schema auth;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create table auth.users (
  id uuid primary key,
  email text
);

create table public.users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default current_timestamp,
  display_name text
);

create table public.owned_records (
  id text primary key,
  user_id text not null references public.users(id),
  payload text not null
);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'matched@example.test'),
  ('22222222-2222-4222-8222-222222222222', '  MISSING-ONE@EXAMPLE.TEST  '),
  ('33333333-3333-4333-8333-333333333333', 'missing-two@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'same-id@example.test');

insert into public.users (id, email, password_hash, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'matched@example.test', 'existing-legitimate-hash', 'Existing Auth Profile'),
  ('44444444-4444-4444-8444-444444444444', 'same-id@example.test', 'existing-same-id-hash', 'Same ID Profile'),
  ('99999999-9999-4999-8999-999999999999', 'legacy-only@example.test', 'legacy-hash', 'Legacy Only');

insert into public.owned_records (id, user_id, payload)
values ('owned-before-backfill', '11111111-1111-4111-8111-111111111111', 'must remain unchanged');
