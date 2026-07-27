BEGIN;

CREATE TABLE public.public_lead_intake_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
    form_section_id TEXT NOT NULL,
    idempotency_key UUID NOT NULL,
    request_fingerprint TEXT NOT NULL CHECK (length(btrim(request_fingerprint)) BETWEEN 1 AND 200),
    ip_hash TEXT NOT NULL CHECK (length(btrim(ip_hash)) BETWEEN 1 AND 200),
    contact_hash TEXT CHECK (contact_hash IS NULL OR length(btrim(contact_hash)) BETWEEN 1 AND 200),
    contact_id TEXT REFERENCES public.contacts(id) ON DELETE SET NULL,
    opportunity_id TEXT REFERENCES public.opportunities(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('processing', 'accepted', 'rate_limited')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT public_lead_intake_scope_key
        UNIQUE (website_id, page_id, form_section_id, idempotency_key)
);

CREATE INDEX idx_public_lead_intake_ip_website_created
    ON public.public_lead_intake_requests (website_id, ip_hash, created_at DESC);
CREATE INDEX idx_public_lead_intake_ip_created
    ON public.public_lead_intake_requests (ip_hash, created_at DESC);
CREATE INDEX idx_public_lead_intake_contact_website_created
    ON public.public_lead_intake_requests (website_id, contact_hash, created_at DESC)
    WHERE contact_hash IS NOT NULL;
CREATE INDEX idx_public_lead_intake_contact_id
    ON public.public_lead_intake_requests (contact_id)
    WHERE contact_id IS NOT NULL;
CREATE INDEX idx_public_lead_intake_opportunity_id
    ON public.public_lead_intake_requests (opportunity_id)
    WHERE opportunity_id IS NOT NULL;

