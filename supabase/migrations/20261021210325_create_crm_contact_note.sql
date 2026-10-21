-- Internal notes reuse activities. Retry metadata is private and contains no note copy.
create table private.crm_contact_note_requests (
  user_id text not null references public.users(id) on delete cascade,
  request_key uuid not null,
  contact_id text not null,
  request_fingerprint text not null,
  activity_id text not null,
  activity_created_at timestamptz not null,
  primary key (user_id, request_key)
);
alter table private.crm_contact_note_requests enable row level security;
revoke all on private.crm_contact_note_requests from public, anon, authenticated, service_role;

-- No activity/contact FK: retain a replay tombstone after a source is deleted.
-- Existing contact/user cascade semantics and owner activity CRUD are unchanged.
create function public.create_crm_contact_note(p_request_key uuid, p_contact_id text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner text := auth.uid()::text;
  -- Match ECMAScript trim, including Unicode whitespace, without changing internal text.
  v_text text := btrim(p_note, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  v_fingerprint text;
  v_request private.crm_contact_note_requests;
  v_activity public.activities;
  v_replayed boolean := false;
begin
  if v_owner is null then raise exception using errcode='42501', message='authentication required'; end if;
  if p_request_key is null or p_contact_id is null or length(p_contact_id) not between 1 and 200
     or v_text is null or length(v_text) not between 1 and 5000 then
    raise exception using errcode='22023', message='enter a note of 1 to 5000 characters';
  end if;
  -- Hold contact ownership against concurrent deletion/reassignment through commit.
  perform 1 from public.contacts where id=p_contact_id and user_id=v_owner for share;
  if not found then raise exception using errcode='42501', message='contact unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner || ':' || p_request_key::text, 0));
  v_fingerprint := encode(sha256(convert_to(jsonb_build_array(p_contact_id,v_text)::text,'UTF8')),'hex');
  select * into v_request from private.crm_contact_note_requests
    where user_id=v_owner and request_key=p_request_key;
  if found then
    if v_request.request_fingerprint <> v_fingerprint then
      raise exception using errcode='23505', message='note request payload conflict';
    end if;
    select * into v_activity from public.activities where id=v_request.activity_id
      and user_id=v_owner and contact_id=p_contact_id for share;
    if not found or v_activity.type <> 'note' or v_activity.description <> v_text
       or v_activity.created_at <> v_request.activity_created_at
       or v_activity.completed is distinct from true or v_activity.due_date is not null then
      raise exception using errcode='40001', message='saved note changed or is unavailable';
    end if;
    v_replayed := true;
  else
    insert into public.activities(id,user_id,contact_id,type,description,due_date,completed)
      values(gen_random_uuid()::text,v_owner,p_contact_id,'note',v_text,null,true)
      returning * into v_activity;
    insert into private.crm_contact_note_requests
      values(v_owner,p_request_key,p_contact_id,v_fingerprint,v_activity.id,v_activity.created_at);
  end if;
  return jsonb_build_object('activity',jsonb_build_object(
    'id',v_activity.id,'contact_id',v_activity.contact_id,'type',v_activity.type,
    'description',v_activity.description,'due_date',v_activity.due_date,
    'completed',v_activity.completed,'created_at',v_activity.created_at),'replayed',v_replayed);
end;
$$;
revoke all on function public.create_crm_contact_note(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.create_crm_contact_note(uuid,text,text) to authenticated;
