-- Approved estimate review contract. Apply only after the reviewed production release gate.
create table private.crm_quote_review_runtime (id boolean primary key check(id), enabled boolean not null);
insert into private.crm_quote_review_runtime values(true,false);
alter table private.crm_quote_review_runtime enable row level security;
revoke all on private.crm_quote_review_runtime from public, anon, authenticated, service_role;

create table private.crm_quote_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_revision integer not null,
  request_key uuid not null,
  create_fingerprint text not null,
  token_hash text not null unique,
  source_snapshot jsonb not null,
  source_hash text not null,
  customer_text text not null check(length(customer_text)<=2000),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp()+interval '24 hours'),
  revoked_at timestamptz,
  response_key uuid,
  response_fingerprint text,
  response_tier text,
  response_total numeric(12,2),
  signer_name text,
  responded_at timestamptz,
  confirmation_version text,
  finalization_key uuid,
  finalized_acceptance_id uuid,
  unique(user_id,request_key)
);
create unique index crm_quote_review_one_unrevoked on private.crm_quote_reviews(quote_id) where revoked_at is null;
alter table private.crm_quote_reviews enable row level security;
revoke all on private.crm_quote_reviews from public, anon, authenticated, service_role;

create function private.require_quote_review_runtime() returns void language plpgsql set search_path='' as $$
begin
  if not coalesce((select enabled from private.crm_quote_review_runtime where id),false) then
    raise exception using errcode='42501',message='estimate review is not activated';
  end if;
end $$;

-- Lock quote, then property, then items; never use billing/contact/internal-note fields.
create function private.crm_quote_review_source(p_quote uuid,p_owner text) returns jsonb language plpgsql set search_path='' as $$
declare q public.quotes; location jsonb; items jsonb;
begin
  select * into q from public.quotes where id=p_quote and user_id=p_owner for update;
  if not found or q.status not in ('draft','sent') then raise exception using errcode='40001',message='estimate is unavailable or changed'; end if;
  if q.property_id is not null then
    select jsonb_build_object('service_address_line1',p.service_address_line1,'service_address_line2',p.service_address_line2,
      'locality',p.locality,'administrative_area',p.administrative_area,'postal_code',p.postal_code,'country_code',p.country_code)
      into location from public.properties p where p.id=q.property_id and p.user_id=q.user_id and p.contact_id=q.contact_id for update;
    if not found then raise exception using errcode='40001',message='service location unavailable'; end if;
  end if;
  perform 1 from public.quote_items where quote_id=q.id and user_id=q.user_id for share;
  if not found or exists(select 1 from public.quote_items i where i.quote_id=q.id and i.user_id=q.user_id
    and (lower(i.quantity::text) in ('nan','infinity','-infinity') or lower(i.unit_price::text) in ('nan','infinity','-infinity')
      or i.quantity<=0 or i.unit_price<0 or i.quantity>9999999999.99 or i.unit_price>9999999999.99 or i.total>9999999999.99)) then
    raise exception using errcode='22023',message='invalid estimate items';
  end if;
  select jsonb_agg(jsonb_build_object('service_name',service_name,'description',description,'quantity',quantity,
    'unit_price',unit_price,'total',total,'tier',tier,'order_index',order_index) order by order_index) into items
    from public.quote_items where quote_id=q.id and user_id=q.user_id;
  return jsonb_build_object('quote_id',q.id,'owner',q.user_id,'contact_id',q.contact_id,'property_id',q.property_id,
    'revision',q.revision,'status',q.status,'selected_tier',q.selected_tier,'total_amount',q.total_amount,
    'items',items,'service_location',location);
end $$;

create function private.crm_quote_review_owner_result(r private.crm_quote_reviews) returns jsonb language sql set search_path='' as $$
  select jsonb_build_object('id',r.id,'quote_id',r.quote_id,'revision',r.quote_revision,'expires_at',r.expires_at,
    'revoked_at',r.revoked_at,'responded_at',r.responded_at,'tier',r.response_tier,'total',r.response_total,
    'signer_name',r.signer_name,'finalized',r.finalized_acceptance_id is not null,'customer_text',r.customer_text)
$$;

create function public.create_crm_quote_review(p_quote_id uuid,p_revision integer,p_request_key uuid,p_token text,p_customer_text text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id text:=auth.uid()::text; source jsonb; r private.crm_quote_reviews; fingerprint text;
begin
  perform private.require_quote_review_runtime();
  if owner_id is null then raise exception using errcode='42501',message='authentication required'; end if;
  if p_request_key is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_customer_text is null or length(p_customer_text)>2000 then
    raise exception using errcode='22023',message='invalid review request';
  end if;
  source:=private.crm_quote_review_source(p_quote_id,owner_id);
  if (source->>'revision')::integer is distinct from p_revision then raise exception using errcode='40001',message='estimate revision conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id||':quote-review:'||p_request_key::text,0));
  fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_quote_id,p_revision,p_token,p_customer_text)::text,'UTF8')),'hex');
  select * into r from private.crm_quote_reviews where user_id=owner_id and request_key=p_request_key;
  if found then
    if r.create_fingerprint<>fingerprint then raise exception using errcode='23505',message='review request conflict'; end if;
    return private.crm_quote_review_owner_result(r);
  end if;
  if exists(select 1 from private.crm_quote_reviews where quote_id=p_quote_id and revoked_at is null) then
    raise exception using errcode='23505',message='revoke the existing link before issuing a replacement';
  end if;
  insert into private.crm_quote_reviews(user_id,quote_id,quote_revision,request_key,create_fingerprint,token_hash,source_snapshot,source_hash,customer_text)
    values(owner_id,p_quote_id,p_revision,p_request_key,fingerprint,encode(sha256(convert_to(p_token,'UTF8')),'hex'),source,
      encode(sha256(convert_to(source::text,'UTF8')),'hex'),p_customer_text) returning * into r;
  return private.crm_quote_review_owner_result(r);
