-- Add immutable Builder publication revisions and one selected revision per
-- website/page scope. A page belongs to a website when its funnel is either the
-- website homepage funnel or is assigned through website_routes. The current
-- schema has no direct pages.website_id foreign key, so ownership alone is not
-- used as a scope relationship. website_routes.funnel_id has no deployed foreign
-- key, so this association uses current routing data rather than FK-backed scope.

CREATE TABLE public.builder_published_revisions (
    id UUID PRIMARY KEY,
    website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    document JSONB NOT NULL,
    document_fingerprint TEXT NOT NULL,
    CONSTRAINT builder_published_revisions_schema_version_check
        CHECK (schema_version = 1),
    CONSTRAINT builder_published_revisions_document_check
        CHECK (jsonb_typeof(document) = 'object'),
    CONSTRAINT builder_published_revisions_fingerprint_check
        CHECK (length(btrim(document_fingerprint)) > 0),
    CONSTRAINT builder_published_revisions_scope_key
        UNIQUE (website_id, page_id, id)
);

CREATE INDEX idx_builder_published_revisions_history
    ON public.builder_published_revisions (website_id, page_id, created_at DESC, id DESC);

CREATE INDEX idx_builder_published_revisions_page_id
    ON public.builder_published_revisions (page_id);

CREATE INDEX idx_builder_published_revisions_created_by
    ON public.builder_published_revisions (created_by)
    WHERE created_by IS NOT NULL;

CREATE INDEX idx_builder_published_revisions_fingerprint
    ON public.builder_published_revisions (website_id, page_id, document_fingerprint);

CREATE TABLE public.builder_publication_targets (
    website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
    published_revision_id UUID NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    published_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (website_id, page_id),
    CONSTRAINT builder_publication_targets_revision_scope_fkey
        FOREIGN KEY (website_id, page_id, published_revision_id)
        REFERENCES public.builder_published_revisions (website_id, page_id, id)
        ON DELETE NO ACTION
        DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_builder_publication_targets_page_id
    ON public.builder_publication_targets (page_id);

CREATE INDEX idx_builder_publication_targets_revision_id
    ON public.builder_publication_targets (published_revision_id);

CREATE INDEX idx_builder_publication_targets_published_by
    ON public.builder_publication_targets (published_by)
    WHERE published_by IS NOT NULL;

ALTER TABLE public.builder_published_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builder_publication_targets ENABLE ROW LEVEL SECURITY;

-- Revision history is private to authenticated owners. Both ownership and the
-- strongest website/page relationship expressible by the current schema are
-- required. Direct updates and deletes intentionally have no policy.
CREATE POLICY "Owners can view builder publication revisions"
    ON public.builder_published_revisions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.websites AS website
            JOIN public.pages AS page
              ON page.id = builder_published_revisions.page_id
            WHERE website.id = builder_published_revisions.website_id
              AND website.user_id = (SELECT auth.uid()::TEXT)
              AND page.user_id = (SELECT auth.uid()::TEXT)
              AND page.funnel_id IS NOT NULL
              AND (
                  website.homepage_funnel_id = page.funnel_id
                  OR EXISTS (
                      SELECT 1
                      FROM public.website_routes AS route
                      WHERE route.website_id = website.id
                        AND route.funnel_id = page.funnel_id
                  )
              )
        )
    );

CREATE POLICY "Owners can create builder publication revisions"
    ON public.builder_published_revisions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (created_by IS NULL OR created_by = (SELECT auth.uid()::TEXT))
        AND EXISTS (
            SELECT 1
            FROM public.websites AS website
            JOIN public.pages AS page
              ON page.id = builder_published_revisions.page_id
            WHERE website.id = builder_published_revisions.website_id
              AND website.user_id = (SELECT auth.uid()::TEXT)
              AND page.user_id = (SELECT auth.uid()::TEXT)
              AND page.funnel_id IS NOT NULL
              AND (
                  website.homepage_funnel_id = page.funnel_id
                  OR EXISTS (
                      SELECT 1
                      FROM public.website_routes AS route
                      WHERE route.website_id = website.id
                        AND route.funnel_id = page.funnel_id
                  )
              )
        )
    );

