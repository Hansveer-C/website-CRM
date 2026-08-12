create schema auth;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create table auth.users (id uuid primary key, email text);
create table public.users (id text primary key, email text unique not null, password_hash text not null, created_at timestamptz not null default current_timestamp);
insert into auth.users values ('11111111-1111-4111-8111-111111111111', '   ');
