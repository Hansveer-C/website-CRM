begin;

do $contract$
declare
  missing_names text[];
  unexpected_names text[];
  bad_count integer;
begin
  select array_agg(expected.name order by expected.name)
    into missing_names
  from (values
    ('activities'), ('calls'), ('contacts'), ('event_logs'), ('funnel_templates'),
    ('funnels'), ('media'), ('messages'), ('opportunities'), ('page_sections'),
    ('pages'), ('template_steps'), ('users'), ('website_layouts'),
    ('website_routes'), ('website_settings'), ('websites')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if missing_names is not null then
    raise exception 'legacy baseline tables missing: %', missing_names;
  end if;

  with expected(table_name, column_name, data_type, nullable) as (values
    ('users','id','text',false), ('users','email','text',false),
    ('users','password_hash','text',false), ('users','created_at','timestamp with time zone',false),
    ('users','user_slug','text',true),
    ('contacts','id','text',false), ('contacts','user_id','text',false),
    ('contacts','name','text',false), ('contacts','phone','text',true),
    ('contacts','email','text',true), ('contacts','address','text',true),
    ('contacts','tags','ARRAY',true), ('contacts','source','text',true),
    ('contacts','status','text',false), ('contacts','follow_up_required','boolean',true),
    ('contacts','created_at','timestamp with time zone',false),
    ('contacts','invalid_phone','boolean',true), ('contacts','lead_status','text',true),
    ('contacts','service','text',true), ('contacts','notes','text',true),
    ('opportunities','id','text',false), ('opportunities','user_id','text',false),
    ('opportunities','contact_id','text',false), ('opportunities','pipeline_stage','text',false),
    ('opportunities','status','text',false), ('opportunities','value','numeric',true),
    ('opportunities','source','text',true),
    ('opportunities','created_at','timestamp with time zone',false),
    ('opportunities','notes','text',true), ('opportunities','assigned_to','text',true),
    ('opportunities','funnel_id','text',true),
    ('activities','id','text',false), ('activities','user_id','text',false),
    ('activities','contact_id','text',false), ('activities','type','text',false),
    ('activities','description','text',false),
    ('activities','due_date','timestamp with time zone',true),
    ('activities','completed','boolean',true),
    ('activities','created_at','timestamp with time zone',false),
    ('messages','id','text',false), ('messages','user_id','text',true),
    ('messages','contact_id','text',false), ('messages','opportunity_id','text',true),
    ('messages','direction','text',false), ('messages','type','text',false),
    ('messages','content','text',false), ('messages','status','text',false),
    ('messages','source','text',true), ('messages','retryable','boolean',true),
    ('messages','created_at','timestamp with time zone',false),
    ('calls','id','text',false), ('calls','user_id','text',true),
    ('calls','contact_id','text',true), ('calls','phone','text',false),
    ('calls','direction','text',false), ('calls','status','text',false),
    ('calls','duration','integer',true),
    ('calls','created_at','timestamp with time zone',false),
    ('calls','recording_url','text',true), ('calls','opportunity_id','text',true),
    ('event_logs','id','text',false), ('event_logs','user_id','text',true),
    ('event_logs','event_name','text',false), ('event_logs','payload','jsonb',false),
    ('event_logs','status','text',false),
    ('event_logs','created_at','timestamp with time zone',false),
    ('website_settings','id','text',false), ('website_settings','user_id','text',true),
    ('website_settings','business_name','text',false),
    ('website_settings','phone','text',true), ('website_settings','email','text',true),
    ('website_settings','logo_url','text',true),
    ('website_settings','primary_color','text',true),
    ('website_settings','auto_lead_sms_enabled','boolean',true),
    ('website_settings','missed_call_sms_enabled','boolean',true),
    ('website_settings','created_at','timestamp with time zone',false),
    ('websites','id','uuid',false), ('websites','user_id','text',false),
    ('websites','name','text',false), ('websites','domain','text',true),
    ('websites','subdomain','text',false), ('websites','homepage_funnel_id','text',true),
    ('websites','created_at','timestamp with time zone',true),
    ('websites','updated_at','timestamp with time zone',true),
    ('website_routes','id','uuid',false), ('website_routes','website_id','uuid',false),
    ('website_routes','path','text',false), ('website_routes','funnel_id','text',false),
    ('website_routes','created_at','timestamp with time zone',true),
    ('funnels','id','text',false), ('funnels','user_id','text',false),
    ('funnels','name','text',false), ('funnels','status','text',false),
    ('funnels','created_at','timestamp with time zone',false),
    ('funnels','updated_at','timestamp with time zone',false),
    ('funnel_templates','id','uuid',false), ('funnel_templates','name','text',false),
    ('funnel_templates','category','text',false),
    ('funnel_templates','service_type','text',false),
    ('funnel_templates','city_placeholder_enabled','boolean',true),
    ('funnel_templates','created_at','timestamp with time zone',true),
    ('template_steps','id','uuid',false), ('template_steps','template_id','uuid',false),
    ('template_steps','type','text',false), ('template_steps','order','integer',false),
    ('template_steps','template_content','jsonb',false),
    ('pages','id','text',false), ('pages','user_id','text',false),
    ('pages','name','text',false), ('pages','slug','text',false),
    ('pages','status','text',false), ('pages','seo_title','text',true),
    ('pages','seo_description','text',true), ('pages','seo_keywords','ARRAY',true),
    ('pages','created_at','timestamp with time zone',false),
    ('pages','funnel_id','text',true), ('pages','step_type','text',true),
    ('pages','step_order','integer',true),
    ('page_sections','id','text',false), ('page_sections','user_id','text',false),
    ('page_sections','page_id','text',false), ('page_sections','type','text',false),
    ('page_sections','content','jsonb',false),
    ('page_sections','order_index','integer',false),
    ('page_sections','styles','jsonb',false),
    ('page_sections','created_at','timestamp with time zone',false),
    ('website_layouts','id','uuid',false),
    ('website_layouts','website_id','uuid',false),
    ('website_layouts','header_config','jsonb',true),
    ('website_layouts','footer_config','jsonb',true),
    ('website_layouts','created_at','timestamp with time zone',true),
    ('website_layouts','updated_at','timestamp with time zone',true),
    ('media','id','text',false), ('media','user_id','text',false),
    ('media','url','text',false), ('media','name','text',false),
    ('media','type','text',false), ('media','tags','ARRAY',true),
    ('media','created_at','timestamp with time zone',false)
  )
  select count(*) into bad_count
  from expected
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
  where actual.column_name is null
     or actual.data_type <> expected.data_type
     or (actual.is_nullable = 'YES') <> expected.nullable;

  if bad_count <> 0 then
    raise exception 'legacy baseline has % missing or mismatched columns', bad_count;
  end if;

  select array_agg(table_name || '.' || column_name order by table_name, column_name)
    into unexpected_names
  from information_schema.columns
  where table_schema = 'public'
    and (table_name, column_name) in (values
      ('messages','provider_message_id'), ('messages','trigger_event_id'),
      ('event_logs','contact_id'), ('website_settings','auto_lead_sms_template'),
      ('website_settings','missed_call_sms_template'),
      ('website_settings','facebook_pixel_id'), ('website_settings','gtm_id'),
      ('website_settings','ga4_measurement_id'), ('website_settings','publish_status'),
      ('website_settings','website_id'), ('website_settings','build_brief'),
      ('website_settings','updated_at'), ('websites','draft_homepage_funnel_id'),
      ('websites','publication_revision'), ('funnels','service_type'),
      ('funnels','city'), ('funnels','website_id')
    );

  if unexpected_names is not null then
    raise exception 'later columns appeared in legacy baseline: %', unexpected_names;
  end if;

  if (select count(*) from pg_constraint
      where conrelid in ('public.users'::regclass, 'public.contacts'::regclass,
        'public.opportunities'::regclass, 'public.activities'::regclass,
        'public.messages'::regclass, 'public.calls'::regclass,
        'public.event_logs'::regclass, 'public.website_settings'::regclass,
        'public.websites'::regclass, 'public.website_routes'::regclass,
        'public.funnels'::regclass, 'public.funnel_templates'::regclass,
        'public.template_steps'::regclass, 'public.pages'::regclass,
        'public.page_sections'::regclass, 'public.website_layouts'::regclass,
        'public.media'::regclass)
        and contype = 'p') <> 17 then
    raise exception 'expected one primary key on each legacy table';
  end if;

  select count(*) into bad_count
  from (values
    ('users_email_key'), ('users_user_slug_key'), ('pages_user_id_slug_key'),
    ('website_settings_user_id_key'), ('websites_subdomain_unique'),
    ('websites_user_id_unique'), ('website_routes_website_id_path_unique'),
    ('website_layouts_website_id_unique')
  ) as expected(name)
  where not exists (
    select 1 from pg_constraint
    where conname = expected.name and contype = 'u'
  );

  if bad_count <> 0 then
    raise exception 'legacy baseline is missing % required unique constraints', bad_count;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'websites'
      and column_name = 'user_id'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'websites.user_id must exist as NOT NULL text';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.websites'::regclass
      and conname = 'websites_user_id_unique'
      and contype = 'u'
  ) then
    raise exception 'historical websites.user_id unique ownership constraint is missing';
  end if;

  -- The recovered production baseline has no websites.user_id -> users.id FK,
  -- and no tracked later migration introduces one. This assertion is valid for
  -- both the baseline-only contract and a completed canonical migration replay.
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.websites'::regclass
      and conname = 'websites_user_id_fkey'
      and contype = 'f'
  ) then
    raise exception 'legacy or later replay invented websites_user_id_fkey';
  end if;

  select count(*) into bad_count
  from (values
    ('idx_activities_contact_id'), ('idx_calls_contact_id'),
    ('idx_calls_opportunity_id'), ('idx_calls_user_created'),
    ('idx_contacts_leads_only'), ('idx_contacts_user_created'),
    ('idx_contacts_user_phone'), ('idx_funnel_templates_category'),
    ('idx_funnels_user_created'), ('idx_media_user_id'),
    ('idx_messages_contact_created'), ('idx_messages_contact_id'),
    ('idx_messages_opportunity_id'), ('idx_messages_user_created'),
    ('idx_opportunities_contact_id'), ('idx_opportunities_funnel_id'),
    ('idx_opportunities_open_only'), ('idx_opportunities_user_created'),
    ('idx_page_sections_page_id'), ('idx_page_sections_user_id'),
    ('idx_pages_funnel_id'), ('idx_pages_slug'), ('idx_pages_user_id'),
    ('idx_template_steps_template_id'), ('website_layouts_website_id_idx'),
    ('website_routes_website_id_idx'), ('websites_user_id_idx')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if bad_count <> 0 then
    raise exception 'legacy baseline is missing % required lookup indexes', bad_count;
  end if;

  if to_regclass('public.contacts_user_id_phone_key') is not null
     or to_regclass('public.unique_open_opportunity_per_contact') is not null
     or to_regclass('public.unique_active_opportunity') is not null then
    raise exception 'later uniqueness/indexes appeared in legacy baseline';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.calls'::regclass
      and conname = 'calls_contact_id_fkey'
      and confdeltype = 'n'
  ) then
    raise exception 'calls.contact_id must initially use ON DELETE SET NULL';
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_logs'::regclass
      and conname = 'event_logs_contact_id_fkey'
  ) then
    raise exception 'event_logs contact foreign key must not exist in baseline';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='user_read_own')
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='media' and policyname='media_policy_own') then
    raise exception 'historical users/media policies are missing';
  end if;

  if (select count(*) from pg_class where oid in ('public.users'::regclass, 'public.media'::regclass) and relrowsecurity) <> 2 then
    raise exception 'historical users/media RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_trigger trigger
    join pg_class relation on relation.oid = trigger.tgrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where not trigger.tgisinternal and namespace.nspname = 'public'
  ) then
    raise exception 'legacy baseline introduced an application trigger';
  end if;

  select array_agg(name order by name) into unexpected_names
  from (values
    ('reviews'), ('gallery_items'), ('builder_published_revisions'),
    ('public_lead_intake_requests'), ('builder_media_assets'),
    ('builder_route_drafts'), ('builder_site_navigation_live'),
    ('builder_site_navigation_drafts'), ('quotes'), ('quote_items'),
    ('quote_acceptances'), ('invoices'), ('invoice_items'),
    ('tenant_business_identities'), ('invoice_document_specs')
  ) as later(name)
  where to_regclass('public.' || later.name) is not null;

  if unexpected_names is not null then
    raise exception 'later tables appeared in legacy baseline: %', unexpected_names;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'create_public_lead_intake', 'create_initial_website_graph',
      'save_crm_quote', 'accept_crm_quote', 'create_invoice_from_accepted_quote',
      'create_issued_invoice_document_spec'
    )
  ) then
    raise exception 'later application RPC appeared in legacy baseline';
  end if;

  if exists (select 1 from storage.buckets where id in ('media', 'commercial-documents')) then
    raise exception 'legacy baseline must not create Storage buckets';
  end if;
end
$contract$;

rollback;
