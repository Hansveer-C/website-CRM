-- Canonical legacy WashOps schema immediately before the tracked migration chain.
--
-- This migration is intentionally strict. Production already contains this schema
-- and must record this version through a separately authorized ledger-repair phase;
-- this DDL is only for bootstrapping new, empty Supabase environments.

create table public.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default current_timestamp,
  user_slug text unique
);

create table public.websites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  domain text,
  subdomain text not null,
  homepage_funnel_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint websites_subdomain_unique unique (subdomain),
  constraint websites_user_id_unique unique (user_id)
);

create table public.funnels (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create table public.contacts (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  tags text[] default '{}'::text[],
  source text,
  status text not null default 'lead'
    check (status in ('lead', 'customer', 'archived')),
  follow_up_required boolean default false,
  created_at timestamptz not null default current_timestamp,
  invalid_phone boolean default false,
  lead_status text,
  service text,
  notes text
);

create table public.opportunities (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  pipeline_stage text not null default 'New Lead',
  status text not null
    check (status in ('open', 'closed_won', 'closed_lost')),
  value numeric(12,2) default 0,
  source text,
  created_at timestamptz not null default current_timestamp,
  notes text,
  assigned_to text,
  funnel_id text references public.funnels(id) on delete set null
);

create table public.activities (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  type text not null,
  description text not null,
  due_date timestamptz,
  completed boolean default false,
  created_at timestamptz not null default current_timestamp
);

create table public.messages (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  opportunity_id text references public.opportunities(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  type text not null default 'sms',
  content text not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  source text,
  retryable boolean default false,
  created_at timestamptz not null default current_timestamp
);

create table public.calls (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null,
  duration integer default 0,
  created_at timestamptz not null default current_timestamp,
  recording_url text,
  opportunity_id text
);

create table public.event_logs (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null,
  created_at timestamptz not null default current_timestamp
);

create table public.website_settings (
  id text primary key,
  user_id text unique references public.users(id) on delete cascade,
  business_name text not null,
  phone text,
  email text,
  logo_url text,
  primary_color text default '#2563eb',
  auto_lead_sms_enabled boolean default true,
  missed_call_sms_enabled boolean default true,
  created_at timestamptz not null default current_timestamp
);

create table public.website_routes (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  path text not null check (path like '/%'),
  funnel_id text not null,
  created_at timestamptz default now(),
  constraint website_routes_website_id_path_unique unique (website_id, path)
);

create table public.funnel_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null
    check (category in ('pressure_washing', 'general_service')),
  service_type text not null
    check (service_type in ('driveway', 'house_wash', 'generic')),
  city_placeholder_enabled boolean default false,
  created_at timestamptz default now()
);

create table public.template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.funnel_templates(id) on delete cascade,
  type text not null check (type in ('landing', 'form', 'thank_you')),
  "order" integer not null,
  template_content jsonb not null default '{}'::jsonb
);

create table public.pages (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  seo_title text,
  seo_description text,
  seo_keywords text[] default '{}'::text[],
  created_at timestamptz not null default current_timestamp,
  funnel_id text references public.funnels(id) on delete cascade,
  step_type text,
  step_order integer,
  constraint pages_user_id_slug_key unique (user_id, slug)
);

create table public.page_sections (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  page_id text not null references public.pages(id) on delete cascade,
  type text not null,
  content jsonb not null default '{}'::jsonb,
  order_index integer not null,
  styles jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default current_timestamp
);

create table public.website_layouts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  header_config jsonb default '{"logo_text": "", "nav_items": []}'::jsonb,
  footer_config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint website_layouts_website_id_unique unique (website_id)
);

create table public.media (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  url text not null,
  name text not null,
  type text not null check (type in ('image', 'video')),
  tags text[] default '{}'::text[],
  created_at timestamptz not null default current_timestamp
);

create index idx_activities_contact_id on public.activities(contact_id);
create index idx_calls_contact_id on public.calls(contact_id);
create index idx_calls_opportunity_id on public.calls(opportunity_id);
create index idx_calls_user_created on public.calls(user_id, created_at desc);
create index idx_contacts_leads_only on public.contacts(user_id, created_at desc)
  where status = 'lead';
create index idx_contacts_user_created on public.contacts(user_id, created_at desc);
create index idx_contacts_user_phone on public.contacts(user_id, phone);
create index idx_funnel_templates_category on public.funnel_templates(category);
create index idx_funnels_user_created on public.funnels(user_id, created_at);
create index idx_media_user_id on public.media(user_id);
create index idx_messages_contact_created on public.messages(contact_id, created_at desc);
create index idx_messages_contact_id on public.messages(contact_id);
create index idx_messages_opportunity_id on public.messages(opportunity_id);
create index idx_messages_user_created on public.messages(user_id, created_at desc);
create index idx_opportunities_contact_id on public.opportunities(contact_id);
create index idx_opportunities_funnel_id on public.opportunities(funnel_id);
create index idx_opportunities_open_only on public.opportunities(user_id, pipeline_stage)
  where status = 'open';
create index idx_opportunities_user_created on public.opportunities(user_id, created_at desc);
create index idx_page_sections_page_id on public.page_sections(page_id);
create index idx_page_sections_user_id on public.page_sections(user_id);
create index idx_pages_funnel_id on public.pages(funnel_id, step_order);
create index idx_pages_slug on public.pages(slug);
create index idx_pages_user_id on public.pages(user_id);
create index idx_template_steps_template_id on public.template_steps(template_id);
create index website_layouts_website_id_idx on public.website_layouts(website_id);
create index website_routes_website_id_idx on public.website_routes(website_id);
create index websites_user_id_idx on public.websites(user_id);

alter table public.users enable row level security;
create policy user_read_own on public.users
  for select
  using (id = auth.uid()::text);

alter table public.media enable row level security;
create policy media_policy_own on public.media
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