-- Targets are readable by owners, but all pointer writes go through the atomic
-- publish function below. No INSERT, UPDATE, or DELETE policy is provided.
CREATE POLICY "Owners can view builder publication targets"
    ON public.builder_publication_targets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.websites AS website
            JOIN public.pages AS page
              ON page.id = builder_publication_targets.page_id
            WHERE website.id = builder_publication_targets.website_id
              AND website.user_id = (SELECT auth.uid()::TEXT)
              AND page.user_id = (SELECT auth.uid()::TEXT)
              AND page.funnel_id IS NOT NULL
              AND (
                  website.homepage_funnel_id = page.funnel_id
                  OR EXISTS (
                      SELECT 1
                      FROM public.website_routes AS route
                      WHERE route.website_id = website.id
                        AND route.funnel_id = page.funnel_id
                  )
              )
        )
    );

CREATE OR REPLACE FUNCTION public.publish_builder_revision(
    p_website_id UUID,
    p_page_id TEXT,
    p_revision_id UUID,
    p_published_at TIMESTAMPTZ,
    p_expected_revision_id UUID,
    p_expectation_supplied BOOLEAN
)
RETURNS TABLE (
    publication_target public.builder_publication_targets,
    published_revision public.builder_published_revisions,
    previous_revision_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_acting_auth_user_id UUID := auth.uid();
    v_acting_application_user_id TEXT;
    v_revision public.builder_published_revisions%ROWTYPE;
    v_target public.builder_publication_targets%ROWTYPE;
    v_previous_revision_id UUID;
BEGIN
    IF v_acting_auth_user_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Authentication is required to publish a builder revision';
    END IF;

    v_acting_application_user_id := v_acting_auth_user_id::TEXT;

    IF p_website_id IS NULL OR p_page_id IS NULL OR p_revision_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '22004',
            MESSAGE = 'Website, page, and revision IDs are required';
    END IF;

    IF p_published_at IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '22004',
            MESSAGE = 'Published timestamp is required';
    END IF;

    IF p_expectation_supplied IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '22004',
            MESSAGE = 'Expectation-supplied flag is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.websites AS website
        WHERE website.id = p_website_id
          AND website.user_id = v_acting_application_user_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Builder publication website is not owned by the authenticated user';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.pages AS page
        WHERE page.id = p_page_id
          AND page.user_id = v_acting_application_user_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Builder publication page is not owned by the authenticated user';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.websites AS website
        JOIN public.pages AS page
          ON page.id = p_page_id
        WHERE website.id = p_website_id
          AND page.funnel_id IS NOT NULL
          AND (
              website.homepage_funnel_id = page.funnel_id
              OR EXISTS (
                  SELECT 1
                  FROM public.website_routes AS route
                  WHERE route.website_id = website.id
                    AND route.funnel_id = page.funnel_id
              )
          )
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Builder publication page does not belong to the supplied website';
    END IF;

    -- Lock a stable parent row before reading the target. This serializes both
    -- first-time publishes and republish/rollback operations for this page.
    PERFORM 1
    FROM public.pages AS page
    WHERE page.id = p_page_id
    FOR UPDATE;

    SELECT revision.*
    INTO v_revision
    FROM public.builder_published_revisions AS revision
    WHERE revision.id = p_revision_id
      AND revision.website_id = p_website_id
      AND revision.page_id = p_page_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'Builder publication revision was not found in the supplied website/page scope';
    END IF;

    IF v_revision.schema_version <> 1
       OR jsonb_typeof(v_revision.document) <> 'object'
       OR length(btrim(v_revision.document_fingerprint)) = 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Builder publication revision metadata is not publishable';
    END IF;

    SELECT target.published_revision_id
    INTO v_previous_revision_id
    FROM public.builder_publication_targets AS target
    WHERE target.website_id = p_website_id
      AND target.page_id = p_page_id
    FOR UPDATE;

    IF p_expectation_supplied
       AND v_previous_revision_id IS DISTINCT FROM p_expected_revision_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'BUILDER_PUBLICATION_TARGET_CONFLICT',
            DETAIL = format(
                'Expected revision %s but current revision is %s',
                coalesce(p_expected_revision_id::TEXT, 'null'),
                coalesce(v_previous_revision_id::TEXT, 'null')
            );
    END IF;

    INSERT INTO public.builder_publication_targets (
        website_id,
        page_id,
        published_revision_id,
        published_at,
        published_by
    )
    VALUES (
        p_website_id,
        p_page_id,
        p_revision_id,
        p_published_at,
        v_acting_application_user_id
    )
    ON CONFLICT (website_id, page_id)
    DO UPDATE SET
        published_revision_id = EXCLUDED.published_revision_id,
        published_at = EXCLUDED.published_at,
        published_by = EXCLUDED.published_by
    RETURNING * INTO v_target;

    publication_target := v_target;
    published_revision := v_revision;
    previous_revision_id := v_previous_revision_id;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_unpublished_builder_revision(
    p_revision_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_acting_auth_user_id UUID := auth.uid();
    v_acting_application_user_id TEXT;
    v_revision public.builder_published_revisions%ROWTYPE;
BEGIN
    IF v_acting_auth_user_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Authentication is required to delete a builder revision';
    END IF;

    v_acting_application_user_id := v_acting_auth_user_id::TEXT;

    IF p_revision_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '22004',
            MESSAGE = 'Revision ID is required';
    END IF;

    SELECT revision.*
    INTO v_revision
    FROM public.builder_published_revisions AS revision
    WHERE revision.id = p_revision_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'Builder publication revision was not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.websites AS website
        JOIN public.pages AS page
          ON page.id = v_revision.page_id
        WHERE website.id = v_revision.website_id
          AND website.user_id = v_acting_application_user_id
          AND page.user_id = v_acting_application_user_id
          AND page.funnel_id IS NOT NULL
          AND (
              website.homepage_funnel_id = page.funnel_id
              OR EXISTS (
                  SELECT 1
                  FROM public.website_routes AS route
                  WHERE route.website_id = website.id
                    AND route.funnel_id = page.funnel_id
              )
          )
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Builder publication revision is outside the authenticated user scope';
    END IF;

    -- Use the same parent-row lock as publish to avoid a pointer being created
    -- between the published-state check and deletion.
    PERFORM 1
    FROM public.pages AS page
    WHERE page.id = v_revision.page_id
    FOR UPDATE;

    SELECT revision.*
    INTO v_revision
    FROM public.builder_published_revisions AS revision
    WHERE revision.id = p_revision_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'Builder publication revision was not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.builder_publication_targets AS target
        WHERE target.published_revision_id = p_revision_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '55006',
            MESSAGE = 'BUILDER_REVISION_IS_PUBLISHED';
    END IF;

    DELETE FROM public.builder_published_revisions AS revision
    WHERE revision.id = p_revision_id;

    RETURN p_revision_id;
END;
$$;

-- Make the intended API surface explicit. Service-role access remains available
-- for trusted maintenance/migration work and bypasses RLS by Supabase convention.
REVOKE ALL ON TABLE public.builder_published_revisions FROM anon, authenticated;
REVOKE ALL ON TABLE public.builder_publication_targets FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.builder_published_revisions TO authenticated;
GRANT SELECT ON TABLE public.builder_publication_targets TO authenticated;
GRANT ALL ON TABLE public.builder_published_revisions TO service_role;
GRANT ALL ON TABLE public.builder_publication_targets TO service_role;

REVOKE ALL ON FUNCTION public.publish_builder_revision(
    UUID, TEXT, UUID, TIMESTAMPTZ, UUID, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_builder_revision(
    UUID, TEXT, UUID, TIMESTAMPTZ, UUID, BOOLEAN
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_unpublished_builder_revision(UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_unpublished_builder_revision(UUID)
    TO authenticated, service_role;

COMMENT ON TABLE public.builder_published_revisions IS
    'Immutable Builder publication snapshots. Duplicate document fingerprints are allowed.';
COMMENT ON TABLE public.builder_publication_targets IS
    'The selected published revision for each website/page scope; writes are RPC-only.';
COMMENT ON FUNCTION public.publish_builder_revision(
    UUID, TEXT, UUID, TIMESTAMPTZ, UUID, BOOLEAN
) IS
    'Atomically selects a revision. p_expectation_supplied distinguishes omitted expectation from an explicit null expectation.';
COMMENT ON FUNCTION public.delete_unpublished_builder_revision(UUID) IS
    'Deletes an owned revision only when no publication target currently references it.';
