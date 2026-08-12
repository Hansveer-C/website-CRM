create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.users (
  id text primary key,
  email text unique not null
);
create table public.funnels (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade
);
create table public.contacts (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  tags text[] default '{}',
  source text,
  status text not null default 'lead' check (status in ('lead','customer','archived')),
  follow_up_required boolean default false,
  created_at timestamptz not null default current_timestamp,
  invalid_phone boolean default false,
  lead_status text,
  service text,
  notes text,
  unique (user_id, phone)
);
create table public.opportunities (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  pipeline_stage text not null default 'New Lead',
  status text not null check (status in ('open','closed_won','closed_lost')),
  value numeric default 0,
  source text,
  created_at timestamptz not null default current_timestamp,
  notes text,
  assigned_to text,
  funnel_id text references public.funnels(id) on delete set null
);
create unique index opportunities_one_open_per_contact on public.opportunities(user_id, contact_id) where status = 'open';

alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
create policy contacts_owner_select on public.contacts for select to authenticated using (user_id = (select auth.uid())::text);
create policy opportunities_owner_select on public.opportunities for select to authenticated using (user_id = (select auth.uid())::text);
grant select on public.contacts, public.opportunities to authenticated;

insert into public.users(id,email) values
  ('11111111-1111-4111-8111-111111111111','a@example.test'),
  ('22222222-2222-4222-8222-222222222222','b@example.test');
insert into public.funnels(id,user_id) values ('funnel-a','11111111-1111-4111-8111-111111111111');
insert into public.contacts(id,user_id,name,phone,email) values
  ('contact-a','11111111-1111-4111-8111-111111111111','Owner A','+15555550101','a-contact@example.test'),
  ('contact-b','22222222-2222-4222-8222-222222222222','Owner B','+15555550202','b-contact@example.test');
insert into public.opportunities(id,user_id,contact_id,pipeline_stage,status,value) values
  ('opportunity-a','11111111-1111-4111-8111-111111111111','contact-a','New Lead','open',0),
  ('opportunity-b','22222222-2222-4222-8222-222222222222','contact-b','New Lead','open',0);