ALTER TABLE public.public_lead_intake_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_lead_intake_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_public_lead_intake(
    p_website_id UUID,
    p_owner_id TEXT,
    p_page_id TEXT,
    p_form_section_id TEXT,
    p_route_funnel_id TEXT,
    p_idempotency_key UUID,
    p_request_fingerprint TEXT,
    p_ip_hash TEXT,
    p_contact_hash TEXT,
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_phone_match TEXT,
    p_address TEXT,
    p_service TEXT,
    p_message TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_existing public.public_lead_intake_requests%ROWTYPE;
    v_intake_id UUID;
    v_contact_id TEXT;
    v_email_ids TEXT[];
    v_phone_ids TEXT[];
    v_opportunity_id TEXT;
    v_ip_website_count INTEGER;
    v_ip_global_count INTEGER;
    v_contact_count INTEGER;
    v_notes TEXT;
BEGIN
    IF p_website_id IS NULL OR p_owner_id IS NULL OR btrim(p_owner_id) = ''
       OR p_page_id IS NULL OR btrim(p_page_id) = ''
       OR p_form_section_id IS NULL OR btrim(p_form_section_id) = ''
       OR p_route_funnel_id IS NULL OR btrim(p_route_funnel_id) = ''
       OR p_idempotency_key IS NULL
       OR p_request_fingerprint IS NULL OR btrim(p_request_fingerprint) = ''
       OR p_ip_hash IS NULL OR btrim(p_ip_hash) = ''
       OR p_name IS NULL OR btrim(p_name) = ''
       OR (coalesce(btrim(p_email), '') = '' AND coalesce(btrim(p_phone_match), '') = '') THEN
        RETURN jsonb_build_object('outcome', 'routing_unavailable');
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            p_website_id::TEXT || ':' || p_page_id || ':' || p_form_section_id || ':' || p_idempotency_key::TEXT,
            0
        )
    );

    SELECT * INTO v_existing
    FROM public.public_lead_intake_requests AS request
    WHERE request.website_id = p_website_id
      AND request.page_id = p_page_id
      AND request.form_section_id = p_form_section_id
      AND request.idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_existing.request_fingerprint <> p_request_fingerprint THEN
            RETURN jsonb_build_object('outcome', 'conflict');
        END IF;
        IF v_existing.status = 'accepted' THEN
            RETURN jsonb_build_object('outcome', 'accepted', 'replayed', true);
        END IF;
        IF v_existing.status = 'rate_limited' THEN
            RETURN jsonb_build_object('outcome', 'rate_limited', 'retry_after_seconds', 900);
        END IF;
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'public lead request is incomplete';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.websites AS website
        JOIN public.pages AS page
          ON page.id = p_page_id
         AND page.user_id = website.user_id
         AND page.funnel_id = p_route_funnel_id
        JOIN public.website_routes AS route
          ON route.website_id = website.id
         AND route.funnel_id = page.funnel_id
        JOIN public.funnels AS funnel
          ON funnel.id = p_route_funnel_id
         AND funnel.user_id = website.user_id
        WHERE website.id = p_website_id
          AND website.user_id = p_owner_id
    ) THEN
        RETURN jsonb_build_object('outcome', 'routing_unavailable');
    END IF;

    SELECT count(*) INTO v_ip_website_count
    FROM public.public_lead_intake_requests AS request
    WHERE request.website_id = p_website_id
      AND request.ip_hash = p_ip_hash
      AND request.created_at >= pg_catalog.now() - interval '15 minutes';

    SELECT count(*) INTO v_ip_global_count
    FROM public.public_lead_intake_requests AS request
    WHERE request.ip_hash = p_ip_hash
      AND request.created_at >= pg_catalog.now() - interval '1 hour';

    SELECT count(*) INTO v_contact_count
    FROM public.public_lead_intake_requests AS request
    WHERE request.website_id = p_website_id
      AND request.contact_hash = p_contact_hash
      AND request.created_at >= pg_catalog.now() - interval '24 hours';

    IF v_ip_website_count >= 5 OR v_ip_global_count >= 20
       OR (p_contact_hash IS NOT NULL AND v_contact_count >= 3) THEN
        INSERT INTO public.public_lead_intake_requests (
            website_id, page_id, form_section_id, idempotency_key,
            request_fingerprint, ip_hash, contact_hash, status, completed_at
        ) VALUES (
            p_website_id, p_page_id, p_form_section_id, p_idempotency_key,
            p_request_fingerprint, p_ip_hash, p_contact_hash, 'rate_limited', pg_catalog.now()
        );
        RETURN jsonb_build_object('outcome', 'rate_limited', 'retry_after_seconds', 900);
    END IF;

    INSERT INTO public.public_lead_intake_requests (
        website_id, page_id, form_section_id, idempotency_key,
        request_fingerprint, ip_hash, contact_hash, status
    ) VALUES (
        p_website_id, p_page_id, p_form_section_id, p_idempotency_key,
        p_request_fingerprint, p_ip_hash, p_contact_hash, 'processing'
    ) RETURNING id INTO v_intake_id;

    IF p_contact_hash IS NOT NULL THEN
        PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(p_owner_id || ':' || p_contact_hash, 0)
        );
    END IF;

    IF coalesce(btrim(p_email), '') <> '' THEN
        SELECT array_agg(contact.id ORDER BY contact.id) INTO v_email_ids
        FROM public.contacts AS contact
        WHERE contact.user_id = p_owner_id
          AND pg_catalog.lower(pg_catalog.btrim(contact.email)) = pg_catalog.lower(pg_catalog.btrim(p_email));
        IF coalesce(array_length(v_email_ids, 1), 0) > 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ambiguous tenant contact';
        END IF;
    END IF;

    IF coalesce(btrim(p_phone_match), '') <> '' THEN
        SELECT array_agg(contact.id ORDER BY contact.id) INTO v_phone_ids
        FROM public.contacts AS contact
        WHERE contact.user_id = p_owner_id
          AND pg_catalog.regexp_replace(coalesce(contact.phone, ''), '[^0-9]', '', 'g') = p_phone_match;
        IF coalesce(array_length(v_phone_ids, 1), 0) > 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ambiguous tenant contact';
        END IF;
    END IF;

    IF v_email_ids[1] IS NOT NULL AND v_phone_ids[1] IS NOT NULL AND v_email_ids[1] <> v_phone_ids[1] THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'conflicting tenant contact identity';
    END IF;
    v_contact_id := coalesce(v_email_ids[1], v_phone_ids[1]);

    IF v_contact_id IS NULL THEN
        v_contact_id := 'c-' || gen_random_uuid()::TEXT;
        INSERT INTO public.contacts (
            id, user_id, name, phone, email, address, tags, source,
            service, status, invalid_phone, created_at
        ) VALUES (
            v_contact_id, p_owner_id, btrim(p_name), nullif(btrim(p_phone), ''),
            nullif(btrim(p_email), ''), nullif(btrim(p_address), ''), ARRAY['web-lead'],
            'public website', nullif(btrim(p_service), ''), 'lead', false, pg_catalog.now()
        );
    END IF;

    SELECT opportunity.id INTO v_opportunity_id
    FROM public.opportunities AS opportunity
    WHERE opportunity.user_id = p_owner_id
      AND opportunity.contact_id = v_contact_id
      AND opportunity.status = 'open'
    ORDER BY opportunity.created_at, opportunity.id
    LIMIT 1;

    IF v_opportunity_id IS NULL THEN
        v_opportunity_id := 'opp-' || gen_random_uuid()::TEXT;
        v_notes := concat_ws(E'\n',
            CASE WHEN coalesce(btrim(p_service), '') <> '' THEN 'Service Type: ' || btrim(p_service) END,
            CASE WHEN coalesce(btrim(p_address), '') <> '' THEN 'Address: ' || btrim(p_address) END,
            CASE WHEN coalesce(btrim(p_message), '') <> '' THEN 'Message: ' || btrim(p_message) END,
            'Website: ' || p_website_id::TEXT,
            'Page: ' || p_page_id,
            'Form: ' || p_form_section_id
        );
        INSERT INTO public.opportunities (
            id, user_id, contact_id, pipeline_stage, status, value, source,
            notes, assigned_to, funnel_id, created_at
        ) VALUES (
            v_opportunity_id, p_owner_id, v_contact_id, 'New Lead', 'open', 0,
            'public website', v_notes, 'Unassigned', p_route_funnel_id, pg_catalog.now()
        );
    END IF;

    INSERT INTO public.event_logs (
        id, user_id, event_name, payload, status, contact_id, created_at
    ) VALUES (
        'evt-' || gen_random_uuid()::TEXT,
        p_owner_id,
        'lead_created',
        jsonb_build_object(
            'source', 'public website',
            'website_id', p_website_id,
            'page_id', p_page_id,
            'form_section_id', p_form_section_id,
            'opportunity_id', v_opportunity_id,
            'funnel_id', p_route_funnel_id
        ),
        'completed',
        v_contact_id,
        pg_catalog.now()
    );

    UPDATE public.public_lead_intake_requests
    SET contact_id = v_contact_id,
        opportunity_id = v_opportunity_id,
        status = 'accepted',
        completed_at = pg_catalog.now()
    WHERE id = v_intake_id;

    RETURN jsonb_build_object('outcome', 'accepted', 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_lead_intake(
    UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_lead_intake(
    UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMIT;