end $$;

create function public.read_crm_quote_reviews(p_quote_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.require_quote_review_runtime();
  if auth.uid() is null or not exists(select 1 from public.quotes where id=p_quote_id and user_id=auth.uid()::text) then
    raise exception using errcode='42501',message='estimate unavailable';
  end if;
  return coalesce((select jsonb_agg(private.crm_quote_review_owner_result(r) order by r.created_at desc,r.id) from private.crm_quote_reviews r
    where r.quote_id=p_quote_id and r.user_id=auth.uid()::text),'[]'::jsonb);
end $$;

create function public.revoke_crm_quote_review(p_review_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.crm_quote_reviews; qid uuid;
begin
  perform private.require_quote_review_runtime();
  select quote_id into qid from private.crm_quote_reviews where id=p_review_id and user_id=auth.uid()::text;
  if not found then raise exception using errcode='42501',message='review unavailable'; end if;
  perform 1 from public.quotes where id=qid and user_id=auth.uid()::text for update;
  select * into r from private.crm_quote_reviews where id=p_review_id and user_id=auth.uid()::text for update;
  if not found then raise exception using errcode='42501',message='review unavailable'; end if;
  update private.crm_quote_reviews set revoked_at=coalesce(revoked_at,statement_timestamp()) where id=r.id returning * into r;
  return private.crm_quote_review_owner_result(r);
end $$;

-- Token validation is a capability check, not authentication as the owner.
create function private.lock_crm_quote_review(p_token text) returns private.crm_quote_reviews language plpgsql set search_path='' as $$
declare r private.crm_quote_reviews; source jsonb;
begin
  perform private.require_quote_review_runtime();
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception using errcode='42501',message='review link unavailable'; end if;
  select * into r from private.crm_quote_reviews where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not found then raise exception using errcode='42501',message='review link unavailable'; end if;
  perform 1 from public.quotes where id=r.quote_id and user_id=r.user_id for update;
  select * into r from private.crm_quote_reviews where id=r.id for update;
  if not found or r.revoked_at is not null or r.expires_at<=clock_timestamp() then
    raise exception using errcode='42501',message='review link unavailable';
  end if;
  if r.finalized_acceptance_id is null then
    source:=private.crm_quote_review_source(r.quote_id,r.user_id);
    if encode(sha256(convert_to(source::text,'UTF8')),'hex')<>r.source_hash then
      raise exception using errcode='40001',message='estimate changed; request a replacement link';
    end if;
  end if;
  return r;
end $$;

create function public.read_crm_quote_review(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.crm_quote_reviews;
begin
  r:=private.lock_crm_quote_review(p_token);
  return jsonb_build_object('id',r.id,'revision',r.quote_revision,'expires_at',r.expires_at,'customer_text',r.customer_text,
    'currency','USD','items',r.source_snapshot->'items','service_location',r.source_snapshot->'service_location',
    'state',case when r.finalized_acceptance_id is not null then 'owner_recorded' when r.responded_at is not null then 'response_received' else 'awaiting_response' end,
    'tier',r.response_tier,'total',r.response_total,'received_at',r.responded_at);
end $$;

create function public.respond_crm_quote_review(p_token text,p_request_key uuid,p_tier text,p_signer_name text,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.crm_quote_reviews; name text:=btrim(regexp_replace(coalesce(p_signer_name,''),'\s+',' ','g')); total numeric; fingerprint text;
begin
  r:=private.lock_crm_quote_review(p_token);
  if p_request_key is null or p_tier is null or p_tier not in ('basic','standard','premium') or length(name) not between 1 and 200
    or p_confirm is distinct from true then raise exception using errcode='22023',message='choose an option, enter your name and confirm the displayed scope and price'; end if;
  select sum((i->>'total')::numeric) into total from jsonb_array_elements(r.source_snapshot->'items') i where i->>'tier'=p_tier;
  if total is null or total<0 or total>9999999999.99 then raise exception using errcode='22023',message='option unavailable'; end if;
  fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_tier,name,true,'scope-price-confirmation-v1')::text,'UTF8')),'hex');
  if r.responded_at is not null then
    if r.response_key<>p_request_key or r.response_fingerprint<>fingerprint then raise exception using errcode='23505',message='a response was already recorded'; end if;
  else
    update private.crm_quote_reviews set response_key=p_request_key,response_fingerprint=fingerprint,response_tier=p_tier,
      response_total=total,signer_name=name,responded_at=clock_timestamp(),confirmation_version='scope-price-confirmation-v1'
      where id=r.id returning * into r;
  end if;
  return jsonb_build_object('state','response_received','revision',r.quote_revision,'tier',r.response_tier,'total',r.response_total,
    'currency','USD','received_at',r.responded_at);
