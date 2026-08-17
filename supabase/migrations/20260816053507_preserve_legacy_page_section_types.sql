-- Preserve legacy generated sections while retaining the hardened atomic save boundary.
create or replace function public.save_page_sections_document(
  p_page_id text,
  p_sections jsonb,
  p_generation bigint,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_page_owner text;
  v_section jsonb;
  v_section_id text;
  v_order integer;
  v_count integer;
  v_affected_count integer;
  v_current_revision bigint := 0;
  v_next_revision bigint;
  v_document_hash text;
begin
  if v_user_id is null or v_user_id = '' then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;
  if p_page_id is null or length(trim(p_page_id)) = 0 or length(p_page_id) > 128 then
    raise sqlstate 'PT404' using message = 'Page not found';
  end if;
  if p_generation is null or p_generation < 1 then
    raise sqlstate 'PT422' using message = 'Invalid generation';
  end if;
  if p_expected_revision is not null and p_expected_revision < 0 then
    raise sqlstate 'PT422' using message = 'Invalid expected revision';
  end if;
  if jsonb_typeof(p_sections) <> 'array' then
    raise sqlstate 'PT422' using message = 'Sections must be an array';
  end if;

  v_count := jsonb_array_length(p_sections);
  if v_count > 100 then
    raise sqlstate 'PT422' using message = 'Too many sections';
  end if;

  select page.user_id into v_page_owner
  from public.pages as page
  where page.id = p_page_id;
  if not found then
    raise sqlstate 'PT404' using message = 'Page not found';
  end if;
  if v_page_owner <> v_user_id then
    raise sqlstate 'PT403' using message = 'Page ownership required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-sections:' || p_page_id, 0));

  select revision into v_current_revision
  from private.page_section_save_revisions
  where page_id = p_page_id;
  v_current_revision := coalesce(v_current_revision, 0);
  if p_expected_revision is not null and p_expected_revision <> v_current_revision then
    raise sqlstate 'PT409' using message = 'Revision conflict';
  end if;

  for v_section in select value from jsonb_array_elements(p_sections)
  loop
    if jsonb_typeof(v_section) <> 'object' then
      raise sqlstate 'PT422' using message = 'Invalid section';
    end if;
    v_section_id := trim(coalesce(v_section->>'id', ''));
    if v_section_id = '' or length(v_section_id) > 128 then
      raise sqlstate 'PT422' using message = 'Invalid section ID';
    end if;
    if v_section->>'page_id' is distinct from p_page_id then
      raise sqlstate 'PT422' using message = 'Section page mismatch';
    end if;
    if coalesce(v_section->>'type', '') not in (
      'hero', 'proof', 'offer', 'gallery', 'form', 'faq',
      'services', 'benefits', 'before_after', 'cta', 'contact_info', 'map'
    ) then
      raise sqlstate 'PT422' using message = 'Unknown section type';
    end if;
    if jsonb_typeof(v_section->'order') <> 'number'
       or (v_section->>'order') !~ '^[0-9]+$'
       or length(v_section->>'order') > 9 then
      raise sqlstate 'PT422' using message = 'Invalid section order';
    end if;
    v_order := (v_section->>'order')::integer;
    if v_order < 0 or v_order >= v_count then
      raise sqlstate 'PT422' using message = 'Section order must be contiguous';
    end if;
    if jsonb_typeof(v_section->'content') <> 'object' or jsonb_typeof(v_section->'styles') <> 'object' then
      raise sqlstate 'PT422' using message = 'Invalid section document';
    end if;
    if octet_length((v_section->'content')::text) > 256000 or octet_length((v_section->'styles')::text) > 256000 then
      raise sqlstate 'PT422' using message = 'Section document is too large';
    end if;
    if v_section ? 'variant' and jsonb_typeof(v_section->'variant') not in ('string', 'null') then
      raise sqlstate 'PT422' using message = 'Invalid section variant';
    end if;
    if length(coalesce(v_section->>'variant', '')) > 80 then
      raise sqlstate 'PT422' using message = 'Invalid section variant';
    end if;
    if exists (
      select 1 from public.page_sections as existing
      where existing.id = v_section_id
        and (existing.page_id <> p_page_id or existing.user_id <> v_user_id)
    ) then
      raise sqlstate 'PT403' using message = 'Section ownership required';
    end if;
  end loop;

  if (select count(distinct item->>'id') from jsonb_array_elements(p_sections) as item) <> v_count
     or (select count(distinct (item->>'order')::integer) from jsonb_array_elements(p_sections) as item) <> v_count then
    raise sqlstate 'PT422' using message = 'Duplicate section ID or order';
  end if;

  delete from public.page_sections as existing
  where existing.page_id = p_page_id
    and existing.user_id = v_user_id
    and not exists (
      select 1 from jsonb_array_elements(p_sections) as item
      where item->>'id' = existing.id
    );

  insert into public.page_sections(id, user_id, page_id, type, content, order_index, styles, created_at)
  select
    item->>'id',
    v_user_id,
    p_page_id,
    item->>'type',
    (item->'content') || case
      when nullif(item->>'variant', '') is null then '{}'::jsonb
      else jsonb_build_object('__builder_variant', item->>'variant')
    end,
    (item->>'order')::integer,
    item->'styles',
    now()
  from jsonb_array_elements(p_sections) as item
  on conflict (id) do update set
    type = excluded.type,
    content = excluded.content,
    order_index = excluded.order_index,
    styles = excluded.styles
  where page_sections.user_id = excluded.user_id
    and page_sections.page_id = excluded.page_id;

  get diagnostics v_affected_count = row_count;
  if v_affected_count <> v_count then
    raise sqlstate 'PT403' using message = 'Section ownership required';
  end if;

  v_next_revision := v_current_revision + 1;
  v_document_hash := pg_catalog.md5(p_sections::text);
  insert into private.page_section_save_revisions(page_id, user_id, revision, document_hash, updated_at)
  values (p_page_id, v_user_id, v_next_revision, v_document_hash, now())
  on conflict (page_id) do update set
    user_id = excluded.user_id,
    revision = excluded.revision,
    document_hash = excluded.document_hash,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'page_id', p_page_id,
    'saved_count', v_count,
    'generation', p_generation,
    'revision', v_next_revision,
    'document_hash', v_document_hash
  );
exception
  when sqlstate 'PT401' or sqlstate 'PT403' or sqlstate 'PT404' or sqlstate 'PT409' or sqlstate 'PT422' then
    raise;
  when others then
    raise sqlstate 'PT500' using message = 'Page section transaction failed';
end;
$$;

revoke all on function public.save_page_sections_document(text, jsonb, bigint, bigint) from public, anon;
grant execute on function public.save_page_sections_document(text, jsonb, bigint, bigint) to authenticated;

comment on function public.save_page_sections_document(text, jsonb, bigint, bigint) is
  'Atomically replaces one authenticated owner page section document, preserving supported canonical and legacy section types.';
