-- Supabase Multi-Tenant RLS Hardening Migration
-- Enforce tenant boundaries with the deployed TEXT application-user identity:
-- application user_id = (SELECT auth.uid()::TEXT).
--
-- Each owner policy is command-specific so INSERT and UPDATE validate the
-- resulting row as well as the existing row. FORCE ROW LEVEL SECURITY is not
-- enabled. Existing grants are unchanged except for the explicit event_logs
-- privilege reconciliation below.
--
-- Websites and routes remain owner-only under table RLS. Public website
-- delivery will use a dedicated trusted backend or Edge Function that returns
-- only selected immutable publication data and approved site settings; base
-- tables do not receive broad anonymous SELECT policies.

-- ====================================================
-- WEBSITES
-- ====================================================
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own websites" ON public.websites;
DROP POLICY IF EXISTS websites_owner_select ON public.websites;
DROP POLICY IF EXISTS websites_owner_insert ON public.websites;
DROP POLICY IF EXISTS websites_owner_update ON public.websites;
DROP POLICY IF EXISTS websites_owner_delete ON public.websites;


CREATE POLICY websites_owner_select
    ON public.websites
    FOR SELECT
    TO authenticated
    USING (websites.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY websites_owner_insert
    ON public.websites
    FOR INSERT
    TO authenticated
    WITH CHECK (websites.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY websites_owner_update
    ON public.websites
    FOR UPDATE
    TO authenticated
    USING (websites.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (websites.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY websites_owner_delete
    ON public.websites
    FOR DELETE
    TO authenticated
    USING (websites.user_id = (SELECT auth.uid()::TEXT));

-- ====================================================
-- WEBSITE ROUTES
-- ====================================================
ALTER TABLE public.website_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage routes of their websites" ON public.website_routes;
DROP POLICY IF EXISTS website_routes_owner_select ON public.website_routes;
DROP POLICY IF EXISTS website_routes_owner_insert ON public.website_routes;
DROP POLICY IF EXISTS website_routes_owner_update ON public.website_routes;
DROP POLICY IF EXISTS website_routes_owner_delete ON public.website_routes;

-- funnel_id has no deployed foreign key. Route integrity therefore continues to
-- depend on existing routing data; tenant authorization derives from website_id.
CREATE POLICY website_routes_owner_select
    ON public.website_routes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
        SELECT 1
        FROM public.websites AS owned_website
        WHERE owned_website.id = website_routes.website_id
          AND owned_website.user_id = (SELECT auth.uid()::TEXT)
    )
    );

CREATE POLICY website_routes_owner_insert
    ON public.website_routes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
        SELECT 1
        FROM public.websites AS owned_website
        WHERE owned_website.id = website_routes.website_id
          AND owned_website.user_id = (SELECT auth.uid()::TEXT)
    )
    );

CREATE POLICY website_routes_owner_update
    ON public.website_routes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
        SELECT 1
        FROM public.websites AS owned_website
        WHERE owned_website.id = website_routes.website_id
          AND owned_website.user_id = (SELECT auth.uid()::TEXT)
    )
    )
    WITH CHECK (
        EXISTS (
        SELECT 1
        FROM public.websites AS owned_website
        WHERE owned_website.id = website_routes.website_id
          AND owned_website.user_id = (SELECT auth.uid()::TEXT)
    )
    );

CREATE POLICY website_routes_owner_delete
    ON public.website_routes
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
        SELECT 1
        FROM public.websites AS owned_website
        WHERE owned_website.id = website_routes.website_id
          AND owned_website.user_id = (SELECT auth.uid()::TEXT)
    )
    );

-- ====================================================
-- FUNNELS
-- ====================================================
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS funnels_policy_own ON public.funnels;
DROP POLICY IF EXISTS "Users can manage their own funnels" ON public.funnels;
DROP POLICY IF EXISTS funnels_owner_select ON public.funnels;
DROP POLICY IF EXISTS funnels_owner_insert ON public.funnels;
DROP POLICY IF EXISTS funnels_owner_update ON public.funnels;
DROP POLICY IF EXISTS funnels_owner_delete ON public.funnels;