end $$;

create function public.record_crm_quote_review_acceptance(p_review_id uuid,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.crm_quote_reviews; qid uuid; source jsonb; result jsonb; q public.quotes;
begin
  perform private.require_quote_review_runtime();
  if auth.uid() is null or p_request_key is null then raise exception using errcode='42501',message='authentication required'; end if;
  select quote_id into qid from private.crm_quote_reviews where id=p_review_id and user_id=auth.uid()::text;
  if not found then raise exception using errcode='42501',message='review unavailable'; end if;
  -- Same advisory key/order as the unchanged canonical owner acceptance RPC.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':quote-acceptance:'||p_request_key::text,0));
  select * into q from public.quotes where id=qid and user_id=auth.uid()::text for update;
  select * into r from private.crm_quote_reviews where id=p_review_id and user_id=auth.uid()::text for update;
  if not found or r.revoked_at is not null or r.responded_at is null or r.responded_at>r.expires_at then
    raise exception using errcode='40001',message='customer response unavailable';
  end if;
  if r.finalized_acceptance_id is not null then
    if not exists(select 1 from public.quote_acceptances where id=r.finalized_acceptance_id and quote_id=q.id and user_id=q.user_id)
      or q.status<>'approved' or q.revision<>r.quote_revision+1 then raise exception using errcode='40001',message='recorded acceptance unavailable'; end if;
    return jsonb_build_object('quote_id',q.id,'revision',q.revision,'status',q.status,'replayed',true);
  end if;
  source:=private.crm_quote_review_source(q.id,q.user_id);
  if encode(sha256(convert_to(source::text,'UTF8')),'hex')<>r.source_hash then raise exception using errcode='40001',message='estimate changed after customer review'; end if;
  -- Fail closed if a new trigger could give the compatibility state a delivery/outbox side effect.
  if exists(select 1 from pg_trigger where tgrelid in ('public.quotes'::regclass,'public.quote_acceptances'::regclass) and not tgisinternal) then
    raise exception using errcode='55000',message='quote trigger compatibility requires review';
  end if;
  -- No committed sent transition or delivery event: owner records actual typed response.
  update public.quotes set selected_tier=r.response_tier,total_amount=r.response_total,status='sent' where id=q.id;
  result:=public.accept_crm_quote(q.id,r.quote_revision,p_request_key,r.signer_name,null,true);
  if (result->'quote'->>'id')::uuid is distinct from q.id
    or (result->'quote'->>'revision')::integer is distinct from r.quote_revision+1
    or result->'quote'->>'status' is distinct from 'approved'
    or not exists(select 1 from public.quote_acceptances a where a.id=(result->'acceptance'->>'id')::uuid
      and a.quote_id=q.id and a.user_id=q.user_id and a.quote_revision=r.quote_revision
      and a.accepted_total_amount=r.response_total and a.signer_name=r.signer_name) then
    raise exception using errcode='23505',message='acceptance request conflict';
  end if;
  update private.crm_quote_reviews set finalized_acceptance_id=(result->'acceptance'->>'id')::uuid,finalization_key=p_request_key where id=r.id;
  return jsonb_build_object('quote_id',q.id,'revision',(result->'quote'->>'revision')::integer,'status','approved','replayed',false);
end $$;

revoke all on function private.require_quote_review_runtime(),private.crm_quote_review_source(uuid,text),
  private.crm_quote_review_owner_result(private.crm_quote_reviews),private.lock_crm_quote_review(text) from public,anon,authenticated,service_role;
revoke all on function public.create_crm_quote_review(uuid,integer,uuid,text,text),public.read_crm_quote_reviews(uuid),
  public.revoke_crm_quote_review(uuid),public.record_crm_quote_review_acceptance(uuid,uuid),
  public.read_crm_quote_review(text),public.respond_crm_quote_review(text,uuid,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.create_crm_quote_review(uuid,integer,uuid,text,text),public.read_crm_quote_reviews(uuid),
  public.revoke_crm_quote_review(uuid),public.record_crm_quote_review_acceptance(uuid,uuid) to authenticated;
-- Activation is part of this migration, not a dashboard toggle/manual SQL step.
-- Draft/preview publication alone does not apply this migration to the shared database.
-- Bearer capability is required for both operations, even when the caller is signed in.
grant execute on function public.read_crm_quote_review(text),public.respond_crm_quote_review(text,uuid,text,text,boolean) to anon,authenticated;
update private.crm_quote_review_runtime set enabled=true where id;