CREATE POLICY funnels_owner_select
    ON public.funnels
    FOR SELECT
    TO authenticated
    USING (funnels.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY funnels_owner_insert
    ON public.funnels
    FOR INSERT
    TO authenticated
    WITH CHECK (funnels.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY funnels_owner_update
    ON public.funnels
    FOR UPDATE
    TO authenticated
    USING (funnels.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (funnels.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY funnels_owner_delete
    ON public.funnels
    FOR DELETE
    TO authenticated
    USING (funnels.user_id = (SELECT auth.uid()::TEXT));

-- ====================================================
-- PAGES
-- ====================================================
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pages_policy_own ON public.pages;
DROP POLICY IF EXISTS "Users can manage their own pages" ON public.pages;
DROP POLICY IF EXISTS pages_owner_select ON public.pages;
DROP POLICY IF EXISTS pages_owner_insert ON public.pages;
DROP POLICY IF EXISTS pages_owner_update ON public.pages;
DROP POLICY IF EXISTS pages_owner_delete ON public.pages;


CREATE POLICY pages_owner_select
    ON public.pages
    FOR SELECT
    TO authenticated
    USING (pages.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY pages_owner_insert
    ON public.pages
    FOR INSERT
    TO authenticated
    WITH CHECK (pages.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY pages_owner_update
    ON public.pages
    FOR UPDATE
    TO authenticated
    USING (pages.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (pages.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY pages_owner_delete
    ON public.pages
    FOR DELETE
    TO authenticated
    USING (pages.user_id = (SELECT auth.uid()::TEXT));

-- ====================================================
-- PAGE SECTIONS
-- ====================================================
ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS page_sections_policy_own ON public.page_sections;
DROP POLICY IF EXISTS "Users can manage sections of their pages" ON public.page_sections;
DROP POLICY IF EXISTS page_sections_owner_select ON public.page_sections;
DROP POLICY IF EXISTS page_sections_owner_insert ON public.page_sections;
DROP POLICY IF EXISTS page_sections_owner_update ON public.page_sections;
DROP POLICY IF EXISTS page_sections_owner_delete ON public.page_sections;

CREATE POLICY page_sections_owner_select
    ON public.page_sections
    FOR SELECT
    TO authenticated
    USING (
        page_sections.user_id = (SELECT auth.uid()::TEXT)
        AND EXISTS (
            SELECT 1
            FROM public.pages AS owned_page
            WHERE owned_page.id = page_sections.page_id
              AND owned_page.user_id = (SELECT auth.uid()::TEXT)
        )
    );

CREATE POLICY page_sections_owner_insert
    ON public.page_sections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        page_sections.user_id = (SELECT auth.uid()::TEXT)
        AND EXISTS (
            SELECT 1
            FROM public.pages AS owned_page
            WHERE owned_page.id = page_sections.page_id
              AND owned_page.user_id = (SELECT auth.uid()::TEXT)
        )
    );

CREATE POLICY page_sections_owner_update
    ON public.page_sections
    FOR UPDATE
    TO authenticated
    USING (
        page_sections.user_id = (SELECT auth.uid()::TEXT)
        AND EXISTS (
            SELECT 1
            FROM public.pages AS owned_page
            WHERE owned_page.id = page_sections.page_id
              AND owned_page.user_id = (SELECT auth.uid()::TEXT)
        )
    )
    WITH CHECK (
        page_sections.user_id = (SELECT auth.uid()::TEXT)
        AND EXISTS (
            SELECT 1
            FROM public.pages AS owned_page
            WHERE owned_page.id = page_sections.page_id
              AND owned_page.user_id = (SELECT auth.uid()::TEXT)
        )
    );

CREATE POLICY page_sections_owner_delete
    ON public.page_sections
    FOR DELETE
    TO authenticated
    USING (
        page_sections.user_id = (SELECT auth.uid()::TEXT)
        AND EXISTS (
            SELECT 1
            FROM public.pages AS owned_page
            WHERE owned_page.id = page_sections.page_id
              AND owned_page.user_id = (SELECT auth.uid()::TEXT)
        )
    );

-- ====================================================
-- CONTACTS
-- ====================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_policy_own ON public.contacts;
DROP POLICY IF EXISTS "Users can manage their own contacts" ON public.contacts;
DROP POLICY IF EXISTS contacts_owner_select ON public.contacts;
DROP POLICY IF EXISTS contacts_owner_insert ON public.contacts;
DROP POLICY IF EXISTS contacts_owner_update ON public.contacts;
DROP POLICY IF EXISTS contacts_owner_delete ON public.contacts;


CREATE POLICY contacts_owner_select
    ON public.contacts
    FOR SELECT
    TO authenticated
    USING (contacts.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY contacts_owner_insert
    ON public.contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (contacts.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY contacts_owner_update
    ON public.contacts
    FOR UPDATE
    TO authenticated
    USING (contacts.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (contacts.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY contacts_owner_delete
    ON public.contacts
    FOR DELETE
    TO authenticated
    USING (contacts.user_id = (SELECT auth.uid()::TEXT));

-- ====================================================
-- OPPORTUNITIES
-- ====================================================
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_all_own ON public.opportunities;
DROP POLICY IF EXISTS "Users can manage their own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS opportunities_owner_select ON public.opportunities;
DROP POLICY IF EXISTS opportunities_owner_insert ON public.opportunities;
DROP POLICY IF EXISTS opportunities_owner_update ON public.opportunities;
DROP POLICY IF EXISTS opportunities_owner_delete ON public.opportunities;


CREATE POLICY opportunities_owner_select
    ON public.opportunities
    FOR SELECT
    TO authenticated
    USING (opportunities.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY opportunities_owner_insert
    ON public.opportunities
    FOR INSERT
    TO authenticated
    WITH CHECK (opportunities.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY opportunities_owner_update
    ON public.opportunities
    FOR UPDATE
    TO authenticated
    USING (opportunities.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (opportunities.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY opportunities_owner_delete
    ON public.opportunities
    FOR DELETE
    TO authenticated
    USING (opportunities.user_id = (SELECT auth.uid()::TEXT));

-- ====================================================
-- MESSAGES
-- ====================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_all_own ON public.messages;
DROP POLICY IF EXISTS "Users can manage their own messages" ON public.messages;
DROP POLICY IF EXISTS messages_owner_select ON public.messages;
DROP POLICY IF EXISTS messages_owner_insert ON public.messages;
DROP POLICY IF EXISTS messages_owner_update ON public.messages;
DROP POLICY IF EXISTS messages_owner_delete ON public.messages;


CREATE POLICY messages_owner_select
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (messages.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY messages_owner_insert
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (messages.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY messages_owner_update
    ON public.messages
    FOR UPDATE
    TO authenticated
    USING (messages.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (messages.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY messages_owner_delete
    ON public.messages
    FOR DELETE
    TO authenticated
    USING (messages.user_id = (SELECT auth.uid()::TEXT));

-- ====================================================
-- CALLS
-- ====================================================
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS call_all_own ON public.calls;
DROP POLICY IF EXISTS "Users can manage their own calls" ON public.calls;
DROP POLICY IF EXISTS calls_owner_select ON public.calls;
DROP POLICY IF EXISTS calls_owner_insert ON public.calls;
DROP POLICY IF EXISTS calls_owner_update ON public.calls;
DROP POLICY IF EXISTS calls_owner_delete ON public.calls;


CREATE POLICY calls_owner_select
    ON public.calls
    FOR SELECT
    TO authenticated
    USING (calls.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY calls_owner_insert
    ON public.calls
    FOR INSERT
    TO authenticated
    WITH CHECK (calls.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY calls_owner_update
    ON public.calls
    FOR UPDATE
    TO authenticated
    USING (calls.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (calls.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY calls_owner_delete
    ON public.calls
    FOR DELETE
    TO authenticated
    USING (calls.user_id = (SELECT auth.uid()::TEXT));

-- ====================================================
-- EVENT LOGS
-- ====================================================
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_all_own ON public.event_logs;
DROP POLICY IF EXISTS "Users can manage their own event logs" ON public.event_logs;
DROP POLICY IF EXISTS event_logs_owner_select ON public.event_logs;
DROP POLICY IF EXISTS event_logs_owner_insert ON public.event_logs;
DROP POLICY IF EXISTS event_logs_owner_update ON public.event_logs;
DROP POLICY IF EXISTS event_logs_owner_delete ON public.event_logs;
DROP POLICY IF EXISTS system_logs_policy ON public.event_logs;

CREATE POLICY event_logs_owner_select
    ON public.event_logs
    FOR SELECT
    TO authenticated
    USING (event_logs.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY event_logs_owner_insert
    ON public.event_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (event_logs.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY event_logs_owner_update
    ON public.event_logs
    FOR UPDATE
    TO authenticated
    USING (event_logs.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (event_logs.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY event_logs_owner_delete
    ON public.event_logs
    FOR DELETE
    TO authenticated
    USING (event_logs.user_id = (SELECT auth.uid()::TEXT));

-- Rows owned by the reserved 'system' identity are trusted operational records.
-- They are intentionally inaccessible to anon and ordinary authenticated
-- sessions; trusted server/service-role code remains responsible for creating
-- and reading them. A narrowly validated SECURITY DEFINER RPC may be added later
-- only if an unprivileged system-event submission path becomes necessary.
REVOKE ALL PRIVILEGES
    ON TABLE public.event_logs
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.event_logs
    TO authenticated;

GRANT ALL PRIVILEGES
    ON TABLE public.event_logs
    TO service_role;

-- ====================================================
-- ACTIVITIES
-- ====================================================
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_all_own ON public.activities;
DROP POLICY IF EXISTS "Users can manage their own activities" ON public.activities;
DROP POLICY IF EXISTS activities_owner_select ON public.activities;
DROP POLICY IF EXISTS activities_owner_insert ON public.activities;
DROP POLICY IF EXISTS activities_owner_update ON public.activities;
DROP POLICY IF EXISTS activities_owner_delete ON public.activities;


CREATE POLICY activities_owner_select
    ON public.activities
    FOR SELECT
    TO authenticated
    USING (activities.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY activities_owner_insert
    ON public.activities
    FOR INSERT
    TO authenticated
    WITH CHECK (activities.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY activities_owner_update
    ON public.activities
    FOR UPDATE
    TO authenticated
    USING (activities.user_id = (SELECT auth.uid()::TEXT))
    WITH CHECK (activities.user_id = (SELECT auth.uid()::TEXT));

CREATE POLICY activities_owner_delete
    ON public.activities
    FOR DELETE
    TO authenticated
    USING (activities.user_id = (SELECT auth.uid()::TEXT));
